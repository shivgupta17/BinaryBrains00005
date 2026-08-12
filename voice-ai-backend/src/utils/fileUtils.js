const fs = require('fs');
const path = require('path');

const CONVERSATIONS_DIR = path.join(__dirname, '../../data/conversations');
const PATIENTS_DIR      = path.join(__dirname, '../../data/patients');
const CASES_DIR         = path.join(__dirname, '../../data/cases');
const DOCTORS_DIR       = path.join(__dirname, '../../data/doctors');
const REFERRALS_DIR     = path.join(__dirname, '../../data/referrals');
const NOTIFICATIONS_DIR = path.join(__dirname, '../../data/notifications');
const SCHEDULES_DIR     = path.join(__dirname, '../../data/schedules');
const USERS_DIR         = path.join(__dirname, '../../data/users');
const UPLOADS_DIR       = path.join(__dirname, '../../uploads');

function ensureDirs() {
  [CONVERSATIONS_DIR, PATIENTS_DIR, CASES_DIR, DOCTORS_DIR, REFERRALS_DIR, NOTIFICATIONS_DIR, SCHEDULES_DIR, USERS_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

ensureDirs();

function sanitizeId(id) {
  if (!id || typeof id !== 'string') return null;
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return clean.length > 0 ? clean : null;
}

// Conversation File Helpers
function getConversationPath(conversationId) {
  const cleanId = sanitizeId(conversationId);
  if (!cleanId) return null;
  const filePath = path.join(CONVERSATIONS_DIR, `${cleanId}.json`);
  if (!filePath.startsWith(CONVERSATIONS_DIR)) return null;
  return filePath;
}

function saveConversation(conversationData) {
  ensureDirs();
  const filePath = getConversationPath(conversationData.conversationId);
  if (!filePath) throw new Error('Invalid conversation ID');
  fs.writeFileSync(filePath, JSON.stringify(conversationData, null, 2), 'utf-8');
  return filePath;
}

function getConversation(conversationId) {
  const filePath = getConversationPath(conversationId);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function listConversations() {
  ensureDirs();
  const files = fs.readdirSync(CONVERSATIONS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const raw = fs.readFileSync(path.join(CONVERSATIONS_DIR, f), 'utf-8');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }).filter(Boolean);
}

// ─── PATIENT STORAGE HELPERS ──────────────────────
function getPatientDir(patientId) {
  const cleanId = sanitizeId(patientId) || 'PAT_DEFAULT';
  const pDir = path.join(PATIENTS_DIR, cleanId);
  if (!fs.existsSync(pDir)) {
    fs.mkdirSync(pDir, { recursive: true });
  }
  const docsDir = path.join(pDir, 'documents');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  return pDir;
}

function savePatient(patientId, patientData) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'patient.json');
  fs.writeFileSync(filePath, JSON.stringify(patientData, null, 2), 'utf-8');
  return patientData;
}

function getPatient(patientId) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'patient.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function savePatientVoice(patientId, voiceData) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'voice.json');
  fs.writeFileSync(filePath, JSON.stringify(voiceData, null, 2), 'utf-8');
  return voiceData;
}

function getPatientVoice(patientId) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'voice.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function savePatientDocument(patientId, docId, docData) {
  const pDir = getPatientDir(patientId);
  const cleanDocId = sanitizeId(docId) || `doc_${Date.now()}`;
  const filePath = path.join(pDir, 'documents', `${cleanDocId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(docData, null, 2), 'utf-8');
  return docData;
}

function getPatientDocuments(patientId) {
  const pDir = getPatientDir(patientId);
  const docsDir = path.join(pDir, 'documents');
  if (!fs.existsSync(docsDir)) return [];
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(docsDir, f), 'utf-8'));
    } catch (_) {
      return null;
    }
  }).filter(Boolean);
}

function savePatientVitals(patientId, vitalsData) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'vitals.json');
  fs.writeFileSync(filePath, JSON.stringify(vitalsData, null, 2), 'utf-8');
  return vitalsData;
}

function getPatientVitals(patientId) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'vitals.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function savePatientSummary(patientId, summaryData) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'ai-summary.json');
  fs.writeFileSync(filePath, JSON.stringify(summaryData, null, 2), 'utf-8');
  return summaryData;
}

function getPatientSummary(patientId) {
  const pDir = getPatientDir(patientId);
  const filePath = path.join(pDir, 'ai-summary.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// ─── CLINICAL ENCOUNTER CASE HELPERS (patientId vs caseId) ───────────
function getCaseDir(caseId) {
  const cleanId = sanitizeId(caseId) || 'CASE_DEFAULT';
  const cDir = path.join(CASES_DIR, cleanId);
  if (!fs.existsSync(cDir)) {
    fs.mkdirSync(cDir, { recursive: true });
  }
  return cDir;
}

function saveCase(caseId, caseData) {
  const cDir = getCaseDir(caseId);
  const filePath = path.join(cDir, 'case.json');
  fs.writeFileSync(filePath, JSON.stringify(caseData, null, 2), 'utf-8');
  return caseData;
}

function getCase(caseId) {
  const cleanId = sanitizeId(caseId);
  if (!cleanId) return null;
  const filePath = path.join(CASES_DIR, cleanId, 'case.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function addCaseTimelineEvent(caseId, event) {
  const cDir = getCaseDir(caseId);
  const filePath = path.join(cDir, 'timeline.json');
  let events = [];
  if (fs.existsSync(filePath)) {
    try {
      events = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (_) { events = []; }
  }

  const timelineEvent = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: event.type || 'NOTE',
    title: event.title || 'Case Event',
    description: event.description || '',
    actor: event.actor || 'System',
    actorRole: event.actorRole || 'assistant',
    data: event.data || {}
  };

  events.push(timelineEvent);
  fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf-8');

  try {
    const { getDb, isDbConnected } = require('../config/db');
    if (isDbConnected()) {
      const db = getDb();
      db.collection('caseTimeline').insertOne({ caseId, ...timelineEvent }).catch(() => {});
    }
  } catch (_) {}

  return timelineEvent;
}

function getCaseTimeline(caseId) {
  const cleanId = sanitizeId(caseId);
  if (!cleanId) return [];
  const filePath = path.join(CASES_DIR, cleanId, 'timeline.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) { return []; }
}

// ─── DOCTORS & REFERRALS HELPERS ──────────────────────
function saveDoctor(doctorData) {
  ensureDirs();
  const filePath = path.join(DOCTORS_DIR, `${doctorData.doctorId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(doctorData, null, 2), 'utf-8');
  return doctorData;
}

