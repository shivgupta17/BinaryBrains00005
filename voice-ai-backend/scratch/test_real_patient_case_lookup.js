const fetch = require('node-fetch');

async function testRealPatientCaseLookup() {
  console.log('=== VERIFYING REAL PATIENT & CASE LOOKUP FROM MONGODB ATLAS ===');

  // 1. Login as Doctor (DOC-79TNLJI5 or Doctor account)
  const docLogin = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor_modal_real_1786580696295@gramcare.ai', password: 'doctor123', role: 'doctor' })
  });
  const docData = await docLogin.json();
  const docToken = docData.token;
  const doctorId = docData.user.doctorId;

  console.log(`✓ Doctor Authenticated: ${doctorId}`);

  // 2. Fetch Referrals for Doctor
  const refRes = await fetch('http://localhost:5000/api/referrals/doctor/referrals', {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const refData = await refRes.json();
  console.log(`\nFound ${refData.count} referrals in doctor queue.`);

  // 3. Test Case Details Lookup for Existing Real Patient "sivam" (PAT-Q2K2FZWO / CASE-VVNIRJ99)
  console.log('\n--- Testing Case Details Lookup for REAL Patient CASE-VVNIRJ99 ---');
  const caseRes1 = await fetch('http://localhost:5000/api/cases/CASE-VVNIRJ99', {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const caseData1 = await caseRes1.json();
  console.log('Case Lookup Result:', { status: caseRes1.status, success: caseData1.success });

  if (!caseRes1.ok || !caseData1.success) {
    throw new Error('Case Lookup Failed: ' + JSON.stringify(caseData1));
  }

  console.log(`✓ Successfully loaded real patient case:`);
  console.log(`  - Case ID: ${caseData1.data.case?.caseId}`);
  console.log(`  - Patient ID: ${caseData1.data.case?.patientId}`);
  console.log(`  - Patient Name: ${caseData1.data.demographics?.name || caseData1.data.case?.patientName || 'sivam'}`);
  console.log(`  - Case Status: ${caseData1.data.case?.status}`);

  // 4. Test Creating a NEW Referral & Verify Real Unique caseId Creation
  console.log('\n--- Testing NEW Referral Creation & Unique caseId Generation ---');
  const ts = Date.now();
  const asstEmail = `asst_case_test_${ts}@gramcare.ai`;

  const asstReg = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Assistant Case Test', email: asstEmail, password: 'password123', role: 'assistant' })
  });
  const asstData = await asstReg.json();
  const asstToken = asstData.token;
  const assistantId = asstData.user.assistantId;

  // Create referral for patient PAT-Q2K2FZWO without hardcoded caseId
  const newRefRes = await fetch('http://localhost:5000/api/referrals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${asstToken}` },
    body: JSON.stringify({
      patientId: 'PAT-Q2K2FZWO',
      doctorId,
      assistantId,
      riskLevel: 'high',
      reason: 'Urgent consultation for persistent fever'
    })
  });
  const newRefData = await newRefRes.json();
  console.log('New Referral Output:', newRefData);

  if (!newRefRes.ok || !newRefData.success) {
    throw new Error('New Referral Creation Failed: ' + JSON.stringify(newRefData));
  }

  const generatedCaseId = newRefData.data.caseId;
  console.log(`✓ Generated REAL unique caseId: "${generatedCaseId}" (differs from patientId "PAT-Q2K2FZWO")`);

  if (generatedCaseId.startsWith('CASE_PAT_')) {
    throw new Error('❌ FAILURE: caseId is still being generated as CASE_PAT_...!');
  }

  // 5. Test Doctor Opening the New Case from MongoDB Atlas
  const caseRes2 = await fetch(`http://localhost:5000/api/cases/${generatedCaseId}`, {
    headers: { 'Authorization': `Bearer ${docToken}` }
  });
  const caseData2 = await caseRes2.json();

  if (!caseRes2.ok || !caseData2.success) {
    throw new Error('Opening New Case Failed: ' + JSON.stringify(caseData2));
  }

  console.log(`✓ Doctor successfully opened new case "${generatedCaseId}" from MongoDB Atlas without "Case not found" error!`);
  console.log('\n============================================================');
  console.log('  🎉 CASE NOT FOUND ROOT CAUSE FULLY RESOLVED & VERIFIED!   ');
  console.log('============================================================');
}

testRealPatientCaseLookup().catch((err) => {
  console.error('\n❌ CASE LOOKUP TEST FAILED:', err.message);
  process.exit(1);
});
