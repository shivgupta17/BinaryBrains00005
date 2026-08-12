const express = require('express');
const multer = require('multer');
const path = require('path');
const voiceController = require('../controllers/voiceController');
const { UPLOADS_DIR } = require('../utils/fileUtils');

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    const uniqueName = `audio_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter for audio MIME types
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

const maxMb = parseInt(process.env.MAX_AUDIO_SIZE_MB || '25', 10);
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxMb * 1024 * 1024 }
});

// Routes
router.post('/complete', upload.single('audio'), voiceController.completeVoiceIntake);
router.post('/:conversationId/analyze', voiceController.analyzeVoiceConversation);
router.get('/:conversationId', voiceController.getVoiceConversation);
router.get('/', voiceController.listVoiceConversations);

module.exports = router;
