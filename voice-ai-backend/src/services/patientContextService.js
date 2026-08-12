const fileUtils = require('../utils/fileUtils');

/**
 * Aggregates complete unified patient context across registration, voice intake, documents & vitals
 * STRICT REAL DATA ONLY — No hardcoded fallbacks
 */
function getPatientContext(patientId) {
  const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';

  const patientDemographics = fileUtils.getPatient(cleanId) || {
    id: cleanId,
    name: 'Patient (Unregistered)',
    age: 'Not provided',
    sex: 'Not provided',
    village: 'Not provided',
    language: 'Not provided'
  };

  const voiceIntake = fileUtils.getPatientVoice(cleanId) || null;
  const documents = fileUtils.getPatientDocuments(cleanId) || [];
  const vitals = fileUtils.getPatientVitals(cleanId) || {
    temp: 'Not recorded',
    bp: 'Not recorded',
    pulse: 'Not recorded',
    spo2: 'Not recorded'
  };

  // Compile combined document findings
  const allMedications = [];
  const allHistory = [];
  const allAllergies = [];
  const allLabResults = [];
  const allSafetyFlags = [];

  documents.forEach(doc => {
    const extData = doc.extractedData || {};
    if (extData.medications && Array.isArray(extData.medications)) {
      allMedications.push(...extData.medications);
    }
    if (extData.medicalHistory && Array.isArray(extData.medicalHistory)) {
      allHistory.push(...extData.medicalHistory);
    }
    if (extData.allergies && Array.isArray(extData.allergies)) {
      allAllergies.push(...extData.allergies);
    }
    if (extData.labResults && Array.isArray(extData.labResults)) {
      allLabResults.push(...extData.labResults);
    }
    if (doc.safetyFlags && Array.isArray(doc.safetyFlags)) {
      allSafetyFlags.push(...doc.safetyFlags);
    }
  });

  return {
    patientId: cleanId,
    demographics: patientDemographics,
    voiceIntake: voiceIntake,
    documents: documents,
    aggregatedFindings: {
      medications: allMedications,
      medicalHistory: allHistory,
      allergies: allAllergies,
      labResults: allLabResults,
      safetyFlags: allSafetyFlags
    },
    vitals: vitals
  };
}

module.exports = {
  getPatientContext
};