function getDoctor(doctorId) {
  const filePath = path.join(DOCTORS_DIR, `${doctorId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function listDoctors() {
  ensureDirs();
  seedDefaultDoctorsIfNeeded();
  const files = fs.readdirSync(DOCTORS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DOCTORS_DIR, f), 'utf-8'));
    } catch (_) { return null; }
  }).filter(Boolean);
}

function seedDefaultDoctorsIfNeeded() {
  const existing = fs.readdirSync(DOCTORS_DIR).filter(f => f.endsWith('.json'));
  if (existing.length > 0) return;

  const defaultDoctors = [
    {
      doctorId: 'DOC_01',
      name: 'Dr. Aarav Sharma',
      specialty: 'Orthopedics',
      subSpecialty: 'Trauma & Fracture Care',
      onlineStatus: 'ONLINE',
      hospital: 'GramCare Central Clinic',
      currentQueueCount: 1,
      email: 'aarav.sharma@gramcare.ai'
    },
    {
      doctorId: 'DOC_02',
      name: 'Dr. Priya Verma',
      specialty: 'Cardiology',
      subSpecialty: 'Emergency Cardiac Support',
      onlineStatus: 'ONLINE',
      hospital: 'District Hospital',
      currentQueueCount: 0,
      email: 'priya.verma@gramcare.ai'
    },
    {
      doctorId: 'DOC_03',
      name: 'Dr. Rajesh Mehra',
      specialty: 'General Medicine',
      subSpecialty: 'Internal Medicine & Respiratory',
      onlineStatus: 'ONLINE',
      hospital: 'Community Health Centre',
      currentQueueCount: 2,
      email: 'rajesh.mehra@gramcare.ai'
    }
  ];

  defaultDoctors.forEach(doc => saveDoctor(doc));
}

function saveReferral(referralData) {
  ensureDirs();
  const filePath = path.join(REFERRALS_DIR, `${referralData.referralId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(referralData, null, 2), 'utf-8');
  return referralData;
}

function getReferral(referralId) {
  const filePath = path.join(REFERRALS_DIR, `${referralId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function listReferrals() {
  ensureDirs();
  const files = fs.readdirSync(REFERRALS_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(REFERRALS_DIR, f), 'utf-8'));
    } catch (_) { return null; }
  }).filter(Boolean);
}

// ─── NOTIFICATIONS & SCHEDULE HELPERS ────────────────
function saveNotification(notifData) {
  ensureDirs();
  const filePath = path.join(NOTIFICATIONS_DIR, `${notifData.notificationId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(notifData, null, 2), 'utf-8');

  try {
    const { getDb, isDbConnected } = require('../config/db');
    if (isDbConnected()) {
      const db = getDb();
      db.collection('notifications').insertOne(notifData).catch(() => {});
    }
  } catch (_) {}

  return notifData;
}

function listNotifications(recipientRole = null, recipientId = null) {
  ensureDirs();
  const files = fs.readdirSync(NOTIFICATIONS_DIR).filter(f => f.endsWith('.json'));
  const all = files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(NOTIFICATIONS_DIR, f), 'utf-8'));
    } catch (_) { return null; }
  }).filter(Boolean);

  return all.filter(n => {
    if (recipientId && n.recipientId && n.recipientId !== recipientId) return false;
    if (recipientRole && n.recipientRole && n.recipientRole !== recipientRole) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function saveSchedule(scheduleData) {
  ensureDirs();
  const filePath = path.join(SCHEDULES_DIR, `${scheduleData.scheduleId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(scheduleData, null, 2), 'utf-8');
  return scheduleData;
}

function listSchedules() {
  ensureDirs();
  const files = fs.readdirSync(SCHEDULES_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(SCHEDULES_DIR, f), 'utf-8'));
    } catch (_) { return null; }
  }).filter(Boolean);
}

function deleteFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`Failed to delete file ${filePath}:`, err.message);
  }
}

module.exports = {
  CONVERSATIONS_DIR,
  PATIENTS_DIR,
  CASES_DIR,
  DOCTORS_DIR,
  REFERRALS_DIR,
  NOTIFICATIONS_DIR,
  SCHEDULES_DIR,
  USERS_DIR,
  UPLOADS_DIR,
  sanitizeId,
  saveConversation,
  getConversation,
  listConversations,
  savePatient,
  getPatient,
  savePatientVoice,
  getPatientVoice,
  savePatientDocument,
  getPatientDocuments,
  savePatientVitals,
  getPatientVitals,
  savePatientSummary,
  getPatientSummary,
  saveCase,
  getCase,
  addCaseTimelineEvent,
  getCaseTimeline,
  saveDoctor,
  getDoctor,
  listDoctors,
  saveReferral,
  getReferral,
  listReferrals,
  saveNotification,
  listNotifications,
  saveSchedule,
  listSchedules,
  deleteFile
};
