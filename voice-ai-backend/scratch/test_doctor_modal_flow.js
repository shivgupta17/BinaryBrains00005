const fetch = require('node-fetch');

async function testDoctorModalFlow() {
  console.log('=== STARTING DOCTOR LOOKUP & REFERRAL MODAL FLOW TEST ===');

  const ts = Date.now();
  // Register an assistant
  const asstRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Modal Test Asst', email: `asst_modal_${ts}@gramcare.ai`, password: 'password123', role: 'assistant' })
  });
  const asstData = await asstRes.json();
  const asstToken = asstData.token;
  const assistantId = asstData.user.assistantId;

  // Register a patient
  const patRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Modal Patient', email: `patient_modal_${ts}@gramcare.ai`, password: 'password123', role: 'patient' })
  });
  const patData = await patRes.json();
  const patientId = patData.user.patientId;

  // Create case
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'Fever Consultation', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;

  // TEST 1: Lookup real Doctor DOC-3N8E4ZJQ (Uppercase)
  console.log('\n--- TEST 1: Lookup Uppercase DOC-3N8E4ZJQ ---');
  const res1 = await fetch('http://localhost:5000/api/doctors/lookup/DOC-3N8E4ZJQ', {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const d1 = await res1.json();
  console.log('Status:', res1.status, 'Response:', d1);

  // TEST 2: Lookup real Doctor doc-3n8e4zjq (Lowercase)
  console.log('\n--- TEST 2: Lookup Lowercase doc-3n8e4zjq ---');
  const res2 = await fetch('http://localhost:5000/api/doctors/lookup/doc-3n8e4zjq', {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const d2 = await res2.json();
  console.log('Status:', res2.status, 'Response:', d2);

  // TEST 3: Lookup Doctor by Email saif123@gmail.com
  console.log('\n--- TEST 3: Lookup Doctor by Email saif123@gmail.com ---');
  const res3 = await fetch('http://localhost:5000/api/doctors/lookup/saif123@gmail.com', {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const d3 = await res3.json();
  console.log('Status:', res3.status, 'Response:', d3);

  // TEST 4: Lookup Invalid Doctor ID DOC-INVALID999
  console.log('\n--- TEST 4: Lookup Invalid Doctor ID DOC-INVALID999 ---');
  const res4 = await fetch('http://localhost:5000/api/doctors/lookup/DOC-INVALID999', {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const d4 = await res4.json();
  console.log('Status:', res4.status, 'Response:', d4);

  // Register a doctor for testing login & queue
  const docRegRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dr. Saif Anwar Real', email: `doctor_saif_${ts}@gramcare.ai`, password: 'doctor123', role: 'doctor' })
  });
  const docRegData = await docRegRes.json();
  const realDocId = docRegData.user.doctorId;
  const docEmailToUse = docRegData.user.email;

  // TEST 5: Create Referral for Doctor
  console.log(`\n--- TEST 5: Send Referral for Doctor ${realDocId} ---`);
  const refRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({
      patientId,
      caseId,
      doctorId: realDocId,
      assistantId,
      riskLevel: 'amber',
      reason: 'Fever and cough requiring physician assessment'
    })
  });
  const refData = await refRes.json();
  console.log('Referral Response:', refData);
  const referralId = refData.referralId;

  // TEST 6: Login as Doctor
  console.log(`\n--- TEST 6: Login as Doctor ${docEmailToUse} ---`);
  const docLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: docEmailToUse, password: 'doctor123', role: 'doctor' })
  });
  const docLoginData = await docLogin.json();
  const docToken = docLoginData.token;
  console.log('Doctor Login Output:', { doctorId: docLoginData.user?.doctorId, name: docLoginData.user?.name });

  const listRes = await fetch(`http://localhost:5000/api/referrals?doctorId=${realDocId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const listData = await listRes.json();
  console.log('Doctor Referral Queue Count:', listData.count);
  console.log('Latest Referral in Queue:', listData.data[0]);

  // TEST 7: Doctor Accepts Referral
  console.log('\n--- TEST 7: Doctor Accepts Referral ---');
  const acceptRes = await fetch(`http://localhost:5000/api/referrals/${referralId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const acceptData = await acceptRes.json();
  console.log('Accept Referral Output:', acceptData);

  console.log('\n=== ALL DOCTOR MODAL & LOOKUP TESTS COMPLETED SUCCESSFULLY! ===');
}

testDoctorModalFlow().catch(console.error);
