const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const defaultDbName = 'gramcare_ai';

  if (!uri || uri.trim() === '') {
    console.warn('\n⚠️ [Database Warning] MONGODB_URI is not populated in voice-ai-backend/.env');
    console.warn('👉 Please set MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/gramcare_ai in .env for live MongoDB Atlas persistence.');
    
    // Attempt local native MongoClient connection
    try {
      client = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      db = client.db(defaultDbName);
      isConnected = true;
      console.log('✅ Connected to Local MongoDB via native MongoClient (mongodb://127.0.0.1:27017)\n');
      await createIndexes();
      return db;
    } catch (_) {
      console.log('ℹ️ Local MongoDB unavailable. Application running with native file storage fallback.\n');
      isConnected = false;
      return null;
    }
  }

  try {
    // Native MongoClient options with SSL fallback for Windows Node OpenSSL environments
    const clientOptions = {
      serverSelectionTimeoutMS: 5000,
      tls: true,
      tlsAllowInvalidCertificates: true
    };

    client = new MongoClient(uri, clientOptions);
    await client.connect();
    db = client.db();
    isConnected = true;
    console.log('\n======================================================');
    console.log('🍃 Native MongoClient: MongoDB Atlas Connected Successfully!');
    console.log(`👉 Database Name: ${db.databaseName}`);
    console.log('======================================================\n');
    await createIndexes();
    return db;
  } catch (err) {
    console.error('\n❌ [MongoClient Atlas Connection Error]:', err.message);
    console.error('👉 Attempting local fallback connection...\n');

    try {
      client = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      db = client.db(defaultDbName);
      isConnected = true;
      console.log('✅ Local MongoDB connected via MongoClient!\n');
      await createIndexes();
      return db;
    } catch (_) {
      isConnected = false;
      console.warn('ℹ️ Running with persistent JSON file storage fallback.\n');
      return null;
    }
  }
}

async function createIndexes() {
  if (!db) return;
  try {
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ userId: 1 }, { unique: true });

    const otps = db.collection('otps');
    await otps.createIndex({ email: 1 });
    await otps.createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });
  } catch (e) {
    console.warn('[MongoClient] Index notice:', e.message);
  }
}

function getDb() {
  return db;
}

function isDbConnected() {
  return isConnected && !!db;
}

function getDbStatus() {
  return {
    connected: isDbConnected(),
    state: isDbConnected() ? 'connected' : 'disconnected',
    databaseName: db ? db.databaseName : 'gramcare_ai'
  };
}

module.exports = {
  connectDB,
  getDb,
  isDbConnected,
  getDbStatus
};
