const { MongoClient } = require('mongodb');
require('dotenv').config();

async function inspectDoctorsCollectionOnly() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const docs = await db.collection('doctors').find({}).toArray();
    console.log('=== DOCTORS COLLECTION DATA ===');
    console.dir(docs, { depth: null });
  } finally {
    await client.close();
  }
}

inspectDoctorsCollectionOnly();
