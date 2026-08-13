const fileUtils = require('../utils/fileUtils');
const { getDb, isDbConnected } = require('../config/db');

/**
 * Aggregates complete unified patient case context (patientId + caseId)
 * MULTIMODAL: Demographics, Vitals, Voice, Text, Images, Videos, Documents OCR, History, Allergies
 */
async function getPatientCaseContext(patientId, caseId = null) {
  const cleanPatientId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
  const cleanCaseId    = fileUtils.sanitizeId(caseId) || `CASE_${cleanPatientId}`;

  let patientDemographics = null;
  let caseObj = null;
  let voiceIntake = null;
  let summaryData = null;
  let triageData = null;
  let documents = [];
  let vitals = null;

  if (isDbConnected()) {
    const db = getDb();
    
    // 1. Demographics
    patientDemographics = await db.collection('patients').findOne({
      $or: [{ patientId: cleanPatientId }, { userId: cleanPatientId }]
    });
    if (!patientDemographics) {
      patientDemographics = await db.collection('users').findOne({
        role: 'patient',
        $or: [{ patientId: cleanPatientId }, { userId: cleanPatientId }]
      });
    }

    // 2. Case
    caseObj = await db.collection('cases').findOne({
      $or: [{ caseId: cleanCaseId }, { patientId: cleanPatientId }]
    });

    // 3. Voice Intake
    voiceIntake = await db.collection('voice').findOne({
      $or: [{ caseId: cleanCaseId }, { patientId: cleanPatientId }]
    });

    // 4. Documents
    documents = await db.collection('documents').find({
      $or: [{ caseId: cleanCaseId }, { patientId: cleanPatientId }]
    }).toArray();
  }

  // Fallbacks from fileUtils
  if (!patientDemographics) {
    patientDemographics = fileUtils.getPatient(cleanPatientId) || {};
  }
  if (!caseObj) {
    caseObj = fileUtils.getCase(cleanCaseId) || {};
  }
  if (!voiceIntake) {
    voiceIntake = fileUtils.getPatientVoice(cleanPatientId) || null;
  }
  if (!documents || documents.length === 0) {
    documents = fileUtils.getPatientDocuments(cleanPatientId) || [];
  }
  if (!vitals) {
    vitals = (caseObj && caseObj.vitals) || fileUtils.getPatientVitals(cleanPatientId) || {
      temp: 'Not recorded',
      bp: 'Not recorded',
      pulse: 'Not recorded',
      spo2: 'Not recorded'
    };
  }

  // Ensure demographics object has patientId field
  patientDemographics = {
    patientId: patientDemographics.patientId || cleanPatientId,
    name: patientDemographics.name || 'Patient',
    age: patientDemographics.age || 30,
    sex: patientDemographics.sex || 'Male',
    village: patientDemographics.village || 'Rajpur',
    language: patientDemographics.language || 'Hindi',
    pastHistory: patientDemographics.pastHistory || 'Not recorded',
    allergies: patientDemographics.allergies || 'Not recorded'
  };

  caseObj = {
    caseId: caseObj.caseId || cleanCaseId,
    patientId: caseObj.patientId || cleanPatientId,
    status: caseObj.status || 'OPEN',
    caseType: caseObj.caseType || 'General Consultation',
    textStatements: caseObj.textStatements || [],
    imageUploads: caseObj.imageUploads || [],
    videoUploads: caseObj.videoUploads || [],
    doctorNotes: caseObj.doctorNotes || [],
    assistantNotes: caseObj.assistantNotes || [],
    timeline: caseObj.timeline || fileUtils.getCaseTimeline(cleanCaseId) || []
  };

  // Extract AI summary & Triage from caseObj or voiceIntake
  summaryData = caseObj.aiSummary || (voiceIntake && voiceIntake.aiSummary) || fileUtils.getPatientSummary(cleanPatientId) || {
    summary: 'Clinical evaluation packet loaded. Ready for doctor assessment.',
    mainProblem: { summary: 'Clinical evaluation packet loaded. Ready for doctor assessment.' }
  };

  triageData = caseObj.triage || (voiceIntake && voiceIntake.triage) || {
    level: 'amber',
    rationale: 'Physician review requested based on clinical symptoms.',
    recommendedAction: 'Physician review and prescription'
  };

  // Aggregated Document & Multimodal findings
  const allMedications = [];
  const allHistory = [];
  const allAllergies = [];
  const allLabResults = [];
  const allSafetyFlags = [];

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
    caseId: caseObj.caseId,
    patient: patientDemographics,
    demographics: patientDemographics,
    case: caseObj,
    currentVitals: vitals,
    vitals: vitals,
    voice: voiceIntake,
    voiceIntake: voiceIntake,
    aiSummary: summaryData,
    triage: triageData,
    text: caseObj.textStatements,
    images: caseObj.imageUploads,
    videos: caseObj.videoUploads,
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
    doctorNotes: caseObj.doctorNotes,
    assistantNotes: caseObj.assistantNotes,
    timeline: caseObj.timeline
  };
}

async function getPatientContext(patientId) {
  return await getPatientCaseContext(patientId, null);
}

module.exports = {
  getPatientCaseContext,
  getPatientContext
};
