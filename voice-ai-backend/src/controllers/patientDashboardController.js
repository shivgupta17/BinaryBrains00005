const fileUtils = require('../utils/fileUtils');
const patientContextService = require('../services/patientContextService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

/**
 * Patient Dashboard Controller
 * Enforces strict rule: Patient sees ONLY DOCTOR APPROVED medications (no unapproved AI candidates)!
 */
const { getDb, isDbConnected } = require('../config/db');

async function getPatientDashboardData(req, res) {
  try {
    const patientId = req.query.patientId || req.headers['x-patient-id'] || req.user?.patientId;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId parameter or header is required.' });
    }

    const cleanPatientId = patientId.trim();
    let patientDoc = null;
    let caseData = null;

    if (isDbConnected()) {
      const db = getDb();
      patientDoc = await db.collection('patients').findOne({
        $or: [{ patientId: cleanPatientId }, { userId: cleanPatientId }]
      });
      if (!patientDoc) {
        patientDoc = await db.collection('users').findOne({
          role: 'patient',
          $or: [{ patientId: cleanPatientId }, { userId: cleanPatientId }]
        });
      }

      const pId = patientDoc?.patientId || cleanPatientId;
      caseData = await db.collection('cases').findOne({
        patientId: pId,
        status: { $in: ['OPEN', 'REFERRED', 'IN_CONSULTATION'] }
      });
    }

    if (!patientDoc) {
      patientDoc = fileUtils.getPatient(cleanPatientId);
    }

    const pId = patientDoc?.patientId || cleanPatientId;
    const context = await patientContextService.getPatientCaseContext(pId, caseData?.caseId || req.query.caseId || `CASE_${pId}`);
    if (!caseData) {
      caseData = context.case || {};
    }

    // Fetch Assigned Doctor
    let assignedDoctor = null;
    const docId = caseData.assignedDoctorId;
    if (docId) {
      if (isDbConnected()) {
        const db = getDb();
        const docObj = await db.collection('doctors').findOne({ $or: [{ doctorId: docId }, { userId: docId }] });
        if (docObj) {
          assignedDoctor = { doctorId: docObj.doctorId || docId, name: docObj.name, specialty: docObj.specialty || 'General Medicine' };
        }
      }
      if (!assignedDoctor) {
        assignedDoctor = fileUtils.getDoctor(docId);
      }
    }

    // Fetch Assigned Assistant
    let assignedAssistant = null;
    const asstId = caseData.assistantId;
    if (asstId) {
      if (isDbConnected()) {
        const db = getDb();
        const asstObj = await db.collection('assistants').findOne({ $or: [{ assistantId: asstId }, { userId: asstId }] });
        if (asstObj) {
          assignedAssistant = { assistantId: asstObj.assistantId || asstId, name: asstObj.name, email: asstObj.email };
        }
      }
      if (!assignedAssistant) {
        assignedAssistant = { assistantId: asstId, name: 'Assigned Clinic Assistant', email: process.env.ASSISTANT_EMAIL || 'assistant@gramcare.ai' };
      }
    }

    // STRICT PATIENT PRIVACY RULE: Filter ONLY Doctor-Approved Medications
    const approvedMedications = (caseData.approvedMedications || []).filter(m => 
      m.status === 'DOCTOR_APPROVED' || m.approvalStatus === 'approved'
    );

    const bedAssignment = caseData.bedAssignment || null;
    const followUp = caseData.followUp || null;

    return res.status(200).json({
      success: true,
      data: {
        patientId: pId,
        caseId: caseData.caseId || `CASE_${pId}`,
        demographics: {
          name: patientDoc?.name || context.demographics?.name || 'Patient',
          age: patientDoc?.age || context.demographics?.age || 30,
          sex: patientDoc?.sex || context.demographics?.sex || 'Male',
          village: patientDoc?.village || 'Rajpur'
        },
        status: caseData.status || 'ACTIVE',
        vitals: context.vitals,
        assignedDoctor,
        assignedAssistant,
        approvedMedications, // ONLY Doctor Approved Medications!
        bedAssignment,
        followUp,
        timeline: context.timeline || []
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Patient -> Assistant Reminder Request (POST /api/cases/:caseId/reminders)
 * Sends email via Nodemailer ONLY to assigned assistant email
 */
async function sendPatientReminderRequest(req, res) {
  try {
    const { caseId } = req.params;
    const { patientId, requestType, message } = req.body;

    let caseData = null;
    if (isDbConnected()) {
      const db = getDb();
      caseData = await db.collection('cases').findOne({ caseId });
    }
    if (!caseData) {
      caseData = fileUtils.getCase(caseId) || {};
    }

    const targetPatientId = patientId || caseData?.patientId || 'PAT_DEFAULT';
    const context = await patientContextService.getPatientCaseContext(targetPatientId, caseId);

    let assistantEmail = process.env.ASSISTANT_EMAIL || 'assistant@gramcare.ai';
    if (isDbConnected() && caseData?.assistantId) {
      const db = getDb();
      const asstId = caseData.assistantId;
      const asstUser = await db.collection('users').findOne({
        role: 'assistant',
        $or: [
          { assistantId: asstId },
          { userId: asstId },
          { email: asstId }
        ]
      });
      if (asstUser?.email) {
        assistantEmail = asstUser.email;
      }
    }

    const patientName   = context.demographics?.name || 'Patient';
    const reminderTitle = `⏰ Patient Reminder Request: ${requestType || 'Medication Guidance'}`;
    const reminderMsg   = `Patient ${patientName} (${targetPatientId}) sent a reminder request: "${message || 'Please check my medication schedule and instructions.'}"`;

    // 1. Save Notification targeted to assigned assistant ONLY
    notificationService.sendNotification({
      recipientRole: 'assistant',
      recipientId: caseData?.assistantId || 'ASSISTANT_01',
      patientId: patientId || caseData?.patientId,
      caseId,
      type: 'REMINDER_REQUEST',
      title: reminderTitle,
      message: reminderMsg,
      priority: 'HIGH'
    });

    // 2. Add Event to Case Intelligence Timeline
    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'PATIENT_REMINDER_REQUESTED',
      title: 'Patient Requested Reminder',
      description: `"${message || 'Requested medication reminder from assistant'}"`,
      actor: patientName,
      actorRole: 'patient'
    });

    // 3. Send Email via Nodemailer to assigned assistant ONLY
    const emailResult = await emailService.sendEmail({
      to: assistantEmail,
      subject: `[GramCare Clinic] ${reminderTitle}`,
      text: `${reminderMsg}\n\nPlease review case ${caseId} in your Assistant Panel.`,
      html: `
        <div style="font-family:sans-serif;padding:16px;background:#f4f6f8;border-radius:8px;">
          <h3 style="color:#1b6b4a;margin-top:0;">🏥 GramCare AI Clinic Alert</h3>
          <p><strong>${reminderTitle}</strong></p>
          <p>${reminderMsg}</p>
          <p style="font-size:12px;color:#666;">Patient ID: <code>${patientId}</code> | Case ID: <code>${caseId}</code></p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: 'Reminder request sent to assigned assistant via email notification.',
      emailStatus: emailResult
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getPatientDashboardData,
  sendPatientReminderRequest
};
