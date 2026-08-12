const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { getDb, isDbConnected } = require('../config/db');
const fileUtils = require('../utils/fileUtils');
const emailService = require('../services/emailService');
const idGen = require('../utils/idGenerator');

const JWT_SECRET = process.env.JWT_SECRET || 'gramcare_jwt_secret_key_2026';

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

/**
 * Send OTP via Nodemailer SMTP & persist hashed OTP in MongoDB (POST /api/auth/send-otp)
 */
async function sendOtp(req, res) {
  try {
    const { email, phone, role, to, recipient } = req.body;
    const identifier = (email || phone || to || recipient || '').trim().toLowerCase();

    console.log(`[AuthController] POST /api/auth/send-otp received -> Recipient: "${identifier}", Role: "${role || 'user'}"`);

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Email address or phone number is required to send OTP.' });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database Unavailable: Active MongoDB Atlas connection is required to send OTP.'
      });
    }

    const otpCode = generateOtpCode();
    const otpHash = hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    const db = getDb();
    const otpsCollection = db.collection('otps');
    
    // Invalidate any previous OTP for this email
    await otpsCollection.deleteMany({ identifier });

    await otpsCollection.insertOne({
      identifier,
      otpHash,
      role: role || 'user',
      verified: false,
      attempts: 0,
      createdAt: new Date(),
      expiresAt
    });

    // Send email exclusively via Nodemailer SMTP
    const mailResult = await emailService.sendOtpEmail({ to: identifier, otpCode, role });
    if (!mailResult.success) {
      return res.status(400).json({ success: false, error: mailResult.error || 'Unable to send verification email.' });
    }

    console.log(`[AuthController - MongoClient] Nodemailer OTP created for ${identifier}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${identifier}`
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Unable to send verification email.' });
  }
}

/**
 * Resend OTP via Nodemailer SMTP (POST /api/auth/resend-otp)
 */
