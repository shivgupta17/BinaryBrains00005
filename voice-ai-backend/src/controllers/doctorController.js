const fileUtils = require('../utils/fileUtils');
const patientContextService = require('../services/patientContextService');

/**
 * Doctor Directory & Decision Controller
 */
async function getAvailableDoctors(req, res) {
  try {
    const { specialty } = req.query;
    let doctors = fileUtils.listDoctors();

    if (specialty) {
      doctors = doctors.filter(d => d.specialty.toLowerCase().includes(specialty.toLowerCase()));
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
    const { ward, room, bed, doctorId, notes } = req.body;

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const bedAssignment = {
      ward: ward || 'Emergency Ward',
      room: room || 'Room 12',
      bed: bed || 'Bed B',
      assignedBy: doctorId || 'DOC_01',
      assignedAt: new Date().toISOString(),
      notes: notes || 'Admitted for observation'
    };

    caseData.bedAssignment = bedAssignment;
    fileUtils.saveCase(caseId, caseData);

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

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const scheduleId = `sched_${Date.now()}`;
    const scheduleData = {
      scheduleId,
      caseId,
      patientId: caseData.patientId,
      medicationName: medicationName || 'Paracetamol',
      dose: dose || '500mg',
      times: times || ['08:00', '14:00', '20:00'],
      status: 'ACTIVE',
      createdBy: doctorId || 'DOC_01',
      createdAt: new Date().toISOString()
    };

    fileUtils.saveSchedule(scheduleData);

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
      setBy: doctorId || 'DOC_01',
      createdAt: new Date().toISOString()
    };

    caseData.followUp = followUp;
    fileUtils.saveCase(caseId, caseData);

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

module.exports = {
  getAvailableDoctors,
  updateDoctorStatus,
  approveMedication,
  assignBed,
  scheduleMedicationTimes,
  setFollowUp
};
