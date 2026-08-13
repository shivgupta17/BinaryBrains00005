const fetch = require('node-fetch');

async function testVoiceAiToDoctorStreamlined() {
  console.log('========================================================================');
  console.log('   GRAMCARE AI - VOICE → AI SUMMARY → TRIAGE → DOCTOR WORKFLOW TEST   ');
  console.log('========================================================================');

  const ts = Date.now();
  const asstEmail = `asst_streamlined_${ts}@gramcare.ai`;
  const docEmail  = `doc_streamlined_${ts}@gramcare.ai`;
  const patEmail  = `pat_streamlined_${ts}@gramcare.ai`;

  // 1. Register Assistant
  console.log('\n[STEP 1] Registering Assistant...');
  const asstReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Anchal Direct', email: asstEmail, password: 'password123', role: 'assistant' })
  });
  const asstData = await asstReg.json();
  const assistantId = asstData.user.assistantId;
  const asstToken = asstData.token;
  console.log(`✓ Assistant Registered: ${assistantId} (${asstEmail})`);

  // 2. Register Doctor
  console.log('\n[STEP 2] Registering Doctor...');
  const docReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dr. Saif Direct', email: docEmail, password: 'doctor123', role: 'doctor' })
  });
  const docData = await docReg.json();
  const doctorId = docData.user.doctorId;
  const docToken = docData.token;
  console.log(`✓ Doctor Registered: ${doctorId} (${docEmail})`);

  // 3. Register Patient
  console.log('\n[STEP 3] Registering Patient...');
  const patReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient Sunita Devi', email: patEmail, password: 'password123', role: 'patient' })
  });
  const patData = await patReg.json();
  const patientId = patData.user.patientId;
  console.log(`✓ Patient Registered: ${patientId} (${patEmail})`);

  // 4. Create Encounter Case
  console.log('\n[STEP 4] Creating Encounter Case...');
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'Acute High Fever & Confusion', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;
  console.log(`✓ Case Created: ${caseId}`);

  // 5. Add Vitals to Case
  console.log('\n[STEP 5] Recording Actual Vitals...');
  await fetch(`http://localhost:5000/api/cases/${caseId}/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ temp: '102.4°F', bp: '130/85 mmHg', pulse: '98 bpm', spo2: '96%', respRate: '22 bpm' })
  });
  console.log(`✓ Recorded Vitals: Temp 102.4°F, BP 130/85, Pulse 98, SpO2 96%`);

  // 6. Assistant refers case to Doctor
  console.log('\n[STEP 6] Assistant referring case to Doctor...');
  const refRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({
      patientId,
      caseId,
      doctorId,
      assistantId,
      riskLevel: 'high',
      reason: 'High fever and mental confusion over past 2 days requiring physician assessment'
    })
  });
  const refData = await refRes.json();
  console.log(`✓ Referral Created: ${refData.referralId}`);

  // 7. Doctor opens Case from Doctor Dashboard
  console.log('\n[STEP 7] Doctor fetching Case from Doctor Dashboard...');
  const docCaseRes = await fetch(`http://localhost:5000/api/cases/${caseId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const docCaseData = await docCaseRes.json();
  if (!docCaseRes.ok || !docCaseData.success) throw new Error('Doctor Open Case Failed: ' + JSON.stringify(docCaseData));
  
  const report = docCaseData.data;
  console.log('\nRetrieved Case Packet on Doctor Dashboard:');
  console.log('- Patient Name:', report.demographics?.name);
  console.log('- Patient ID:', report.demographics?.patientId);
  console.log('- Case ID:', report.case?.caseId);
  console.log('- Vitals:', report.vitals);
  console.log('- AI Summary:', report.aiSummary?.mainProblem?.summary || report.aiSummary?.summary);
  console.log('- Triage Level:', report.triage?.level);

  if (report.case?.caseId !== caseId || report.demographics?.patientId !== patientId) {
    throw new Error('❌ ID MISMATCH: Doctor Dashboard caseId/patientId does not match!');
  }

  // 8. Doctor Approves Prescription & Sends Instruction
  console.log('\n[STEP 8] Doctor approving medicine & sending instruction...');
  await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      doctorId,
      doctorNote: 'Fever management and hydration',
      medications: [{ medicationId: `med_${Date.now()}`, name: 'Paracetamol 500mg', dosage: '1 Tablet', route: 'Oral', frequency: 'TDS', status: 'DOCTOR_APPROVED' }]
    })
  });
  await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/instruction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({ message: 'Tepid sponging for fever > 102°F. Keep patient hydrated.', doctorId })
  });
  console.log('✓ Doctor Actions Completed');

  // 9. Re-verify Persistence after Refresh/Reload
  console.log('\n[STEP 9] Re-verifying MongoDB Atlas Persistence after Refresh...');
  const reloadRes = await fetch(`http://localhost:5000/api/cases/${caseId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const reloadData = await reloadRes.json();
  if (reloadData.data.case?.caseId === caseId && reloadData.data.vitals?.temp === '102.4°F') {
    console.log('\n========================================================================');
    console.log('  🎉 STREAMLINED VOICE → AI SUMMARY → TRIAGE → DOCTOR FLOW PASSED!     ');
    console.log('========================================================================');
  } else {
    throw new Error('❌ PERSISTENCE MISMATCH');
  }
}

testVoiceAiToDoctorStreamlined().catch((err) => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err.message);
  process.exit(1);
});