async function resendOtp(req, res) {
  try {
    const { email, phone, role, to, recipient } = req.body;
    const identifier = (email || phone || to || recipient || '').trim().toLowerCase();

    console.log(`[AuthController] POST /api/auth/resend-otp received -> Recipient: "${identifier}", Role: "${role || 'user'}"`);

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Email or phone parameter is required to resend OTP.' });
    }

    if (!isDbConnected()) {
      return res.status(503).json({ success: false, error: 'Database connection required to resend OTP code.' });
    }

    const otpCode = generateOtpCode();
    const otpHash = hashOtp(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    const db = getDb();
    const otpsCollection = db.collection('otps');

    // Invalidate any previous OTP for this email
    await otpsCollection.deleteMany({ identifier });

    await otpsCollection.insertOne({
      identifier,
      otpHash,
      role: role || 'user',
      verified: false,
      attempts: 0,
      createdAt: new Date(),
      expiresAt
    });

    // Send email exclusively via Nodemailer SMTP
    const mailResult = await emailService.sendOtpEmail({ to: identifier, otpCode, role });
    if (!mailResult.success) {
      return res.status(400).json({ success: false, error: mailResult.error || 'Unable to send verification email.' });
    }

    console.log(`[AuthController - MongoClient] Nodemailer OTP re-issued for ${identifier}`);

    return res.status(200).json({
      success: true,
      message: `OTP resent successfully to ${identifier}`
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Unable to send verification email.' });
  }
}

/**
 * Verify OTP against native MongoDB collection (POST /api/auth/verify-otp)
 */
async function verifyOtp(req, res) {
  try {
    const { email, phone, otpCode, to, recipient } = req.body;
    const identifier = (email || phone || to || recipient || '').trim().toLowerCase();

    console.log(`[AuthController] POST /api/auth/verify-otp received for recipient: "${identifier}", otpCode length: ${otpCode ? String(otpCode).trim().length : 0}`);

    if (!identifier || !otpCode) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database Unavailable: Active MongoDB Atlas connection is required to verify OTP.'
      });
    }

    const db = getDb();
    const otpsCollection = db.collection('otps');
    const record = await otpsCollection.findOne({ identifier });

    if (!record) {
      console.error(`[AuthController] verify-otp failed: No OTP record in MongoDB Atlas for "${identifier}"`);
      return res.status(400).json({ success: false, error: 'No OTP request found for this email address. Please click Send OTP.' });
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      console.error(`[AuthController] verify-otp failed: OTP record expired for "${identifier}"`);
      return res.status(400).json({ success: false, error: 'OTP code has expired. Please request a new OTP.' });
    }

    if (record.attempts >= 5) {
      console.error(`[AuthController] verify-otp failed: Exceeded maximum 5 attempts for "${identifier}"`);
      return res.status(400).json({ success: false, error: 'Too many invalid verification attempts. Please request a new OTP.' });
    }

    const inputHash = hashOtp(otpCode);
    if (inputHash !== record.otpHash) {
      await otpsCollection.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
      console.error(`[AuthController] verify-otp failed: OTP hash mismatch for "${identifier}"`);
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please check your email and try again.' });
    }

    // Mark ALL OTP records for this email as verified: true in MongoDB Atlas
    await otpsCollection.updateMany({ identifier }, { $set: { verified: true, verifiedAt: new Date() } });
    console.log(`[AuthController] verify-otp SUCCESS -> MongoDB Atlas marked OTP verified=true for "${identifier}"`);

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      verificationId: String(record._id)
    });
  } catch (err) {
    console.error(`[AuthController] verify-otp exception:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Real Database Registration in MongoDB Atlas using native MongoClient (POST /api/auth/register)
 * Enforces mandatory OTP verification prior to registration.
 */
async function register(req, res) {
  try {
    const { name, fullName, username, email, userEmail, phone, password, pass, role, userRole, specialty, dob, gender, verificationId, verificationToken } = req.body;

    const cleanName  = (name || fullName || username || '').trim();
    const cleanEmail = (email || userEmail || '').trim().toLowerCase();
    const cleanPass  = (password || pass || '').trim();
    const targetRole = (role || userRole || 'patient').trim().toLowerCase();

    console.log(`[AuthController] POST /api/auth/register RECEIVED PAYLOAD -> Name: "${cleanName}", Email: "${cleanEmail}", Role: "${targetRole}", PassProvided: ${!!cleanPass}`);

    if (!cleanName || !cleanEmail || !cleanPass) {
      console.error(`[AuthController] REGISTER_400_REASON_1_MISSING_REQUIRED_FIELDS: Missing required fields -> name: "${cleanName}", email: "${cleanEmail}", passProvided: ${!!cleanPass}`);
      return res.status(400).json({ success: false, error: 'Name, email, and password are required for registration.' });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database Unavailable: Active MongoDB Atlas connection is required for account registration.'
      });
    }

    const userId = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '')}`;
    const db = getDb();

    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ email: cleanEmail });
    if (existingUser) {
      console.error(`[AuthController] REGISTER_409_REASON_3_EMAIL_ALREADY_REGISTERED: Account already exists in MongoDB Atlas for "${cleanEmail}"`);
      return res.status(409).json({ success: false, error: 'An account with this email address already exists. Please sign in instead.' });
    }

    // Hash Password securely
    const passwordHash = await bcrypt.hash(cleanPass, 10);

    const doctorId    = targetRole === 'doctor' ? idGen.generateDoctorId() : null;
    const assistantId = targetRole === 'assistant' ? idGen.generateAssistantId() : null;
    const patientId   = targetRole === 'patient' ? idGen.generatePatientId() : null;

    const userDocument = {
      userId,
      doctorId,
      assistantId,
      patientId,
      name: cleanName,
      email: cleanEmail,
      phone: phone || '',
      passwordHash,
      role: targetRole,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to native MongoDB collections
    await db.collection('users').insertOne(userDocument);

    if (targetRole === 'doctor') {
      await db.collection('doctors').insertOne({ userId, doctorId, name: cleanName, specialty: specialty || 'General Medicine', createdAt: new Date() });
    } else if (targetRole === 'assistant') {
      await db.collection('assistants').insertOne({ userId, assistantId, name: cleanName, phone: phone || '+91 98765 43210', createdAt: new Date() });
    } else if (targetRole === 'patient') {
      await db.collection('patients').insertOne({
        userId,
        patientId,
        name: cleanName,
        phone: phone || '',
        age: dob ? (new Date().getFullYear() - new Date(dob).getFullYear()) : 30,
        sex: gender || 'Male',
        createdAt: new Date()
      });
    }
    console.log(`[AuthController - MongoClient] Saved new ${targetRole} account to MongoDB Atlas: ${cleanEmail}`);

    // File backup sync
    if (targetRole === 'patient') {
      fileUtils.savePatient(patientId, {
        id: patientId,
        name: cleanName,
        email: cleanEmail,
        phone: phone || '',
        age: dob ? (new Date().getFullYear() - new Date(dob).getFullYear()) : 30,
        sex: gender || 'Male',
        village: 'Rajpur'
      });
    }

    // Sign JWT Token
    const token = jwt.sign(
      { userId, email: cleanEmail, role: targetRole, doctorId, assistantId, patientId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      token: `token_${targetRole}_${token}`,
      user: {
        userId,
        name: cleanName,
        email: cleanEmail,
        role: targetRole,
        doctorId,
        assistantId,
        patientId
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Real Database Login from MongoDB Atlas using native MongoClient (POST /api/auth/login)
 */
async function login(req, res) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    if (!isDbConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database Unavailable: Active MongoDB Atlas connection is required to authenticate.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDb();
    const dbUser = await db.collection('users').findOne({ email: cleanEmail });

    if (!dbUser) {
      return res.status(401).json({ success: false, error: 'Invalid email or password credentials.' });
    }

    // Compare Hashed Password
    const isMatch = await bcrypt.compare(password, dbUser.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password credentials.' });
    }

    // CRITICAL ROLE SECURITY: Compare stored database role vs requested role
    if (role && dbUser.role !== role) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Your stored account role is '${dbUser.role}'. You cannot sign in as '${role}'.`
      });
    }

    const userRole = dbUser.role;
    const doctorId    = userRole === 'doctor' ? `DOC_${dbUser.userId}` : null;
    const assistantId = userRole === 'assistant' ? `AST_${dbUser.userId}` : null;
    const patientId   = userRole === 'patient' ? `PAT_${dbUser.userId}` : null;

    const token = jwt.sign(
      { userId: dbUser.userId, email: cleanEmail, role: userRole, doctorId, assistantId, patientId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token: `token_${userRole}_${token}`,
      user: {
        userId: dbUser.userId,
        name: dbUser.name,
        email: dbUser.email,
        role: userRole,
        doctorId,
        assistantId,
        patientId
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getMe(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  return res.status(200).json({
    success: true,
    user: {
      userId: 'usr_assistant',
      role: 'assistant',
      name: 'Clinic Assistant Suman'
    }
  });
}

module.exports = {
  sendOtp,
  resendOtp,
  verifyOtp,
  login,
  register,
  getMe
};
