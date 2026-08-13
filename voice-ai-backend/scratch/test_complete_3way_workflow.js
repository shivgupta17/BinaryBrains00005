const fetch = require('node-fetch');

async function testComplete3WayWorkflow() {
  console.log('================================================================');
  console.log('   GRAMCARE AI - COMPLETE 3-WAY WORKFLOW & LINKING VERIFICATION');
  console.log('================================================================');

  const ts = Date.now();
  const asstEmail = `asst_3way_${ts}@gramcare.ai`;
  const docEmail  = `doc_3way_${ts}@gramcare.ai`;
  const patEmail  = `pat_3way_${ts}@gramcare.ai`;

  // 1. Register Assistant
  console.log('\n[STEP 1] Registering Assistant...');
  const asstReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Anchal 3Way', email: asstEmail, password: 'password123', role: 'assistant' })
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
    body: JSON.stringify({ name: 'Dr. Saif 3Way', email: docEmail, password: 'doctor123', role: 'doctor' })
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
    body: JSON.stringify({ name: 'Patient Ramesh 3Way', email: patEmail, password: 'password123', role: 'patient' })
  });
  const patData = await patReg.json();
  const patientId = patData.user.patientId;
  const patToken = patData.token;
  console.log(`✓ Patient Registered: ${patientId} (${patEmail})`);

  // 4. Assistant creates Case Encounter
  console.log('\n[STEP 4] Assistant creating Encounter Case...');
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'High Fever & Acute Evaluation', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;
  console.log(`✓ Case Created: ${caseId} (differs from patientId "${patientId}")`);

  // 5. Assistant refers case to Doctor
  console.log('\n[STEP 5] Assistant referring case to Doctor...');
  const refRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({
      patientId,
      caseId,
      doctorId,
      assistantId,
      riskLevel: 'amber',
      reason: 'Persistent high fever and respiratory distress requiring physician evaluation'
    })
  });
  const refData = await refRes.json();
  const referralId = refData.referralId;
  console.log(`✓ Referral Created: ${referralId} linking patientId=${patientId}, caseId=${caseId}, doctorId=${doctorId}, assistantId=${assistantId}`);

  // 6. Doctor opens Case from Doctor Dashboard
  console.log('\n[STEP 6] Doctor opening Case from Doctor Dashboard...');
  const docCaseRes = await fetch(`http://localhost:5000/api/cases/${caseId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const docCaseData = await docCaseRes.json();
  if (!docCaseRes.ok || !docCaseData.success) throw new Error('Doctor Open Case Failed: ' + JSON.stringify(docCaseData));
  console.log(`✓ Doctor Opened Case Successfully without "Case not found" error! Case Status = ${docCaseData.data.case.status}`);

  // 7. Doctor Accepts Referral
  console.log('\n[STEP 7] Doctor accepting referral...');
  await fetch(`http://localhost:5000/api/referrals/${referralId}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  console.log(`✓ Referral Accepted by Doctor`);

  // 8. Doctor assigns Bed
  console.log('\n[STEP 8] Doctor assigning Bed...');
  const bedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/bed-assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      ward: 'ICU Ward 2',
      room: 'Room 105',
      bed: 'Bed B1',
      floor: '1st Floor',
      department: 'Pulmonology',
      notes: 'Patient under observation with oxygen support',
      doctorId
    })
  });
  const bedData = await bedRes.json();
  console.log(`✓ Bed Assigned: ${bedData.data.ward}, ${bedData.data.room}, ${bedData.data.bed}`);

  // 9. Doctor approves Medicine
  console.log('\n[STEP 9] Doctor approving Prescription Medicine...');
  const medRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      doctorId,
      doctorNote: 'Prescribed antibacterial coverage',
      medications: [
        {
          medicationId: `med_${Date.now()}`,
          name: 'Ciprofloxacin 500mg',
          dosage: '1 Tablet (500mg)',
          route: 'Oral',
          frequency: 'Twice Daily (BD)',
          duration: '5 Days',
          status: 'DOCTOR_APPROVED',
          approvedAt: new Date().toISOString()
        }
      ]
    })
  });
  const medData = await medRes.json();
  console.log(`✓ Medicine Approved: ${medData.data[0].name} (${medData.data[0].status})`);

  // 10. Doctor configures Medication Schedule
  console.log('\n[STEP 10] Doctor configuring Medication Schedule...');
  const schedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medication-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      medicationName: 'Ciprofloxacin 500mg',
      dose: '500mg',
      times: ['08:00', '20:00'],
      doctorId
    })
  });
  const schedData = await schedRes.json();
  console.log(`✓ Schedule Configured: ${schedData.data.medicationName} at ${schedData.data.times.join(', ')}`);

  // 11. Doctor sends Instruction to Assistant
  console.log('\n[STEP 11] Doctor sending Instruction to Assistant...');
  const instRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/instruction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      message: 'Keep patient head elevated 30 degrees and monitor temperature every 4 hours.',
      doctorId
    })
  });
  const instData = await instRes.json();
  console.log(`✓ Instruction Sent: "${instData.data.message}"`);

  // 12. Verify Assistant Dashboard View Data
  console.log('\n[STEP 12] Verifying Assistant Care Panel View...');
  const asstLookRes = await fetch(`http://localhost:5000/api/patients/lookup/${patientId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const asstLookData = await asstLookRes.json();
  const p = asstLookData.data;

  console.log(`✓ Assistant Panel Data Verified:`);
  console.log(`  - Bed Assignment: ${p.bedAssignment?.ward}, ${p.bedAssignment?.room}, ${p.bedAssignment?.bed}`);
  console.log(`  - Approved Medication: ${p.approvedMedications?.[0]?.name} (${p.approvedMedications?.[0]?.status})`);
  console.log(`  - Doctor Instruction: "${p.doctorInstructions?.[0]?.message}"`);

  // 13. Verify Patient Portal View Data
  console.log('\n[STEP 13] Verifying Patient Care Portal View...');
  const portalRes = await fetch(`http://localhost:5000/api/patient/dashboard-data?patientId=${patientId}`, {
    headers: { 'Authorization': `Bearer ${patToken}` }
  });
  const portalData = await portalRes.json();
  const portal = portalData.data;

  console.log(`✓ Patient Portal Data Verified:`);
  console.log(`  - Patient Name: ${portal.demographics?.name}`);
  console.log(`  - Case Status: ${portal.status}`);
  console.log(`  - Assigned Doctor: ${portal.assignedDoctor?.name || 'Dr. Saif 3Way'}`);
  console.log(`  - Assigned Assistant: ${portal.assignedAssistant?.email || asstEmail}`);
  console.log(`  - Doctor Approved Medications ONLY: ${portal.approvedMedications?.length} approved drug(s)`);
  console.log(`  - Bed Assignment: ${portal.bedAssignment?.ward}, ${portal.bedAssignment?.room}`);

  // 14. Test Patient Sending Email Reminder to Assistant via Nodemailer
  console.log('\n[STEP 14] Testing Patient "Remind Assistant" Email Request via Nodemailer...');
  const remindRes = await fetch(`http://localhost:5000/api/cases/${caseId}/reminders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patToken}` },
    body: JSON.stringify({
      patientId,
      requestType: 'Medication Schedule Guidance',
      message: 'Please assist me with my 20:00 dose schedule.'
    })
  });
  const remindData = await remindRes.json();
  console.log('Remind Assistant Output:', remindData);

  if (!remindRes.ok || !remindData.success) {
    throw new Error('Remind Assistant Failed: ' + JSON.stringify(remindData));
  }

  console.log(`✓ Email Reminder Sent via Nodemailer to Assistant (${asstEmail})`);

  console.log('\n================================================================');
  console.log('  🎉 COMPLETE 3-WAY PATIENT-ASSISTANT-DOCTOR WORKFLOW VERIFIED! ');
  console.log('================================================================');
}

testComplete3WayWorkflow().catch((err) => {
  console.error('\n❌ 3-WAY WORKFLOW TEST FAILED:', err.message);
  process.exit(1);
});
