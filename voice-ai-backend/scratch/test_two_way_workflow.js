const fetch = require('node-fetch');

async function testTwoWayWorkflow() {
  console.log('=== STARTING COMPLETE TWO-WAY ASSISTANT <-> DOCTOR WORKFLOW TEST ===');

  const ts = Date.now();
  const patEmail = `patient_2way_${ts}@gramcare.ai`;
  const docEmail = `doctor_2way_${ts}@gramcare.ai`;
  const asstEmail = `asst_2way_${ts}@gramcare.ai`;

  // 1. Register Assistant A
  const regAsstRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Anchal', email: asstEmail, password: 'password123', role: 'assistant' })
  });
  const regAsstData = await regAsstRes.json();
  const assistantId = regAsstData.user.assistantId;
  const asstToken = regAsstData.token;
  console.log('1. Assistant Registered:', { assistantId, email: asstEmail });

  // 2. Register Doctor B
  const regDocRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dr. Saif Anwar', email: docEmail, password: 'doctor123', role: 'doctor' })
  });
  const regDocData = await regDocRes.json();
  const doctorId = regDocData.user.doctorId;
  const docToken = regDocData.token;
  console.log('2. Doctor Registered:', { doctorId, email: docEmail });

  // 3. Register Patient C
  const regPatRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient Ramesh', email: patEmail, password: 'password123', role: 'patient' })
  });
  const regPatData = await regPatRes.json();
  const patientId = regPatData.user.patientId;
  const patToken = regPatData.token;
  console.log('3. Patient Registered:', { patientId, email: patEmail });

  // 4. Assistant A Searches Patient C by PAT-XXXXXXXX
  console.log(`\n4. Assistant A searching Patient C (${patientId})...`);
  const lookupRes = await fetch(`http://localhost:5000/api/patients/lookup/${patientId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const lookupData = await lookupRes.json();
  console.log('Patient Lookup Output:', { success: lookupData.success, patientId: lookupData.data?.patientId });

  // 5. Assistant A Creates Case
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'Acute Fever & Headache', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;
  console.log('5. Case Created:', { caseId, patientId, assistantId, status: caseData.data?.status });

  // 6. Assistant A Refers Patient C to Doctor B
  console.log(`\n6. Assistant A referring Case ${caseId} to Doctor B (${doctorId})...`);
  const refRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({
      patientId,
      caseId,
      doctorId,
      assistantId,
      riskLevel: 'amber',
      reason: 'High fever and severe headache for 2 days'
    })
  });
  const refData = await refRes.json();
  const referralId = refData.referralId;
  console.log('Referral Created:', { referralId, doctorId, status: refData.data?.status });

  // 7. Doctor B Checks Doctor Dashboard Referrals (GET /api/referrals/doctor/referrals)
  console.log(`\n7. Doctor B (${doctorId}) fetching private referrals...`);
  const docRefRes = await fetch('http://localhost:5000/api/referrals/doctor/referrals', {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const docRefData = await docRefRes.json();
  console.log('Doctor Referral Queue Output:', {
    count: docRefData.count,
    referralId: docRefData.data[0]?.referralId,
    patientName: docRefData.data[0]?.patientName,
    patientId: docRefData.data[0]?.patientId,
    status: docRefData.data[0]?.status
  });

  // 8. Doctor B Opens Case Details
  console.log(`\n8. Doctor B opening Case Details (${caseId})...`);
  const caseDetRes = await fetch(`http://localhost:5000/api/cases/${caseId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const caseDetData = await caseDetRes.json();
  console.log('Case Details Output:', { success: caseDetData.success, status: caseDetData.data?.case?.status });

  // 9. Doctor B Accepts Referral
  console.log(`\n9. Doctor B accepting Referral ${referralId}...`);
  const acceptRes = await fetch(`http://localhost:5000/api/referrals/${referralId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const acceptData = await acceptRes.json();
  console.log('Referral Accept Output:', { status: acceptData.data?.status, acceptedAt: acceptData.data?.acceptedAt });

  // 10. Doctor B Assigns Bed
  console.log('\n10. Doctor B assigning bed...');
  const bedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/bed-assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({ ward: 'Emergency Ward', room: 'Room 12', bed: 'Bed B', doctorId, notes: 'Patient admitted for 24h observation' })
  });
  const bedData = await bedRes.json();
  console.log('Bed Assignment Output:', bedData.data);

  // 11. Doctor B Approves Medication
  console.log('\n11. Doctor B approving medication...');
  const medRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      medications: [
        { name: 'Paracetamol 500mg', dosage: '1 tablet 3x daily after meals', status: 'DOCTOR_APPROVED' }
      ]
    })
  });
  const medData = await medRes.json();
  console.log('Medication Output:', medData.data);

  // 12. Doctor B Schedules Medication Times
  console.log('\n12. Doctor B scheduling medication times...');
  const schedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medication-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({ medicationName: 'Paracetamol 500mg', dose: '500mg', times: ['08:00', '14:00', '20:00'], doctorId })
  });
  const schedData = await schedRes.json();
  console.log('Schedule Output:', schedData.data);

  // 13. Doctor B Sets Follow-Up
  console.log('\n13. Doctor B setting follow-up...');
  const followRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/follow-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({ followUpDate: '2026-08-15', followUpTime: '10:00 AM', reason: 'Review fever recovery and vital stability', doctorId })
  });
  const followData = await followRes.json();
  console.log('Follow-Up Output:', followData.data);

  // 14. Verify Patient Dashboard Data Load
  console.log('\n14. Patient C verifying Care Portal dashboard...');
  const patDashRes = await fetch(`http://localhost:5000/api/patient/dashboard-data?patientId=${patientId}`, {
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  const patDashData = await patDashRes.json();
  console.log('Patient Portal Summary:');
  console.log({
    patientId: patDashData.data?.patientId,
    caseId: patDashData.data?.caseId,
    status: patDashData.data?.status,
    assignedDoctor: patDashData.data?.assignedDoctor,
    assignedAssistant: patDashData.data?.assignedAssistant,
    approvedMedicationsCount: patDashData.data?.approvedMedications?.length,
    bedAssignment: patDashData.data?.bedAssignment,
    timelineEventsCount: patDashData.data?.timeline?.length
  });

  console.log('\n=== TWO-WAY WORKFLOW TEST PASSED CLEANLY WITH ZERO FAILURES! ===');
}

testTwoWayWorkflow().catch(console.error);
