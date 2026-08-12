const fileUtils = require('../utils/fileUtils');
const { getDb, isDbConnected } = require('../config/db');
const idGen = require('../utils/idGenerator');

/**
 * Doctor Referral Controller
 */
async function createReferral(req, res) {
  try {
    const { patientId, caseId, doctorId, assistantId, riskLevel, reason, aiSummary } = req.body;
    if (!patientId || !caseId || !doctorId) {
      return res.status(400).json({ success: false, error: 'patientId, caseId, and doctorId are required' });
    }

    const cleanDoctorId = doctorId.trim();

    // Verify Doctor Existence in MongoDB Atlas or local file storage
    let doctorDoc = null;
    if (isDbConnected()) {
      const db = getDb();
      doctorDoc = await db.collection('doctors').findOne({
        $or: [{ doctorId: cleanDoctorId }, { userId: cleanDoctorId }]
      });
      if (!doctorDoc) {
        doctorDoc = await db.collection('users').findOne({
          role: 'doctor',
          $or: [{ doctorId: cleanDoctorId }, { userId: cleanDoctorId }]
        });
      }
    }

    if (!doctorDoc) {
      doctorDoc = fileUtils.getDoctor(cleanDoctorId);
    }

    if (!doctorDoc) {
      return res.status(404).json({ success: false, error: `Doctor not found for ID: ${cleanDoctorId}` });
    }

    const targetDoctorId = doctorDoc.doctorId || cleanDoctorId;
    const referralId = idGen.generateReferralId();
    const createdAt = new Date().toISOString();

    const caseData = fileUtils.getCase(caseId);

    const referral = {
      referralId,
      patientId: patientId.trim(),
      caseId: caseId.trim(),
      doctorId: targetDoctorId,
      doctorName: doctorDoc.name || 'Attending Doctor',
      assistantId: (assistantId || 'ASSISTANT_DEFAULT').trim(),
      riskLevel: riskLevel || 'medium',
      reason: reason || 'Clinical evaluation requested by clinic assistant',
      aiSummary: aiSummary || null,
      status: 'NEW',
      createdAt,
      acceptedAt: null
    };

    fileUtils.saveReferral(referral);

    if (caseData) {
      caseData.status = 'REFERRED';
      caseData.assignedDoctorId = targetDoctorId;
      fileUtils.saveCase(caseId, caseData);
    }

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('referrals').updateOne({ referralId }, { $set: referral }, { upsert: true });
      await db.collection('cases').updateOne({ caseId }, { $set: { status: 'REFERRED', assignedDoctorId: targetDoctorId, assistantId: referral.assistantId } });
    }

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'REFERRED_TO_DOCTOR',
      title: 'Referred to Doctor',
      description: `Case referred to ${referral.doctorName} (Risk Level: ${(riskLevel || 'medium').toUpperCase()})`,
      actor: assistantId || 'Clinic Assistant',
      actorRole: 'assistant'
    });

    // Notify Doctor
    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'doctor',
      recipientId: doctorId,
      patientId,
      caseId,
      type: 'NEW REFERRAL',
      title: `🚨 ${riskLevel === 'high' ? 'HIGH RISK' : 'NEW'} Referral Received`,
      message: `Patient ${patientId} referred for ${referral.reason}`,
      createdAt,
      read: false,
      priority: riskLevel === 'high' ? 'HIGH' : 'MEDIUM'
    });

    return res.status(201).json({
      success: true,
      referralId,
      data: referral
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function listReferrals(req, res) {
  try {
    const { doctorId, status, assistantId } = req.query;
    let referrals = [];

    if (isDbConnected()) {
      const db = getDb();
      const query = {};
      if (doctorId) query.doctorId = doctorId;
      if (assistantId) query.assistantId = assistantId;
      if (status) query.status = { $regex: new RegExp(`^${status}$`, 'i') };

      referrals = await db.collection('referrals').find(query).toArray();
    }

    if (!referrals || referrals.length === 0) {
      referrals = fileUtils.listReferrals();
      if (doctorId) referrals = referrals.filter(r => r.doctorId === doctorId);
      if (assistantId) referrals = referrals.filter(r => r.assistantId === assistantId);
      if (status) referrals = referrals.filter(r => r.status.toUpperCase() === status.toUpperCase());
    }

    // Enrich with patient profile, vitals, summary, case info
    const enriched = await Promise.all(referrals.map(async (r) => {
      let p = fileUtils.getPatient(r.patientId);
      let c = fileUtils.getCase(r.caseId);
      if (isDbConnected()) {
        const db = getDb();
        if (!p) p = await db.collection('patients').findOne({ patientId: r.patientId });
        if (!c) c = await db.collection('cases').findOne({ caseId: r.caseId });
      }

      const s = fileUtils.getPatientSummary(r.patientId);
      const v = fileUtils.getPatientVitals(r.patientId);

      return {
        ...r,
        patientName: p ? p.name : 'Patient',
        patientAge: p ? p.age : '30',
        patientSex: p ? p.sex : 'Male',
        vitals: v || (c ? c.vitals : {}),
        aiSummary: s || r.aiSummary || null,
        caseStatus: c ? c.status : r.status
      };
    }));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function acceptReferral(req, res) {
  try {
    const { referralId } = req.params;
    let referral = fileUtils.getReferral(referralId);

    if (!referral && isDbConnected()) {
      const db = getDb();
      referral = await db.collection('referrals').findOne({ referralId });
    }

    if (!referral) {
      return res.status(404).json({ success: false, error: `Referral not found: ${referralId}` });
    }

    const acceptedAt = new Date().toISOString();
    referral.status = 'ACCEPTED';
    referral.acceptedAt = acceptedAt;
    fileUtils.saveReferral(referral);

    const caseData = fileUtils.getCase(referral.caseId);
    if (caseData) {
      caseData.status = 'IN_CONSULTATION';
      caseData.assignedDoctorId = referral.doctorId;
      fileUtils.saveCase(referral.caseId, caseData);
    }

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('referrals').updateOne({ referralId }, { $set: { status: 'ACCEPTED', acceptedAt } });
      await db.collection('cases').updateOne({ caseId: referral.caseId }, { $set: { status: 'IN_CONSULTATION', assignedDoctorId: referral.doctorId } });
    }

    fileUtils.addCaseTimelineEvent(referral.caseId, {
      type: 'DOCTOR_ACCEPTED',
      title: 'Doctor Accepted Referral',
      description: `Referral accepted by ${referral.doctorName || 'Doctor'}. Consultation initiated.`,
      actor: referral.doctorName || 'Doctor',
      actorRole: 'doctor'
    });

    // Notify Assistant
    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'assistant',
      recipientId: referral.assistantId || 'ASSISTANT_DEFAULT',
      patientId: referral.patientId,
      caseId: referral.caseId,
      type: 'PATIENT UPDATE',
      title: '✅ Referral Accepted',
      message: `${referral.doctorName} has accepted referral for patient ${referral.patientId}`,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'MEDIUM'
    });

    return res.status(200).json({
      success: true,
      data: referral
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  createReferral,
  listReferrals,
  acceptReferral
};
