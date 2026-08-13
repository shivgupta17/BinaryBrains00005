const fileUtils = require('../utils/fileUtils');
const { getDb, isDbConnected } = require('../config/db');
const idGen = require('../utils/idGenerator');

/**
 * Doctor Referral Controller
 */
async function createReferral(req, res) {
  try {
    const { patientId, caseId, doctorId, assistantId, riskLevel, reason, aiSummary } = req.body;
    if (!patientId || !doctorId) {
      return res.status(400).json({ success: false, error: 'patientId and doctorId are required' });
    }

    const cleanDoctorId = doctorId.trim();

    // Verify Doctor Existence in MongoDB Atlas or local file storage
    let doctorDoc = null;
    if (isDbConnected()) {
      const db = getDb();
      const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.:\\^$|#\s]/g, '\\$&');
      const searchRegex = new RegExp(`^${escapeRegex(cleanDoctorId)}$`, 'i');

      const queryOr = [
        { doctorId: searchRegex },
        { doctorId: cleanDoctorId.toUpperCase() },
        { userId: searchRegex },
        { email: searchRegex },
        { email: cleanDoctorId.toLowerCase() }
      ];

      doctorDoc = await db.collection('doctors').findOne({ $or: queryOr });
      if (!doctorDoc) {
        doctorDoc = await db.collection('users').findOne({
          role: 'doctor',
          $or: queryOr
        });
      }
    }

    if (!doctorDoc) {
      doctorDoc = fileUtils.getDoctor(cleanDoctorId) || fileUtils.getDoctor(cleanDoctorId.toUpperCase());
    }

    if (!doctorDoc) {
      return res.status(404).json({ success: false, error: `Doctor not found for ID: ${cleanDoctorId}` });
    }

    const targetDoctorId = doctorDoc.doctorId || cleanDoctorId;
    const referralId = idGen.generateReferralId();
    const createdAt = new Date().toISOString();
    const cleanPatientId = patientId.trim();
    let targetCaseId = caseId ? caseId.trim() : null;

    // Ensure a REAL case document exists in MongoDB Atlas for this patientId
    let caseData = null;
    if (isDbConnected()) {
      const db = getDb();
      if (targetCaseId && !targetCaseId.startsWith('CASE_PAT_')) {
        caseData = await db.collection('cases').findOne({ caseId: targetCaseId });
      }

      if (!caseData) {
        // Search for open/referred case by patientId
        caseData = await db.collection('cases').findOne({
          patientId: cleanPatientId,
          status: { $in: ['OPEN', 'REFERRED', 'IN_CONSULTATION'] }
        });
      }

      if (caseData) {
        targetCaseId = caseData.caseId;
      } else {
        // Create a real case document in cases collection in MongoDB Atlas
        targetCaseId = idGen.generateCaseId();
        caseData = {
          caseId: targetCaseId,
          patientId: cleanPatientId,
          assistantId: (assistantId || 'ASSISTANT_DEFAULT').trim(),
          assignedDoctorId: targetDoctorId,
          caseType: 'General Referral Encounter',
          status: 'REFERRED',
          createdAt,
          vitals: {},
          aiSummary: aiSummary || null,
          timeline: [{
            eventId: `evt_${Date.now()}`,
            type: 'CASE_CREATED',
            title: 'Encounter Case Created',
            description: 'New clinical encounter created for doctor referral.',
            timestamp: createdAt,
            actor: assistantId || 'Clinic Assistant'
          }]
        };
        await db.collection('cases').insertOne(caseData);
      }
    }

    if (!caseData) {
      caseData = fileUtils.getCase(targetCaseId) || fileUtils.getCase(patientId);
    }

    const referral = {
      referralId,
      patientId: cleanPatientId,
      caseId: targetCaseId,
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
      fileUtils.saveCase(targetCaseId, caseData);
    }

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('referrals').updateOne({ referralId }, { $set: referral }, { upsert: true });
      await db.collection('cases').updateOne({ caseId: targetCaseId }, { $set: { status: 'REFERRED', assignedDoctorId: targetDoctorId, assistantId: referral.assistantId } });
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

async function getDoctorReferrals(req, res) {
  try {
    const docId = req.user?.doctorId || req.user?.userId || req.query.doctorId;
    if (!docId) {
      return res.status(400).json({ success: false, error: 'Doctor ID missing from authenticated user session.' });
    }

    const cleanDocId = docId.trim();
    const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.:\\^$|#\s]/g, '\\$&');
    const docRegex = new RegExp(`^${escapeRegex(cleanDocId)}$`, 'i');

    let referrals = [];
    if (isDbConnected()) {
      const db = getDb();
      referrals = await db.collection('referrals').find({
        $or: [
          { doctorId: docRegex },
          { doctorId: cleanDocId.toUpperCase() }
        ]
      }).sort({ createdAt: -1 }).toArray();
    }

    if (!referrals || referrals.length === 0) {
      referrals = fileUtils.listReferrals().filter(r => 
        r.doctorId && (r.doctorId.toLowerCase() === cleanDocId.toLowerCase() || r.doctorId === cleanDocId.toUpperCase())
      );
    }

    const enriched = await Promise.all(referrals.map(async (r) => {
      let p = null;
      let c = null;
      if (isDbConnected()) {
        const db = getDb();
        p = await db.collection('patients').findOne({ $or: [{ patientId: r.patientId }, { userId: r.patientId }] });
        if (!p) {
          p = await db.collection('users').findOne({ role: 'patient', $or: [{ patientId: r.patientId }, { userId: r.patientId }] });
        }
        c = await db.collection('cases').findOne({ caseId: r.caseId });
      }

      if (!p) p = fileUtils.getPatient(r.patientId);
      if (!c) c = fileUtils.getCase(r.caseId);

      const s = fileUtils.getPatientSummary(r.patientId);
      const v = fileUtils.getPatientVitals(r.patientId);

      return {
        ...r,
        patientName: p ? p.name : 'Patient',
        patientAge: p ? p.age : '30',
        patientSex: p ? p.sex : 'Male',
        village: p ? p.village : 'Rajpur',
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

async function listReferrals(req, res) {
  try {
    const doctorId = req.query.doctorId || (req.user?.role === 'doctor' ? (req.user.doctorId || req.user.userId) : null);
    const assistantId = req.query.assistantId || (req.user?.role === 'assistant' ? (req.user.assistantId || req.user.userId) : null);
    const { status } = req.query;

    let referrals = [];
    const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.:\\^$|#\s]/g, '\\$&');

    if (isDbConnected()) {
      const db = getDb();
      const query = {};
      if (doctorId) {
        const dReg = new RegExp(`^${escapeRegex(doctorId.trim())}$`, 'i');
        query.$or = [{ doctorId: dReg }, { doctorId: doctorId.trim().toUpperCase() }];
      }
      if (assistantId) {
        const aReg = new RegExp(`^${escapeRegex(assistantId.trim())}$`, 'i');
        query.assistantId = { $in: [aReg, assistantId.trim().toUpperCase()] };
      }
      if (status) {
        query.status = { $regex: new RegExp(`^${status}$`, 'i') };
      }

      referrals = await db.collection('referrals').find(query).sort({ createdAt: -1 }).toArray();
    }

    if (!referrals || referrals.length === 0) {
      referrals = fileUtils.listReferrals();
      if (doctorId) {
        referrals = referrals.filter(r => r.doctorId && r.doctorId.toLowerCase() === doctorId.trim().toLowerCase());
      }
      if (assistantId) {
        referrals = referrals.filter(r => r.assistantId && r.assistantId.toLowerCase() === assistantId.trim().toLowerCase());
      }
      if (status) {
        referrals = referrals.filter(r => r.status.toUpperCase() === status.toUpperCase());
      }
    }

    // Enrich with patient profile, vitals, summary, case info
    const enriched = await Promise.all(referrals.map(async (r) => {
      let p = null;
      let c = null;
      if (isDbConnected()) {
        const db = getDb();
        p = await db.collection('patients').findOne({ $or: [{ patientId: r.patientId }, { userId: r.patientId }] });
        if (!p) {
          p = await db.collection('users').findOne({ role: 'patient', $or: [{ patientId: r.patientId }, { userId: r.patientId }] });
        }
        c = await db.collection('cases').findOne({ caseId: r.caseId });
      }

      if (!p) p = fileUtils.getPatient(r.patientId);
      if (!c) c = fileUtils.getCase(r.caseId);

      const s = fileUtils.getPatientSummary(r.patientId);
      const v = fileUtils.getPatientVitals(r.patientId);

      return {
        ...r,
        patientName: p ? p.name : 'Patient',
        patientAge: p ? p.age : '30',
        patientSex: p ? p.sex : 'Male',
        village: p ? p.village : 'Rajpur',
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
  getDoctorReferrals,
  listReferrals,
  acceptReferral
};
