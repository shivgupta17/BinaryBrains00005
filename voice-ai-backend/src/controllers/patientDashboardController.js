const fileUtils = require('../utils/fileUtils');
const patientContextService = require('../services/patientContextService');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

/**
 * Patient Dashboard Controller
 * Enforces strict rule: Patient sees ONLY DOCTOR APPROVED medications (no unapproved AI candidates)!
 */
async function getPatientDashboardData(req, res) {
  try {
    const patientId = req.query.patientId || req.headers['x-patient-id'] || 'PAT_DUAL_PANEL_01';
    const caseId    = req.query.caseId    || `CASE_${patientId}`;

    const context  = patientContextService.getPatientCaseContext(patientId, caseId);
    const caseData = context.case || {};

    // Doctor details if assigned
    let assignedDoctor = null;
    if (caseData.assignedDoctorId) {
      assignedDoctor = fileUtils.getDoctor(caseData.assignedDoctorId);
    }
    if (!assignedDoctor) {
      assignedDoctor = {
        doctorId: 'DOC_01',
        name: 'Dr. Aarav Sharma',
        specialty: 'Orthopedics & General Medicine',
        hospital: 'GramCare Central Clinic'
      };
    }

    // Assigned Assistant details
    const assignedAssistant = {
      assistantId: caseData.assistantId || 'ASSISTANT_01',
      name: 'Sunita Wagh (Clinic Assistant)',
      email: process.env.ASSISTANT_EMAIL || 'assistant@gramcare.ai',
      phone: '+91 98765 43210',
      clinic: 'Rajpur Primary Health Centre'
    };

    // STRICT PATIENT PRIVACY RULE: Filter ONLY Doctor-Approved Medications
    const approvedMedications = (caseData.approvedMedications || []).filter(m => 
      m.status === 'DOCTOR_APPROVED' || m.approvalStatus === 'approved'
    );

    const bedAssignment = caseData.bedAssignment || null;
    const followUp = caseData.followUp || null;

    return res.status(200).json({
      success: true,
      data: {
        patientId,
        caseId,
        demographics: context.demographics,
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

    const caseData = fileUtils.getCase(caseId);
    const context  = patientContextService.getPatientCaseContext(patientId || caseData?.patientId, caseId);

    const assistantEmail = process.env.ASSISTANT_EMAIL || 'assistant@gramcare.ai';
    const patientName    = context.demographics?.name || 'Patient';

    const reminderTitle = `⏰ Patient Reminder Request: ${requestType || 'Medication Guidance'}`;
    const reminderMsg   = `Patient ${patientName} (${patientId}) sent a reminder request: "${message || 'Please check my medication schedule and instructions.'}"`;

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
