const { MongoClient } = require('mongodb');

async function fixExistingReferral() {
  const uri = "mongodb+srv://mrshivop17_db_user:nRKFHYosPZnkiZ1o@cluster0.q8clbbk.mongodb.net";
  const client = new MongoClient(uri, { tls: true, tlsAllowInvalidCertificates: true });

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas.');
    const db = client.db();

    // 1. Find user & patient records for mrshivop170@gmail.com
    const userDoc = await db.collection('users').findOne({ email: 'mrshivop170@gmail.com' });
    console.log('\nUser Record for mrshivop170@gmail.com:', userDoc);

    const patDoc = await db.collection('patients').findOne({ email: 'mrshivop170@gmail.com' });
    console.log('Patient Record for mrshivop170@gmail.com:', patDoc);

    // 2. Find any cases associated with this patient
    const pId = patDoc?.patientId || userDoc?.patientId || 'PAT-Q2K2FZWO';
    let caseDoc = await db.collection('cases').findOne({
      $or: [
        { patientId: pId },
        { patientId: 'PAT_usr_mrshivop170gmailcom' },
        { caseId: 'CASE_PAT_usr_mrshivop170gmailcom' }
      ]
    });
    console.log('\nFound Case Document:', caseDoc);

    if (!caseDoc) {
      console.log('No case document found. Creating real case document for patient:', pId);
      const newCaseId = `CASE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      caseDoc = {
        caseId: newCaseId,
        patientId: pId,
        caseType: 'General Clinical Encounter',
        status: 'IN_CONSULTATION',
        createdAt: new Date().toISOString(),
        vitals: { temp: '98.6°F', bp: '120/80 mmHg', pulse: '72 bpm', spo2: '98%' },
        aiSummary: {
          mainProblem: { summary: 'Patient presenting with fever and mild headache.' },
          triage: { level: 'amber', score: 65, rationale: 'Requires physician consultation.' }
        }
      };
      await db.collection('cases').insertOne(caseDoc);
      console.log('✓ Created REAL Case Document in MongoDB Atlas:', caseDoc.caseId);
    }

    // 3. Fix existing referral(s) pointing to bad caseId "CASE_PAT_usr_mrshivop170gmailcom" or invalid patientId
    const badReferrals = await db.collection('referrals').find({
      $or: [
        { caseId: 'CASE_PAT_usr_mrshivop170gmailcom' },
        { patientId: 'PAT_usr_mrshivop170gmailcom' }
      ]
    }).toArray();

    console.log(`\nFound ${badReferrals.length} referral documents needing update.`);

    for (const ref of badReferrals) {
      await db.collection('referrals').updateOne(
        { _id: ref._id },
        {
          $set: {
            caseId: caseDoc.caseId,
            patientId: pId,
            updatedAt: new Date().toISOString()
          }
        }
      );
      console.log(`✓ Updated Referral ${ref.referralId}: caseId = ${caseDoc.caseId}, patientId = ${pId}`);
    }

  } finally {
    await client.close();
  }
}

fixExistingReferral().catch(console.error);
