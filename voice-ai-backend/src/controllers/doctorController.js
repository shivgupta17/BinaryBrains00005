const fileUtils = require('../utils/fileUtils');
const patientContextService = require('../services/patientContextService');
const { getDb, isDbConnected } = require('../config/db');

/**
 * Doctor Directory & Decision Controller
 */
async function getAvailableDoctors(req, res) {
  try {
    const { specialty } = req.query;
    let doctors = [];

    if (isDbConnected()) {
      const db = getDb();
      const query = specialty ? { specialty: { $regex: specialty, $options: 'i' } } : {};
      doctors = await db.collection('doctors').find(query).toArray();
    }

    if (!doctors || doctors.length === 0) {
      doctors = fileUtils.listDoctors();
      if (specialty) {
        doctors = doctors.filter(d => d.specialty.toLowerCase().includes(specialty.toLowerCase()));
      }
    }

    return res.status(200).json({
      success: true,
      count: doctors.length,
      data: doctors
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getDoctorById(req, res) {
  try {
    const { doctorId } = req.params;
    const cleanId = (doctorId || '').trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'Doctor ID parameter is required.' });
    }

    let doctor = null;
    if (isDbConnected()) {
      const db = getDb();
      const escapeRegex = (str) => str.replace(/[-[\]{}()*+?.:\\^$|#\s]/g, '\\$&');
      const searchRegex = new RegExp(`^${escapeRegex(cleanId)}$`, 'i');

      const queryOr = [
        { doctorId: searchRegex },
        { doctorId: cleanId.toUpperCase() },
        { userId: searchRegex },
        { email: searchRegex },
        { email: cleanId.toLowerCase() }
      ];

      doctor = await db.collection('doctors').findOne({ $or: queryOr });
      if (!doctor) {
        const user = await db.collection('users').findOne({
          role: 'doctor',
          $or: queryOr
        });
        if (user) {
          doctor = {
            doctorId: user.doctorId || cleanId.toUpperCase(),
            name: user.name,
            email: user.email,
            specialty: user.specialty || 'General Medicine',
            onlineStatus: user.onlineStatus || 'ONLINE'
          };
        }
      }
    }

    if (!doctor) {
      doctor = fileUtils.getDoctor(cleanId) || fileUtils.getDoctor(cleanId.toUpperCase());
    }

    if (!doctor) {
      return res.status(404).json({ success: false, error: `Doctor not found for ID: ${cleanId}` });
    }

    return res.status(200).json({
      success: true,
      data: {
        doctorId: doctor.doctorId || cleanId,
        name: doctor.name || 'Dr. Attending Doctor',
        specialty: doctor.specialty || 'General Medicine',
        onlineStatus: doctor.onlineStatus || 'ONLINE',
        isAvailable: doctor.onlineStatus !== 'OFFLINE'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function updateDoctorStatus(req, res) {
  try {
    const { doctorId } = req.params;
    const { onlineStatus } = req.body;

    const doctor = fileUtils.getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, error: `Doctor not found: ${doctorId}` });
    }

    doctor.onlineStatus = onlineStatus || 'ONLINE';
    fileUtils.saveDoctor(doctor);

    return res.status(200).json({
      success: true,
      data: doctor
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function approveMedication(req, res) {
  try {
    const { caseId } = req.params;
    const { doctorId, medications, doctorNote } = req.body;

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const approvedMeds = (medications || []).map(m => ({
      ...m,
      status: 'DOCTOR_APPROVED',
      approvedBy: doctorId || 'DOC_01',
      approvedAt: new Date().toISOString()
    }));

    caseData.approvedMedications = approvedMeds;
    if (doctorNote) {
      caseData.doctorNotes = caseData.doctorNotes || [];
      caseData.doctorNotes.push({
        noteId: `note_${Date.now()}`,
        doctorId: doctorId || 'DOC_01',
        text: doctorNote,
        createdAt: new Date().toISOString()
      });
    }

    fileUtils.saveCase(caseId, caseData);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('cases').updateOne(
        { caseId },
        { $set: { approvedMedications: approvedMeds, doctorNotes: caseData.doctorNotes || [] } }
      );
    }

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'MEDICATION_APPROVED',
      title: 'Doctor Approved Prescription',
      description: `Medications approved: ${approvedMeds.map(m => m.name).join(', ')}`,
      actor: doctorId || 'Dr. Aarav Sharma',
      actorRole: 'doctor'
    });

    // Notify Assistant
    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'assistant',
      recipientId: caseData.assistantId || 'ASSISTANT_DEFAULT',
      patientId: caseData.patientId,
      caseId,
      type: 'DOCTOR_MESSAGE',
      title: '💊 Medication Prescribed & Approved',
      message: `Doctor approved ${approvedMeds.length} medication(s) for patient ${caseData.patientId}`,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'HIGH'
    });

    return res.status(200).json({
      success: true,
      caseId,
      data: approvedMeds
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function assignBed(req, res) {
  try {
    const { caseId } = req.params;
    const { ward, room, bed, floor, department, doctorId, notes } = req.body;

    if (!ward || !ward.trim() || !room || !room.trim() || !bed || !bed.trim()) {
      return res.status(400).json({ success: false, error: 'Ward, Room, and Bed are required for hospital bed assignment.' });
    }

    let caseData = null;
    if (isDbConnected()) {
      const db = getDb();
      caseData = await db.collection('cases').findOne({ caseId });
    }
    if (!caseData) caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const docId = doctorId || req.user?.doctorId || req.user?.userId || 'Doctor';
    const bedAssignment = {
      bedAssignmentId: `bed_${Date.now()}`,
      ward: ward.trim(),
      room: room.trim(),
      bed: bed.trim(),
      floor: floor ? floor.trim() : '',
      department: department ? department.trim() : 'General Medicine',
      assignedBy: docId,
      assignedAt: new Date().toISOString(),
      notes: notes ? notes.trim() : ''
    };

    caseData.bedAssignment = bedAssignment;
    fileUtils.saveCase(caseId, caseData);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('cases').updateOne({ caseId }, { $set: { bedAssignment } });
      await db.collection('bedAssignments').insertOne({ caseId, patientId: caseData.patientId, doctorId: docId, assistantId: caseData.assistantId, ...bedAssignment });
    }

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'BED_ASSIGNED',
      title: 'Patient Bed Assigned',
      description: `${bedAssignment.ward} · ${bedAssignment.room} · ${bedAssignment.bed}`,
      actor: doctorId || 'Dr. Aarav Sharma',
      actorRole: 'doctor'
    });

    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'assistant',
      recipientId: caseData.assistantId || 'ASSISTANT_DEFAULT',
      patientId: caseData.patientId,
      caseId,
      type: 'BED_ASSIGNED',
      title: '🛏️ Bed Assigned',
      message: `Patient assigned to ${bedAssignment.ward}, ${bedAssignment.room}, ${bedAssignment.bed}`,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'HIGH'
    });

    return res.status(200).json({
      success: true,
      caseId,
      data: bedAssignment
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function scheduleMedicationTimes(req, res) {
  try {
    const { caseId } = req.params;
    const { medicationName, dose, times, doctorId } = req.body;

    if (!medicationName || !dose) {
      return res.status(400).json({ success: false, error: 'Medication name and dose are required to create a schedule.' });
    }

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const scheduleId = `sched_${Date.now()}`;
    const scheduleData = {
      scheduleId,
      caseId,
      patientId: caseData.patientId,
      medicationName: medicationName.trim(),
      dose: dose.trim(),
      times: times || ['08:00', '14:00', '20:00'],
      status: 'ACTIVE',
      createdBy: doctorId || 'Doctor',
      createdAt: new Date().toISOString()
    };

    fileUtils.saveSchedule(scheduleData);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('medicationSchedules').updateOne({ scheduleId: scheduleData.scheduleId }, { $set: scheduleData }, { upsert: true });
    }

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'MEDICATION_SCHEDULED',
      title: 'Medication Schedule Created',
      description: `${scheduleData.medicationName} (${scheduleData.dose}) scheduled at ${scheduleData.times.join(', ')}`,
      actor: doctorId || 'Dr. Aarav Sharma',
      actorRole: 'doctor'
    });

    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'assistant',
      recipientId: caseData.assistantId || 'ASSISTANT_DEFAULT',
      patientId: caseData.patientId,
      caseId,
      type: 'MEDICATION_DUE',
      title: '⏰ Medication Schedule Created',
      message: `${scheduleData.medicationName} scheduled at ${scheduleData.times.join(', ')}`,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'MEDIUM'
    });

    return res.status(200).json({
      success: true,
      data: scheduleData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function setFollowUp(req, res) {
  try {
    const { caseId } = req.params;
    const { followUpDate, followUpTime, reason, doctorId } = req.body;

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const followUp = {
      followUpDate: followUpDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      followUpTime: followUpTime || '10:00 AM',
      reason: reason || 'Review vitals and symptom recovery',
      setBy: doctorId || 'Doctor',
      createdAt: new Date().toISOString()
    };

    caseData.followUp = followUp;
    fileUtils.saveCase(caseId, caseData);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('cases').updateOne({ caseId }, { $set: { followUp } });
      await db.collection('followUps').insertOne({ caseId, patientId: caseData.patientId, ...followUp });
    }

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'FOLLOWUP_SCHEDULED',
      title: 'Follow-Up Scheduled',
      description: `Follow-up set for ${followUp.followUpDate} at ${followUp.followUpTime}`,
      actor: doctorId || 'Dr. Aarav Sharma',
      actorRole: 'doctor'
    });

    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'assistant',
      recipientId: caseData.assistantId || 'ASSISTANT_DEFAULT',
      patientId: caseData.patientId,
      caseId,
      type: 'FOLLOW-UP DUE',
      title: '📅 Follow-Up Scheduled',
      message: `Follow-up set for ${followUp.followUpDate} at ${followUp.followUpTime}`,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'LOW'
    });

    return res.status(200).json({
      success: true,
      caseId,
      data: followUp
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function sendInstruction(req, res) {
  try {
    const { caseId } = req.params;
    const { message, doctorId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Instruction message is required.' });
    }

    let caseData = null;
    if (isDbConnected()) {
      const db = getDb();
      caseData = await db.collection('cases').findOne({ caseId });
    }
    if (!caseData) caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const docId = doctorId || req.user?.doctorId || req.user?.userId || 'Doctor';
    const messageId = `msg_${Date.now()}`;
    const instructionObj = {
      messageId,
      caseId,
      patientId: caseData.patientId,
      doctorId: docId,
      assistantId: caseData.assistantId || 'ASSISTANT_DEFAULT',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'SENT'
    };

    if (!caseData.doctorInstructions) caseData.doctorInstructions = [];
    caseData.doctorInstructions.push(instructionObj);
    fileUtils.saveCase(caseId, caseData);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('cases').updateOne(
        { caseId },
        { $push: { doctorInstructions: instructionObj } }
      );
      await db.collection('doctorInstructions').insertOne(instructionObj);
    }

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'DOCTOR_INSTRUCTION_SENT',
      title: 'Doctor Instruction Sent',
      description: `Instruction: "${instructionObj.message}"`,
      actor: docId,
      actorRole: 'doctor'
    });

    fileUtils.saveNotification({
      notificationId: `notif_${Date.now()}`,
      recipientRole: 'assistant',
      recipientId: caseData.assistantId || 'ASSISTANT_DEFAULT',
      patientId: caseData.patientId,
      caseId,
      type: 'DOCTOR_INSTRUCTION',
      title: '📝 New Doctor Instruction',
      message: instructionObj.message,
      createdAt: new Date().toISOString(),
      read: false,
      priority: 'HIGH'
    });

    return res.status(200).json({
      success: true,
      data: instructionObj
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  getAvailableDoctors,
  getDoctorById,
  updateDoctorStatus,
  approveMedication,
  assignBed,
  scheduleMedicationTimes,
  setFollowUp,
  sendInstruction
};
