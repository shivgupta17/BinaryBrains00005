const { MongoClient } = require('mongodb');
require('dotenv').config();

async function inspectDoctorDocs() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in env!');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas!');
    const db = client.db();

    const doctorsCollection = db.collection('doctors');
    const usersCollection = db.collection('users');

    const doctorsDocs = await doctorsCollection.find({}).toArray();
    console.log(`=== DOCTORS COLLECTION (${doctorsDocs.length} docs) ===`);
    console.dir(doctorsDocs, { depth: null });

    const doctorUsersDocs = await usersCollection.find({ role: 'doctor' }).toArray();
    console.log(`=== USERS COLLECTION (role=doctor, ${doctorUsersDocs.length} docs) ===`);
    console.dir(doctorUsersDocs, { depth: null });

    const allUsers = await usersCollection.find({}).toArray();
    console.log(`=== ALL USERS COLLECTION (${allUsers.length} docs) ===`);
    console.dir(allUsers, { depth: null });

  } catch (err) {
    console.error('Error querying MongoDB:', err);
  } finally {
    await client.close();
  }
}

inspectDoctorDocs();
