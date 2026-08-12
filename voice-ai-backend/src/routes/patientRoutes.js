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

// Patient Endpoints (Protected by requireAuth)
router.post('/', requireAuth, documentController.registerPatient);
router.get('/lookup/:patientId', requireAuth, documentController.lookupPatientById);
router.get('/:patientId', requireAuth, documentController.lookupPatientById);
router.post('/:patientId/documents', requireAuth, upload.single('document'), documentController.uploadPatientDocument);
router.get('/:patientId/documents', requireAuth, documentController.getPatientDocuments);
router.get('/:patientId/documents/:documentId', requireAuth, documentController.getSinglePatientDocument);
router.post('/:patientId/ai-summary', requireAuth, documentController.generatePatientAiSummary);
router.get('/:patientId/ai-summary', requireAuth, documentController.getPatientSummary);
router.get('/:patientId/context', requireAuth, documentController.getPatientContextEndpoint);

// First-Aid & Medicine Gate Endpoints
router.get('/:patientId/first-aid', requireAuth, documentController.getPatientFirstAidProtocol);
router.get('/:patientId/medicine-gate', requireAuth, documentController.getPatientMedicineGate);

module.exports = router;
