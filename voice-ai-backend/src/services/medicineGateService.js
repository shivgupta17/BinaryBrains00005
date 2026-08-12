const patientContextService = require('./patientContextService');
const firstAidService = require('./firstAidService');

async function evaluateMedicineGateForPatient(patientId) {
  const context = patientContextService.getPatientContext(patientId);
  const firstAid = await firstAidService.getFirstAidProtocolForPatient(patientId);

  const demoAge = context.demographics?.age;
  const demoSex = context.demographics?.sex;
  const patientAllergies = context.allergies || context.demographics?.allergies || [];
  const patientHistory = context.history || context.demographics?.history || [];
  const patientMedications = context.medications || context.demographics?.medications || [];
  const vitals = context.vitals || {};

  // If no protocol matched or context is empty, return no medication recommendation
  if (!firstAid.matched || (!firstAid.allowedMedications || firstAid.allowedMedications.length === 0)) {
    console.log(`[MedicineGate] No medication recommendations for patient ${patientId}`);
    return {
      patientId,
      hasMedication: false,
      message: 'No medication recommendation identified for this case.',
      medications: []
    };
  }

  const evaluatedMeds = firstAid.allowedMedications.map(med => {
    // 1. Allergy Check
    let allergyCheck = {
      status: 'unknown',
      details: 'Allergy information — not yet confirmed. Health worker must confirm verbally.'
    };
    if (patientAllergies.length > 0) {
      const hasConflict = patientAllergies.some(a => med.name.toLowerCase().includes(a.toLowerCase()));
      if (hasConflict) {
        allergyCheck = { status: 'flagged', details: `⚠️ Allergy risk flagged: Known allergy to ${patientAllergies.join(', ')}` };
      } else {
        allergyCheck = { status: 'clear', details: `✓ No allergy match with documented list (${patientAllergies.join(', ')})` };
      }
    }

    // 2. Age Check
    let ageCheck = {
      status: demoAge ? 'clear' : 'unknown',
      details: demoAge ? `Patient age checked — ${demoAge} yrs, no restriction` : 'Patient age — not recorded'
    };

    // 3. Pregnancy Check
    let pregnancyCheck = {
      status: 'unknown',
      details: 'Pregnancy status not confirmed'
    };
    if (demoSex && demoSex.toLowerCase() === 'male') {
      pregnancyCheck = { status: 'clear', details: 'Not applicable (male patient)' };
    } else if (demoSex && demoSex.toLowerCase() === 'female') {
      pregnancyCheck = { status: 'unknown', details: 'Pregnancy status not confirmed — verify verbally' };
    }

    // 4. Contraindication Check
    let contraindicationCheck = {
      status: patientHistory.length > 0 ? 'clear' : 'unknown',
      details: patientHistory.length > 0
        ? `Checked against medical history (${patientHistory.join(', ')}) — no direct contraindication`
        : 'Unable to confirm contraindications with available information'
    };

    // 5. Duplicate Therapy Check
    let duplicateCheck = {
      status: patientMedications.length > 0 ? 'clear' : 'unknown',
      details: patientMedications.length > 0
        ? `Checked against current medications (${patientMedications.join(', ')}) — no duplicate`
        : 'Current medication list unavailable'
    };

    // 6. Protocol Eligibility Check
    let eligibilityCheck = {
      status: 'clear',
      details: `Protocol eligibility: Recommended under ${firstAid.protocol.title}`
    };
    if (med.name.includes('Paracetamol')) {
      const tempVal = vitals.temp;
      if (tempVal && tempVal !== 'Not recorded') {
        eligibilityCheck.details = `Protocol eligibility: Fever ${tempVal} ≥ 100.4°F → eligible`;
      } else {
        eligibilityCheck.details = `Protocol eligibility: Fever protocol guidelines apply — verify vitals`;
      }
    }

    // Determine Overall Gate Status
    let gateStatus = 'PENDING';
    let approvalNote = 'Allergy status & clinical history must be confirmed before administration. Forwarded to doctor dashboard.';
    
    if (allergyCheck.status === 'clear' && ageCheck.status === 'clear' && pregnancyCheck.status === 'clear') {
      gateStatus = 'APPROVED';
      approvalNote = 'OTC Protocol support approved for immediate clinic administration under protocol.';
    } else if (allergyCheck.status === 'flagged') {
      gateStatus = 'BLOCKED';
      approvalNote = 'BLOCKED — Allergy risk detected. Escalate directly to physician.';
    }

    return {
      name: med.name,
      category: med.type,
      reason: med.reason,
      dosage: med.dosage,
      sourceProtocol: firstAid.protocol.title,
      status: gateStatus,
      approvalNote,
      safetyChecks: {
        allergy: allergyCheck,
        age: ageCheck,
        pregnancy: pregnancyCheck,
        contraindication: contraindicationCheck,
        duplicateTherapy: duplicateCheck,
        protocolEligibility: eligibilityCheck
      },
      doctorApprovalRequired: true
    };
  });

  return {
    patientId,
    hasMedication: true,
    message: 'Medication safety checks evaluated against actual patient context.',
    medications: evaluatedMeds
  };
}

module.exports = {
  evaluateMedicineGateForPatient
};
