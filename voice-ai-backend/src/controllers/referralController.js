const fileUtils = require('../utils/fileUtils');

/**
 * Doctor Referral Controller
 */
async function createReferral(req, res) {
  try {
    const { patientId, caseId, doctorId, assistantId, riskLevel, reason } = req.body;
    if (!patientId || !caseId || !doctorId) {
      return res.status(400).json({ success: false, error: 'patientId, caseId, and doctorId are required' });
    }

    const referralId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const createdAt = new Date().toISOString();

    const doctor = fileUtils.getDoctor(doctorId);
    const caseData = fileUtils.getCase(caseId);

    const referral = {
      referralId,
      patientId,
      caseId,
      doctorId,
      doctorName: doctor ? doctor.name : 'Attending Doctor',
      assistantId: assistantId || 'ASSISTANT_DEFAULT',
      riskLevel: riskLevel || 'medium',
      reason: reason || 'Clinical evaluation requested by clinic assistant',
      status: 'NEW',
      createdAt,
      acceptedAt: null
    };

    fileUtils.saveReferral(referral);

    if (caseData) {
      caseData.status = 'REFERRED';
      caseData.assignedDoctorId = doctorId;
      fileUtils.saveCase(caseId, caseData);
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
    const { doctorId, status } = req.query;
    let referrals = fileUtils.listReferrals();

    if (doctorId) {
      referrals = referrals.filter(r => r.doctorId === doctorId);
    }
    if (status) {
      referrals = referrals.filter(r => r.status.toUpperCase() === status.toUpperCase());
    }

    // Attach patient demographics & case context to each referral
    const enriched = referrals.map(r => {
      const p = fileUtils.getPatient(r.patientId);
      const c = fileUtils.getCase(r.caseId);
      const s = fileUtils.getPatientSummary(r.patientId);
      const v = fileUtils.getPatientVitals(r.patientId);
      return {
        ...r,
        patientName: p ? p.name : 'Patient',
        patientAge: p ? p.age : 'N/A',
        patientSex: p ? p.sex : 'N/A',
        vitals: v || {},
        aiSummary: s || null,
        caseStatus: c ? c.status : 'OPEN'
      };
    });

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
    const referral = fileUtils.getReferral(referralId);

    if (!referral) {
      return res.status(404).json({ success: false, error: `Referral not found: ${referralId}` });
    }

    referral.status = 'ACCEPTED';
    referral.acceptedAt = new Date().toISOString();
    fileUtils.saveReferral(referral);

    const caseData = fileUtils.getCase(referral.caseId);
    if (caseData) {
      caseData.status = 'IN_CONSULTATION';
      fileUtils.saveCase(referral.caseId, caseData);
    }

    fileUtils.addCaseTimelineEvent(referral.caseId, {
      type: 'DOCTOR_ACCEPTED',
      title: 'Doctor Accepted Referral',
      description: `Referral accepted by ${referral.doctorName}. Consultation initiated.`,
      actor: referral.doctorName,
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
