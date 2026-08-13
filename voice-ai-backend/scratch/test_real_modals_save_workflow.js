const fetch = require('node-fetch');

async function testRealModalsSaveWorkflow() {
  console.log('=== STARTING REAL MODALS & SAVE WORKFLOW VERIFICATION TEST ===');

  const ts = Date.now();
  const asstEmail = `asst_modal_real_${ts}@gramcare.ai`;
  const docEmail  = `doctor_modal_real_${ts}@gramcare.ai`;
  const patEmail  = `patient_modal_real_${ts}@gramcare.ai`;

  // 1. Register Assistant
  const asstReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Anchal Real', email: asstEmail, password: 'password123', role: 'assistant' })
  });
  const asstData = await asstReg.json();
  const assistantId = asstData.user.assistantId;
  const asstToken = asstData.token;

  // 2. Register Doctor
  const docReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Dr. Saif Real', email: docEmail, password: 'doctor123', role: 'doctor' })
  });
  const docData = await docReg.json();
  const doctorId = docData.user.doctorId;
  const docToken = docData.token;

  // 3. Register Patient
  const patReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient Ramesh Kumar', email: patEmail, password: 'password123', role: 'patient' })
  });
  const patData = await patReg.json();
  const patientId = patData.user.patientId;

  // 4. Create Case
  const caseRes = await fetch('http://localhost:5000/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({ patientId, caseType: 'High Fever & Observation', assistantId })
  });
  const caseData = await caseRes.json();
  const caseId = caseData.caseId;

  // 5. TEST BED ASSIGNMENT MODAL SAVE (Ward, Room, Bed, Floor, Department, Notes)
  console.log('\n--- 1. Testing Bed Assignment Form Submission ---');
  const bedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/bed-assignment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      ward: 'ICU Ward 3',
      room: 'Room 304',
      bed: 'Bed C1',
      floor: '3rd Floor',
      department: 'Critical Care Unit',
      notes: 'Monitored under oxygen support 2L/min',
      doctorId
    })
  });
  const bedData = await bedRes.json();
  console.log('Bed Save Output:', bedData);

  // 6. TEST MEDICINE MODAL & SAFETY GATE SAVE (Doctor Approves Drug)
  console.log('\n--- 2. Testing Medicine Safety Gate Approval ---');
  const medRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      doctorId,
      doctorNote: 'Prescribed antibiotic coverage and fever control',
      medications: [
        {
          medicationId: `med_${Date.now()}`,
          name: 'Amoxicillin 500mg',
          dosage: '1 Capsule (500mg)',
          route: 'Oral',
          frequency: 'Thrice Daily (TDS)',
          duration: '7 Days after meals',
          status: 'DOCTOR_APPROVED',
          approvedAt: new Date().toISOString()
        }
      ]
    })
  });
  const medData = await medRes.json();
  console.log('Medicine Approval Output:', medData);

  // 7. TEST MEDICATION SCHEDULE MODAL SAVE
  console.log('\n--- 3. Testing Medication Schedule Times Save ---');
  const schedRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medication-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      medicationName: 'Amoxicillin 500mg',
      dose: '500mg',
      times: ['08:00', '14:00', '20:00'],
      doctorId
    })
  });
  const schedData = await schedRes.json();
  console.log('Schedule Save Output:', schedData);

  // 8. TEST DOCTOR INSTRUCTION MODAL SAVE
  console.log('\n--- 4. Testing Doctor Instruction Modal Save ---');
  const instRes = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/instruction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${docToken}` },
    body: JSON.stringify({
      message: 'Monitor temperature every 4 hours. Keep patient head elevated 30 degrees.',
      doctorId
    })
  });
  const instData = await instRes.json();
  console.log('Instruction Save Output:', instData);

  // 9. RELOAD & PERSISTENCE VERIFICATION FROM MONGODB ATLAS
  console.log('\n--- 5. Verifying MongoDB Atlas Persistence After Page Reload ---');
  const lookupRes = await fetch(`http://localhost:5000/api/patients/lookup/${patientId}`, {
    headers: { 'Authorization': `Bearer ${asstToken}` }
  });
  const pData = await lookupRes.json();
  const p = pData.data;

  console.log('\nRetrieved Patient Document from MongoDB Atlas:');
  console.log('- Patient ID:', p.patientId);
  console.log('- Bed Assignment:', p.bedAssignment);
  console.log('- Approved Medications:', p.approvedMedications);
  console.log('- Doctor Instructions:', p.doctorInstructions);

  if (p.bedAssignment?.ward === 'ICU Ward 3' &&
      p.bedAssignment?.room === 'Room 304' &&
      p.bedAssignment?.bed === 'Bed C1' &&
      p.approvedMedications?.[0]?.name === 'Amoxicillin 500mg' &&
      p.doctorInstructions?.[0]?.message.includes('Monitor temperature every 4 hours')) {
    console.log('\n=== ALL MODAL & SAVE WORKFLOW TESTS PASSED PERFECTLY! ===');
  } else {
    console.error('\n❌ PERSISTENCE FAILURE: MongoDB Atlas data mismatch!');
    process.exit(1);
  }
}

testRealModalsSaveWorkflow().catch(console.error);
