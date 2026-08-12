const fs = require('fs');
const path = require('path');

const CONVERSATIONS_DIR = path.join(__dirname, '../../data/conversations');
const PATIENTS_DIR = path.join(__dirname, '../../data/patients');
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

function ensureDirs() {
  [CONVERSATIONS_DIR, PATIENTS_DIR, UPLOADS_DIR].forEach(dir => {
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

// Conversation File Helpers (Legacy voice intake)
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

// ─── PATIENT CASE STORAGE HELPERS ──────────────────────
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
  deleteFile
};
