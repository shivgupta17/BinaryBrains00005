const fetch = require('node-fetch');

async function runFullSuiteVerification() {
  console.log('===========================================================');
  console.log('   GRAMCARE AI - COMPLETE FULL-SUITE CODE VERIFICATION     ');
  console.log('===========================================================');

  const ts = Date.now();
  const asstEmail = `full_asst_${ts}@gramcare.ai`;
  const docEmail  = `full_doc_${ts}@gramcare.ai`;
  const patEmail  = `full_pat_${ts}@gramcare.ai`;

  // 1. REGISTER ASSISTANT
  console.log('\n[STEP 1] Registering Assistant...');
  const asstReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Anchal Audit', email: asstEmail, password: 'password123', role: 'assistant' })
  });
  const asstData = await asstReg.json();
  if (!asstReg.ok || !asstData.success) throw new Error('Assistant Registration Failed: ' + JSON.stringify(asstData));
  const assistantId = asstData.user.assistantId;
  const asstToken = asstData.token;
  console.log(`✓ Assistant Registered: ${assistantId} (${asstEmail})`);

  // 2. REGISTER DOCTOR
  console.log('\n[STEP 2] Registering Doctor...');
  const docReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dr. Saif Anwar Audit', email: docEmail, password: 'doctor123', role: 'doctor' })
  });
  const docData = await docReg.json();
  if (!docReg.ok || !docData.success) throw new Error('Doctor Registration Failed: ' + JSON.stringify(docData));
  const doctorId = docData.user.doctorId;
  const docToken = docData.token;
  console.log(`✓ Doctor Registered: ${doctorId} (${docEmail})`);

  // 3. REGISTER PATIENT
  console.log('\n[STEP 3] Registering Patient...');
  const patReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient Ramesh Audit', email: patEmail, password: 'password123', role: 'patient' })
  });
  const patData = await patReg.json();
  if (!patReg.ok || !patData.success) throw new Error('Patient Registration Failed: ' + JSON.stringify(patData));
  const patientId = patData.user.patientId;
  const patToken = patData.token;
  console.log(`✓ Patient Registered: ${patientId} (${patEmail})`);

  // 4. PATIENT LOOKUP
  console.log('\n[STEP 4] Testing Patient Lookup by Unique ID...');
  const lookRes = await fetch(`http://localhost:5000/api/patients/lookup/${patientId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const lookData = await lookRes.json();
  if (!lookRes.ok || !lookData.success) throw new Error('Patient Lookup Failed: ' + JSON.stringify(lookData));
  console.log(`✓ Patient Lookup Success: Found ${lookData.data.name} (${lookData.data.patientId})`);

  // 5. DOCTOR ID LOOKUP (Case-Insensitive Regex)
  console.log('\n[STEP 5] Testing Doctor Lookup by Unique ID & Lowercase...');
  const docLook1 = await fetch(`http://localhost:5000/api/doctors/lookup/${doctorId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const docLookData1 = await docLook1.json();
  const docLook2 = await fetch(`http://localhost:5000/api/doctors/lookup/${doctorId.toLowerCase()}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const docLookData2 = await docLook2.json();
  if (!docLookData1.success || !docLookData2.success) throw new Error('Doctor Lookup Failed!');
  console.log(`✓ Doctor Lookup (Uppercase & Lowercase) Success: ${docLookData1.data.name} (${docLookData1.data.doctorId})`);

  // 6. CREATE CASE ENCOUNTER
  console.log('\n[STEP 6] Creating Encounter Case...');
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'Acute Respiratory Evaluation', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;
  console.log(`✓ Case Created: ${caseId} (Status: ${caseData.data.status})`);

  // 7. REFER PATIENT TO DOCTOR
  console.log('\n[STEP 7] Sending Patient Case Referral to Doctor...');
  const refRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({
      patientId,
      caseId,
      doctorId,
      assistantId,
      riskLevel: 'amber',
      reason: 'Fever and dyspnea for 2 days requiring physician evaluation'
    })
  });
  const refData = await refRes.json();
  const referralId = refData.referralId;
  console.log(`✓ Referral Sent: ${referralId} (Status: ${refData.data.status})`);

  // 8. DOCTOR PRIVATE QUEUE FETCH
  console.log('\n[STEP 8] Doctor fetching private referral queue...');
  const qRes = await fetch('http://localhost:5000/api/referrals/doctor/referrals', {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const qData = await qRes.json();
  if (qData.count !== 1 || qData.data[0].referralId !== referralId) {
    throw new Error('Doctor Referral Queue Mismatch: ' + JSON.stringify(qData));
  }
  console.log(`✓ Doctor Private Queue Success: 1 Referral in queue (${qData.data[0].referralId})`);

  // 9. DOCTOR ACCEPTS REFERRAL
  console.log('\n[STEP 9] Doctor accepting referral...');
  const accRes = await fetch(`http://localhost:5000/api/referrals/${referralId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const accData = await accRes.json();
  if (!accData.success || accData.data.status !== 'ACCEPTED') throw new Error('Accept Referral Failed');
  console.log(`✓ Doctor Accepted Referral: Status = ACCEPTED (${accData.data.acceptedAt})`);

  // 10. DOCTOR ASSIGNS BED
  console.log('\n[STEP 10] Doctor assigning hospital bed...');
  const bedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/bed-assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      ward: 'Special Care Unit',
      room: 'Room 201',
      bed: 'Bed A2',
      floor: '2nd Floor',
      department: 'Pulmonology',
      notes: 'Monitored under nasal cannula 3L/min',
      doctorId
    })
  });
  const bedData = await bedRes.json();
  if (!bedData.success) throw new Error('Bed Assignment Failed: ' + JSON.stringify(bedData));
  console.log(`✓ Bed Assigned: ${bedData.data.ward}, ${bedData.data.room}, ${bedData.data.bed}`);

  // 11. DOCTOR APPROVES MEDICATION
  console.log('\n[STEP 11] Doctor approving prescription medicine...');
  const medRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      doctorId,
      doctorNote: 'Initiated broad-spectrum coverage and anti-pyretic',
      medications: [
        {
          medicationId: `med_${Date.now()}`,
          name: 'Azithromycin 500mg',
          dosage: '1 Tablet (500mg)',
          route: 'Oral',
          frequency: 'Once Daily (OD)',
          duration: '5 Days',
          status: 'DOCTOR_APPROVED',
          approvedAt: new Date().toISOString()
        }
      ]
    })
  });
  const medData = await medRes.json();
  if (!medData.success) throw new Error('Medicine Approval Failed: ' + JSON.stringify(medData));
  console.log(`✓ Medicine Approved: ${medData.data[0].name} (${medData.data[0].status})`);

  // 12. DOCTOR SCHEDULES MEDICATION TIMES
  console.log('\n[STEP 12] Doctor configuring medication schedule times...');
  const schedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medication-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      medicationName: 'Azithromycin 500mg',
      dose: '500mg',
      times: ['09:00', '21:00'],
      doctorId
    })
  });
  const schedData = await schedRes.json();
  if (!schedData.success) throw new Error('Medication Schedule Failed: ' + JSON.stringify(schedData));
  console.log(`✓ Schedule Configured: ${schedData.data.medicationName} at ${schedData.data.times.join(', ')}`);

  // 13. DOCTOR SENDS INSTRUCTION TO ASSISTANT
  console.log('\n[STEP 13] Doctor sending instruction to Assistant...');
  const instRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/instruction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      message: 'Monitor SPO2 every 2 hours and inform immediately if SPO2 drops below 94%.',
      doctorId
    })
  });
  const instData = await instRes.json();
  if (!instData.success) throw new Error('Instruction Failed: ' + JSON.stringify(instData));
  console.log(`✓ Instruction Sent: "${instData.data.message}"`);

  // 14. VERIFY PATIENT CARE PORTAL DATA FETCHING
  console.log('\n[STEP 14] Verifying Patient Care Portal Data...');
  const portalRes = await fetch(`http://localhost:5000/api/patient/dashboard-data?patientId=${patientId}`, {
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  const portalData = await portalRes.json();
  if (!portalData.success || portalData.data.status !== 'IN_CONSULTATION') {
    throw new Error('Patient Portal Verification Failed: ' + JSON.stringify(portalData));
  }
  console.log(`✓ Patient Care Portal Verified: Case Status = IN_CONSULTATION`);

  // 15. PERSISTENCE CHECK AFTER RELOAD FROM MONGODB ATLAS
  console.log('\n[STEP 15] Verifying Persistence in MongoDB Atlas...');
  const finalLookRes = await fetch(`http://localhost:5000/api/patients/lookup/${patientId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const finalLookData = await finalLookRes.json();
  const p = finalLookData.data;

  if (p.bedAssignment?.ward === 'Special Care Unit' &&
      p.approvedMedications?.[0]?.name === 'Azithromycin 500mg' &&
      p.doctorInstructions?.[0]?.message.includes('Monitor SPO2 every 2 hours')) {
    console.log('\n===========================================================');
    console.log('   🎉 ALL 15 VERIFICATION STEPS PASSED WITH 100% SUCCESS!  ');
    console.log('===========================================================');
  } else {
    throw new Error('MongoDB Atlas Data Persistence Mismatch!');
  }
}

runFullSuiteVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
  process.exit(1);
});
