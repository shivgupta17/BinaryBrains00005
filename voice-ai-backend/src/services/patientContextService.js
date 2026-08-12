const fileUtils = require('../utils/fileUtils');

/**
 * Aggregates complete unified patient case context (patientId + caseId)
 * MULTIMODAL: Demographics, Vitals, Voice, Text, Images, Videos, Documents OCR, History, Allergies
 */
function getPatientCaseContext(patientId, caseId = null) {
  const cleanPatientId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
  const cleanCaseId    = fileUtils.sanitizeId(caseId) || `CASE_${cleanPatientId}`;

  // 1. Patient Demographics
  const patientDemographics = fileUtils.getPatient(cleanPatientId) || {
    id: cleanPatientId,
    name: 'Patient (Unregistered)',
    age: 'Not provided',
    sex: 'Not provided',
    village: 'Not provided',
    language: 'Not provided'
  };

  // 2. Case Object
  let caseObj = fileUtils.getCase(cleanCaseId);
  if (!caseObj) {
    caseObj = {
      caseId: cleanCaseId,
      patientId: cleanPatientId,
      createdAt: new Date().toISOString(),
      status: 'OPEN',
      assignedDoctorId: null,
      bedAssignment: null,
      followUp: null
    };
  }

  // 3. Clinical Data
  const voiceIntake = fileUtils.getPatientVoice(cleanPatientId) || null;
  const documents   = fileUtils.getPatientDocuments(cleanPatientId) || [];
  const vitals      = fileUtils.getPatientVitals(cleanPatientId) || {
    temp: 'Not recorded',
    bp: 'Not recorded',
    pulse: 'Not recorded',
    spo2: 'Not recorded'
  };

  // Aggregated Document & Multimodal findings
  const allMedications = [];
  const allHistory = [];
  const allAllergies = [];
  const allLabResults = [];
  const allSafetyFlags = [];
  const textStatements = caseObj.textStatements || [];
  const imageUploads   = caseObj.imageUploads || [];
  const videoUploads   = caseObj.videoUploads || [];

  documents.forEach(doc => {
    const extData = doc.extractedData || {};
    if (extData.medications && Array.isArray(extData.medications)) allMedications.push(...extData.medications);
    if (extData.medicalHistory && Array.isArray(extData.medicalHistory)) allHistory.push(...extData.medicalHistory);
    if (extData.allergies && Array.isArray(extData.allergies)) allAllergies.push(...extData.allergies);
    if (extData.labResults && Array.isArray(extData.labResults)) allLabResults.push(...extData.labResults);
    if (doc.safetyFlags && Array.isArray(doc.safetyFlags)) allSafetyFlags.push(...doc.safetyFlags);
  });

  return {
    patientId: cleanPatientId,
    caseId: cleanCaseId,
    patient: patientDemographics,
    demographics: patientDemographics,
    case: caseObj,
    currentVitals: vitals,
    vitals: vitals,
    voice: voiceIntake,
    voiceIntake: voiceIntake,
    text: textStatements,
    images: imageUploads,
    videos: videoUploads,
    documents: documents,
    aggregatedFindings: {
      medications: allMedications,
      medicalHistory: allHistory,
      allergies: allAllergies,
      labResults: allLabResults,
      safetyFlags: allSafetyFlags
    },
    medicalHistory: allHistory,
    currentMedications: allMedications,
    allergies: allAllergies,
    doctorNotes: caseObj.doctorNotes || [],
    assistantNotes: caseObj.assistantNotes || [],
    timeline: fileUtils.getCaseTimeline(cleanCaseId)
  };
}

function getPatientContext(patientId) {
  return getPatientCaseContext(patientId, null);
}

module.exports = {
  getPatientCaseContext,
  getPatientContext
};
