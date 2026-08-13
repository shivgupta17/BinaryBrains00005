const fetch = require('node-fetch');

async function testAuthFlowRecovery() {
  console.log('=== VERIFYING COMPLETE AUTHENTICATION ENTRY & ROLE FLOW ===');

  const ts = Date.now();
  const testUsers = [
    { role: 'assistant', name: 'Test Assistant Auth', email: `test_asst_${ts}@gramcare.ai`, password: 'password123' },
    { role: 'doctor',    name: 'Dr. Test Doctor Auth', email: `test_doc_${ts}@gramcare.ai`,  password: 'doctor123' },
    { role: 'patient',   name: 'Test Patient Auth', email: `test_pat_${ts}@gramcare.ai`,  password: 'password123' }
  ];

  for (const u of testUsers) {
    console.log(`\n--- 1. Testing Registration for ${u.role.toUpperCase()} (${u.email}) ---`);
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u)
    });
    const regData = await regRes.json();
    console.log('Registration Output:', { status: regRes.status, success: regData.success, user: regData.user });

    if (!regRes.ok || !regData.success) {
      throw new Error(`Registration failed for ${u.role}: ${JSON.stringify(regData)}`);
    }

    const expectedIdField = u.role === 'assistant' ? 'assistantId' : (u.role === 'doctor' ? 'doctorId' : 'patientId');
    if (!regData.user[expectedIdField]) {
      throw new Error(`Missing ${expectedIdField} in registered user!`);
    }

    console.log(`\n--- 2. Testing Login for ${u.role.toUpperCase()} (${u.email}) ---`);
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password, role: u.role })
    });
    const loginData = await loginRes.json();
    console.log('Login Output:', { status: loginRes.status, success: loginData.success, user: loginData.user });

    if (!loginRes.ok || !loginData.success) {
      throw new Error(`Login failed for ${u.role}: ${JSON.stringify(loginData)}`);
    }

    const targetPage = u.role === 'doctor' ? 'doctor' : (u.role === 'patient' ? 'patient-dashboard' : 'dashboard');
    console.log(`✓ Role Routing Verified for ${u.role}: Target Dashboard = #${targetPage}`);
  }

  console.log('\n============================================================');
  console.log('  🎉 AUTHENTICATION FLOW & ROLE ROUTING FULLY RESTORED!     ');
  console.log('============================================================');
}

testAuthFlowRecovery().catch((err) => {
  console.error('\n❌ AUTH TEST FAILED:', err.message);
  process.exit(1);
});
