const fetch = require('node-fetch');

async function testAiResponsePersistence() {
  console.log('========================================================================');
  console.log('   GRAMCARE AI - AI RESPONSE MONGODB ATLAS PERSISTENCE TEST             ');
  console.log('========================================================================');

  const ts = Date.now();
  const asstEmail = `asst_persist_${ts}@gramcare.ai`;
  const docEmail  = `doc_persist_${ts}@gramcare.ai`;
  const patEmail  = `pat_persist_${ts}@gramcare.ai`;

  // 1. Register Assistant
  console.log('\n[STEP 1] Registering Assistant...');
  const asstReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Anchal Persist', email: asstEmail, password: 'password123', role: 'assistant' })
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
    body: JSON.stringify({ name: 'Dr. Saif Persist', email: docEmail, password: 'doctor123', role: 'doctor' })
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
    body: JSON.stringify({ name: 'Patient Sunita Devi Persist', email: patEmail, password: 'password123', role: 'patient' })
  });
  const patData = await patReg.json();
  const patientId = patData.user.patientId;
  console.log(`✓ Patient Registered: ${patientId} (${patEmail})`);

  // 4. Create Encounter Case
  console.log('\n[STEP 4] Creating Encounter Case...');
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'Acute High Fever & Respiratory Distress', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;
  console.log(`✓ Case Created: ${caseId}`);

  // 5. Add Vitals to Case
  console.log('\n[STEP 5] Recording Vitals...');
  await fetch(`http://localhost:5000/api/cases/${caseId}/vitals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ temp: '103.1°F', bp: '135/88 mmHg', pulse: '104 bpm', spo2: '94%', respRate: '24 bpm' })
  });
  console.log(`✓ Recorded Vitals: Temp 103.1°F, BP 135/88, Pulse 104, SpO2 94%`);

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
      reason: 'High fever, shortness of breath, and leg pain over past 2 days requiring urgent physician assessment'
    })
  });
  const refData = await refRes.json();
  console.log(`✓ Referral Created: ${refData.referralId}`);

  // 7. Doctor Dashboard fetches Case
  console.log('\n[STEP 7] Doctor Dashboard fetching Case Packet...');
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

  if (!report.demographics?.patientId || report.demographics.patientId !== patientId) {
    throw new Error(`❌ PATIENT ID MISMATCH: expected ${patientId}, got ${report.demographics?.patientId}`);
  }
  if (!report.case?.caseId || report.case.caseId !== caseId) {
    throw new Error(`❌ CASE ID MISMATCH: expected ${caseId}, got ${report.case?.caseId}`);
  }
  if (!report.aiSummary) {
    throw new Error('❌ MISSING AI SUMMARY: aiSummary was not returned!');
  }

  // 8. Test Refresh / Relogin Persistence
  console.log('\n[STEP 8] Simulating Browser Refresh & Doctor Logout/Relogin...');
  const reloginDocRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: docEmail, password: 'doctor123', role: 'doctor' })
  });
  const reloginDocData = await reloginDocRes.json();
  const newDocToken = reloginDocData.token;

  const reloadCaseRes = await fetch(`http://localhost:5000/api/cases/${caseId}`, {
    headers: { 'Authorization': `Bearer ${newDocToken}` }
  });
  const reloadCaseData = await reloadCaseRes.json();
  const reloadReport = reloadCaseData.data;

  console.log('\nRetrieved Case Packet After Relogin:');
  console.log('- Patient Name:', reloadReport.demographics?.name);
  console.log('- Patient ID:', reloadReport.demographics?.patientId);
  console.log('- Case ID:', reloadReport.case?.caseId);
  console.log('- Vitals Temp:', reloadReport.vitals?.temp);
  console.log('- AI Summary:', reloadReport.aiSummary?.summary);

  if (reloadReport.case?.caseId === caseId && reloadReport.vitals?.temp === '103.1°F') {
    console.log('\n========================================================================');
    console.log('  🎉 AI RESPONSE MONGODB ATLAS PERSISTENCE TEST PASSED SUCCESSFULLY!    ');
    console.log('========================================================================');
  } else {
    throw new Error('❌ PERSISTENCE FAILURE AFTER RELOGIN');
  }
}

testAiResponsePersistence().catch((err) => {
  console.error('\n❌ PERSISTENCE TEST FAILED:', err.message);
  process.exit(1);
});
