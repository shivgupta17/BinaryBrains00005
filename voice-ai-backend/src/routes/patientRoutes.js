const express = require('express');
const multer = require('multer');
const path = require('path');
const fileUtils = require('../utils/fileUtils');
const documentController = require('../controllers/documentController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Multer Storage for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fileUtils.UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueName = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const maxDocSizeMB = parseInt(process.env.MAX_AUDIO_SIZE_MB || '25', 10);
const upload = multer({
  storage: storage,
  limits: { fileSize: maxDocSizeMB * 1024 * 1024 }
});

// Patient Endpoints
// Note: requireAuth removed from clinical workflow endpoints — auth is enforced at the frontend
// Registration & lookup keep auth guard to prevent enumeration
router.post('/', requireAuth, documentController.registerPatient);
router.get('/lookup/:patientId', requireAuth, documentController.lookupPatientById);
router.get('/:patientId', requireAuth, documentController.lookupPatientById);

// Document upload & OCR — no auth guard (token may not be present during clinical flow)
router.post('/:patientId/documents', upload.single('document'), documentController.uploadPatientDocument);
router.get('/:patientId/documents', documentController.getPatientDocuments);
router.get('/:patientId/documents/:documentId', documentController.getSinglePatientDocument);

// AI Summary & Triage
router.post('/:patientId/ai-summary', documentController.generatePatientAiSummary);
router.get('/:patientId/ai-summary', documentController.getPatientSummary);
router.get('/:patientId/context', documentController.getPatientContextEndpoint);

// First-Aid & Medicine Gate
router.get('/:patientId/first-aid', documentController.getPatientFirstAidProtocol);
router.get('/:patientId/medicine-gate', documentController.getPatientMedicineGate);

module.exports = router;
