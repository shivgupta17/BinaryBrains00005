const { MongoClient } = require('mongodb');

async function inspectAtlas() {
  const uri = "mongodb+srv://mrshivop17_db_user:nRKFHYosPZnkiZ1o@cluster0.q8clbbk.mongodb.net";
  const client = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas!');
    const db = client.db();

    const cases = await db.collection('cases').find({}).toArray();
    console.log(`\n--- CASES IN MONGODB ATLAS (${cases.length} documents) ---`);
    cases.forEach(c => {
      console.log(`- caseId: "${c.caseId}", patientId: "${c.patientId}", status: "${c.status}", doctorId: "${c.assignedDoctorId || c.doctorId}"`);
    });

    const referrals = await db.collection('referrals').find({}).toArray();
    console.log(`\n--- REFERRALS IN MONGODB ATLAS (${referrals.length} documents) ---`);
    referrals.forEach(r => {
      console.log(`- referralId: "${r.referralId}", caseId: "${r.caseId}", patientId: "${r.patientId}", doctorId: "${r.doctorId}", status: "${r.status}"`);
    });

    const patients = await db.collection('patients').find({}).toArray();
    console.log(`\n--- PATIENTS IN MONGODB ATLAS (${patients.length} documents) ---`);
    patients.forEach(p => {
      console.log(`- patientId: "${p.patientId}", name: "${p.name}", email: "${p.email}"`);
    });

  } finally {
    await client.close();
  }
}

inspectAtlas().catch(console.error);
