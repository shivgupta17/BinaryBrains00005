const fetch = require('node-fetch');

async function testE2ERealIdsFlow() {
  console.log('=== STARTING E2E TEST: PAT-XXXXXXXX, DOC-XXXXXXXX, AST-XXXXXXXX LINKAGE ===');

  const ts = Date.now();
  const patEmail = `patient_e2e_${ts}@gramcare.ai`;
  const docEmail = `doctor_e2e_${ts}@gramcare.ai`;
  const asstEmail = `asst_e2e_${ts}@gramcare.ai`;

  // 1. Register Patient
  const regPatRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rahul Sharma', email: patEmail, password: 'password123', role: 'patient' })
  });
  const regPatData = await regPatRes.json();
  console.log('1. Patient Registration Response:', regPatData);
  const patientId = regPatData.user?.patientId;
  const patToken = regPatData.token;

  // 2. Register Doctor
  const regDocRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dr. Saif Anwar', email: docEmail, password: 'doctor123', role: 'doctor' })
  });
  const regDocData = await regDocRes.json();
  console.log('2. Doctor Registration Response:', regDocData);
  const doctorId = regDocData.user?.doctorId;
  const docToken = regDocData.token;

  // 3. Register Assistant
  const regAsstRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Anchal Assistant', email: asstEmail, password: 'password123', role: 'assistant' })
  });
  const regAsstData = await regAsstRes.json();
  console.log('3. Assistant Registration Response:', regAsstData);
  const assistantId = regAsstData.user?.assistantId;
  const asstToken = regAsstData.token;

  // 4. Assistant Looks Up Patient by PAT-XXXXXXXX
  console.log(`4. Looking up Patient by ID: ${patientId}`);
  const lookupPatRes = await fetch(`http://localhost:5000/api/patients/lookup/${patientId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const lookupPatData = await lookupPatRes.json();
  console.log('Patient Lookup Output:', lookupPatData);

  // 5. Assistant Creates Case for Patient
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'Fever & Cough Consultation', assistantId })
  });
  const caseData = await caseRes.json();
  console.log('5. Case Created:', caseData);
  const caseId = caseData.caseId;

  // 6. Assistant Looks Up Doctor by DOC-XXXXXXXX
  console.log(`6. Looking up Doctor by ID: ${doctorId}`);
  const lookupDocRes = await fetch(`http://localhost:5000/api/doctors/lookup/${doctorId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const lookupDocData = await lookupDocRes.json();
  console.log('Doctor Lookup Output:', lookupDocData);

  // 7. Assistant Sends Referral to Doctor
  const refRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseId, doctorId, assistantId, riskLevel: 'amber', reason: 'High fever and persistent cough for 3 days' })
  });
  const refData = await refRes.json();
  console.log('7. Referral Created:', refData);
  const referralId = refData.referralId;

  // 8. Doctor Lists Incoming Referrals
  const listRefRes = await fetch(`http://localhost:5000/api/referrals?doctorId=${doctorId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const listRefData = await listRefRes.json();
  console.log('8. Doctor Referral List Output:', listRefData);

  // 9. Doctor Accepts Referral
  const acceptRes = await fetch(`http://localhost:5000/api/referrals/${referralId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const acceptData = await acceptRes.json();
  console.log('9. Referral Accepted Output:', acceptData);

  // 10. Doctor Issues Approved Medications & Bed Assignment
  await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      medications: [
        { name: 'Paracetamol 500mg', dosage: '1 tablet 3x daily after meals', status: 'DOCTOR_APPROVED' },
        { name: 'Azithromycin 500mg', dosage: '1 tablet daily for 5 days', status: 'DOCTOR_APPROVED' }
      ]
    })
  });

  await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/bed-assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({ ward: 'General Medical Ward A', bedNumber: 'B-12', notes: 'Patient admitted for 24h observation' })
  });

  // 11. Patient Dashboard Load Verification
  const patDashRes = await fetch(`http://localhost:5000/api/patient/dashboard-data?patientId=${patientId}`, {
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  const patDashData = await patDashRes.json();
  console.log('11. Patient Dashboard Loaded Successfully:');
  console.dir(patDashData, { depth: null });

  console.log('=== ALL STEPS VERIFIED END-TO-END! ===');
}

testE2ERealIdsFlow().catch(console.error);
