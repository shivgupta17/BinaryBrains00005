const { MongoClient } = require('mongodb');

async function inspectAtlas() {
  const uri = process.env.MONGO_URI || "mongodb+srv://gramcare_db:Gramcare123@gramcarecluster.efmsv.mongodb.net/?retryWrites=true&w=majority&appName=GramCareCluster";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.');
    const db = client.db('test');

    const cases = await db.collection('cases').find({}).toArray();
    console.log(`\n--- CASES COLLECTION (${cases.length} docs) ---`);
    cases.forEach(c => {
      console.log(`_id: ${c._id}, caseId: ${c.caseId}, patientId: ${c.patientId}, status: ${c.status}, doctorId: ${c.assignedDoctorId || c.doctorId}`);
    });

    const referrals = await db.collection('referrals').find({}).toArray();
    console.log(`\n--- REFERRALS COLLECTION (${referrals.length} docs) ---`);
    referrals.forEach(r => {
      console.log(`referralId: ${r.referralId}, caseId: ${r.caseId}, patientId: ${r.patientId}, doctorId: ${r.doctorId}, status: ${r.status}`);
    });

    const patients = await db.collection('patients').find({}).toArray();
    console.log(`\n--- PATIENTS COLLECTION (${patients.length} docs) ---`);
    patients.forEach(p => {
      console.log(`patientId: ${p.patientId}, name: ${p.name}, email: ${p.email}`);
    });

  } finally {
    await client.close();
  }
}

inspectAtlas().catch(console.error);
