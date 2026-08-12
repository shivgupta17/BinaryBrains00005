const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb, isDbConnected } = require('../config/db');
const fileUtils = require('../utils/fileUtils');
const emailService = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'gramcare_jwt_secret_key_2026';

function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via Nodemailer & persist to MongoDB via native MongoClient (POST /api/auth/send-otp)
 */
async function sendOtp(req, res) {
  try {
    const { email, phone, role } = req.body;
    const identifier = (email || phone || '').trim().toLowerCase();

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'Email address or phone number is required to send OTP.' });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Save to native MongoDB collection if connected
    if (isDbConnected()) {
      const db = getDb();
      const otpsCollection = db.collection('otps');
      await otpsCollection.deleteMany({ email: identifier });
      await otpsCollection.insertOne({
        email: identifier,
        otpCode,
        expiresAt,
        verified: false,
        createdAt: new Date()
      });
    }

    // Send email notification via Nodemailer
    await emailService.sendEmail({
      to: identifier,
      subject: `[GramCare Clinic] Your OTP Verification Code`,
      text: `Your GramCare AI verification code is: ${otpCode}. It expires in 5 minutes.`,
      html: `
        <div style="font-family:sans-serif;padding:18px;background:#F2F5FB;border-radius:12px;">
          <h3 style="color:#E8692A;margin-top:0;">🏥 GramCare AI Authentication</h3>
          <p>Your verification code for role <strong>${role || 'user'}</strong> is:</p>
          <div style="font-size:28px;font-weight:700;letter-spacing:4px;color:#1B6B4A;margin:16px 0;">${otpCode}</div>
          <p style="font-size:12px;color:#666;">Valid for 5 minutes. Do not share this code with anyone.</p>
        </div>
      `
    });

    console.log(`[AuthController - MongoClient] OTP generated for ${identifier}: ${otpCode}`);

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${identifier}`,
      otpDemoCode: otpCode
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Verify OTP against native MongoDB collection (POST /api/auth/verify-otp)
 */
async function verifyOtp(req, res) {
  try {
    const { email, phone, otpCode } = req.body;
    const identifier = (email || phone || '').trim().toLowerCase();

    if (!identifier || !otpCode) {
      return res.status(400).json({ success: false, error: 'Email and OTP code are required.' });
    }

    if (isDbConnected()) {
      const db = getDb();
      const otpsCollection = db.collection('otps');
      const otpRecord = await otpsCollection.findOne({
        email: identifier,
        otpCode: String(otpCode).trim(),
        verified: false,
        expiresAt: { $gt: new Date() }
      });

      if (!otpRecord) {
        return res.status(400).json({ success: false, error: 'Invalid or expired OTP code.' });
      }

      await otpsCollection.updateOne({ _id: otpRecord._id }, { $set: { verified: true } });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Real Database Registration in MongoDB Atlas using native MongoClient (POST /api/auth/register)
 */
async function register(req, res) {
  try {
    const { name, email, phone, password, role, specialty, dob, gender } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required for registration.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRole   = role || 'patient';
    const userId     = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '')}`;

    // Duplicate Account Check in MongoDB
    if (isDbConnected()) {
      const db = getDb();
      const usersCollection = db.collection('users');
      const existingUser = await usersCollection.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, error: 'An account with this email address already exists.' });
      }
    }

    // Hash Password securely
    const passwordHash = await bcrypt.hash(password, 10);

    const doctorId    = userRole === 'doctor' ? `DOC_${userId}` : null;
    const assistantId = userRole === 'assistant' ? `AST_${userId}` : null;
    const patientId   = userRole === 'patient' ? `PAT_${userId}` : null;

    const userDocument = {
      userId,
      name,
      email: cleanEmail,
      phone: phone || '',
      passwordHash,
      role: userRole,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to native MongoDB collections
    if (isDbConnected()) {
      const db = getDb();
      await db.collection('users').insertOne(userDocument);

      if (userRole === 'doctor') {
        await db.collection('doctors').insertOne({ userId, doctorId, name, specialty: specialty || 'General Medicine', createdAt: new Date() });
      } else if (userRole === 'assistant') {
        await db.collection('assistants').insertOne({ userId, assistantId, name, phone: phone || '+91 98765 43210', createdAt: new Date() });
      } else if (userRole === 'patient') {
        await db.collection('patients').insertOne({
          userId,
          patientId,
          name,
          phone: phone || '',
          age: dob ? (new Date().getFullYear() - new Date(dob).getFullYear()) : 30,
          sex: gender || 'Male',
          createdAt: new Date()
        });
      }
      console.log(`[AuthController - MongoClient] Saved new ${userRole} account to MongoDB Atlas: ${cleanEmail}`);
    }

    // File backup sync
    if (userRole === 'patient') {
      fileUtils.savePatient(patientId, {
        id: patientId,
        name,
        email: cleanEmail,
        phone: phone || '',
        age: dob ? (new Date().getFullYear() - new Date(dob).getFullYear()) : 30,
        sex: gender || 'Male',
        village: 'Rajpur'
      });
    }

    // Sign JWT Token
    const token = jwt.sign(
      { userId, email: cleanEmail, role: userRole, doctorId, assistantId, patientId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      token: `token_${userRole}_${token}`,
      user: {
        userId,
        name,
        email: cleanEmail,
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

/**
 * Real Database Login from MongoDB Atlas using native MongoClient (POST /api/auth/login)
 */
async function login(req, res) {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    let dbUser = null;
    if (isDbConnected()) {
      const db = getDb();
      dbUser = await db.collection('users').findOne({ email: cleanEmail });
    }

    if (dbUser) {
      // Compare Hashed Password
      const isMatch = await bcrypt.compare(password, dbUser.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid password credentials.' });
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
    }

    // Default fallback handling for initial seed demo users if DB not populated yet
    const userRole = role || (cleanEmail.includes('doctor') ? 'doctor' : (cleanEmail.includes('patient') ? 'patient' : 'assistant'));
    const userId = `usr_${cleanEmail.replace(/[^a-z0-9]/g, '')}`;

    const userObj = {
      userId,
      email: cleanEmail,
      role: userRole,
      name: userRole === 'doctor' ? (cleanEmail.includes('cardio') ? 'Dr. Priya Verma' : 'Dr. Aarav Sharma') : (userRole === 'patient' ? 'Rohan Sharma' : 'Clinic Assistant Suman'),
      specialty: userRole === 'doctor' ? (cleanEmail.includes('cardio') ? 'Cardiology' : 'Orthopedics') : null,
      doctorId: userRole === 'doctor' ? 'DOC_01' : null,
      assistantId: userRole === 'assistant' ? 'ASSISTANT_01' : null,
      patientId: userRole === 'patient' ? 'PAT_DUAL_PANEL_01' : null
    };

    const token = jwt.sign(
      { userId, email: cleanEmail, role: userRole, doctorId: userObj.doctorId, assistantId: userObj.assistantId, patientId: userObj.patientId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token: `token_${userRole}_${token}`,
      user: userObj
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
  verifyOtp,
  login,
  register,
  getMe
};
