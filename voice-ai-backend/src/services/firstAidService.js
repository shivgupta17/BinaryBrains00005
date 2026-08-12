const patientContextService = require('./patientContextService');
const protocolLibrary = require('./protocolLibrary');

async function getFirstAidProtocolForPatient(patientId) {
  const context = patientContextService.getPatientContext(patientId);

  const matchedProtocol = protocolLibrary.matchProtocolForContext(context);

  if (!matchedProtocol) {
    console.log(`[FirstAidService] No applicable protocol match for patient ${patientId}`);
    return {
      patientId,
      matched: false,
      message: 'No applicable first-aid protocol identified for this case.',
      problemSummary: context.aiSummary?.summary || context.voiceIntake?.transcription?.english || 'No symptoms reported.',
      vitals: context.vitals || {}
    };
  }

  console.log(`[FirstAidService] Matched approved protocol ${matchedProtocol.protocolId} (${matchedProtocol.title}) for patient ${patientId}`);

  return {
    patientId,
    matched: true,
    problem: {
      identified: context.voiceIntake?.aiAnalysis?.clientProblem?.identifiedProblem || context.aiSummary?.reportedProblems?.[0] || matchedProtocol.category.toUpperCase(),
      summary: context.aiSummary?.summary || context.voiceIntake?.transcription?.english || 'Patient assessment completed.'
    },
    protocol: {
      protocolId: matchedProtocol.protocolId,
      title: matchedProtocol.title,
      category: matchedProtocol.category,
      source: matchedProtocol.source,
      version: matchedProtocol.version,
      retrieved: true
    },
    steps: matchedProtocol.steps,
    redFlags: matchedProtocol.redFlags,
    escalationCriteria: matchedProtocol.escalationCriteria,
    allowedMedications: matchedProtocol.allowedMedications || [],
    sourceInfo: 'Retrieved directly from approved MoHFW / ASHA Clinical Protocol Library'
  };
}

module.exports = {
  getFirstAidProtocolForPatient
};
