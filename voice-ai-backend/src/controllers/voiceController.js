const fileUtils = require('../utils/fileUtils');
const geminiService = require('../services/geminiService');
const { getDb, isDbConnected } = require('../config/db');

/**
 * Helper to generate conversation ID
 */
function generateConversationId() {
  const dateStr = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 8);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `conv_${dateStr}_${randomStr}`;
}

/**
 * STEP 4: Complete Voice Intake (POST /api/voice/complete)
 */
async function completeVoiceIntake(req, res) {
  let uploadedFilePath = null;
  try {
    const file = req.file;
    const apiKeyConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_api_key_here');
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    console.log('\n------------------------------------------------------');
    console.log('[VOICE DEBUG] Request received');
    console.log('[VOICE DEBUG] req.file exists:', Boolean(file));
    console.log('[VOICE DEBUG] filename:', file ? file.filename : 'N/A');
    console.log('[VOICE DEBUG] mimetype:', file ? file.mimetype : 'N/A');
    console.log('[VOICE DEBUG] size:', file ? `${file.size} bytes` : 'N/A');
    console.log('[VOICE DEBUG] path:', file ? file.path : 'N/A');
    console.log('[VOICE DEBUG] Gemini API key configured:', apiKeyConfigured);
    console.log('[VOICE DEBUG] Gemini model:', modelName);
    console.log('------------------------------------------------------\n');

    // Strict validation: Reject missing, empty, or zero-byte audio files
    if (!file || !file.path || file.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'The recorded audio is empty or invalid. Please record audio before clicking Done.'
      });
    }

    uploadedFilePath = file.path;
    const conversationId = generateConversationId();
    const createdAt = new Date().toISOString();

    // Stage 1: Transcribe & Translate (NO AI Problem Analysis)
    const result = await geminiService.transcribeAndTranslateAudio(
      uploadedFilePath,
      file.mimetype || 'audio/webm'
    );

    // Clean up temporary audio file unless SAVE_AUDIO=true
    const saveAudio = process.env.SAVE_AUDIO === 'true';
    if (!saveAudio && uploadedFilePath) {
      fileUtils.deleteFile(uploadedFilePath);
    }

    const patientId = req.body.patientId || req.headers['x-patient-id'] || 'PAT_DEFAULT';

    // Structure JSON with aiAnalysis = null
    const conversationData = {
      conversationId,
      patientId,
      createdAt,
      language: result.language,
      transcription: result.transcription,
      aiAnalysis: null // MUST remain null at Stage 1
    };

    // Save JSON to data/conversations/{conversationId}.json AND data/patients/{patientId}/voice.json
    fileUtils.saveConversation(conversationData);
    if (patientId) {
      fileUtils.savePatientVoice(patientId, conversationData);
    }

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('conversations').updateOne({ conversationId }, { $set: conversationData }, { upsert: true });
      await db.collection('voice').updateOne(
        { $or: [{ conversationId }, { patientId }] },
        { $set: { conversationId, patientId, language: result.language, transcription: result.transcription, createdAt } },
        { upsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      conversationId,
      patientId,
      status: 'ready_for_ai',
      data: {
        language: result.language,
        transcription: result.transcription
      }
    });
  } catch (err) {
    console.error('[VoiceController] Error in completeVoiceIntake:', err.stack || err.message);
    if (uploadedFilePath) fileUtils.deleteFile(uploadedFilePath);
    
    // Return detailed safe error response without fake fallbacks
    return res.status(500).json({
      success: false,
      error: 'Voice transcription failed',
      details: err.message || 'Failed to process voice intake recording with Gemini AI'
    });
  }
}

/**
 * STEP 6 & 7: AI Problem Analysis (POST /api/voice/:conversationId/analyze)
 */
async function analyzeVoiceConversation(req, res) {
  try {
    const { conversationId } = req.params;
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing conversationId parameter'
      });
    }

    // Load exact JSON file for this conversationId
    const conversation = fileUtils.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: `Conversation not found: ${conversationId}`
      });
    }

    console.log(`[VoiceController] Loading exact conversation JSON for analyze: ${conversationId}`);

    // Call Gemini to analyze problem on REAL transcript
    const aiAnalysisResult = await geminiService.analyzeClientProblem(conversation.transcription);

    // Update conversation JSON
    conversation.aiAnalysis = aiAnalysisResult;
    fileUtils.saveConversation(conversation);

    const patientId = conversation.patientId || req.body.patientId || 'PAT_DEFAULT';
    if (patientId) {
      fileUtils.savePatientVoice(patientId, conversation);
    }

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('conversations').updateOne({ conversationId }, { $set: { aiAnalysis: aiAnalysisResult } });
      await db.collection('voice').updateOne(
        { $or: [{ conversationId }, { patientId }] },
        { $set: { aiAnalysis: aiAnalysisResult, transcription: conversation.transcription, language: conversation.language, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );

      // Save real AI Summary & Triage directly into cases collection in MongoDB Atlas
      const identifiedProb = aiAnalysisResult?.clientProblem?.identifiedProblem || aiAnalysisResult?.identifiedProblem || 'Clinical Evaluation';
      const probSummary = aiAnalysisResult?.clientProblem?.problemSummary || aiAnalysisResult?.summary || 'Voice intake clinical summary.';
      const triageLevel = (aiAnalysisResult?.triageLevel || aiAnalysisResult?.triage?.level || 'amber').toLowerCase();

      const aiSummaryDoc = {
        summary: probSummary,
        mainProblem: {
          title: identifiedProb,
          summary: probSummary
        },
        reportedSymptoms: aiAnalysisResult?.clientProblem?.reportedSymptoms || [],
        keyIssues: aiAnalysisResult?.clientProblem?.keyIssues || [],
        recommendedNextStep: aiAnalysisResult?.recommendedNextStep || 'Physician consultation and review'
      };

      const triageDoc = {
        level: triageLevel,
        rationale: aiAnalysisResult?.triageRationale || 'Physician consultation requested based on clinical symptoms.',
        recommendedAction: aiAnalysisResult?.recommendedNextStep || 'Physician review and prescription'
      };

      await db.collection('cases').updateMany(
        { $or: [{ patientId }, { caseId: req.body.caseId }] },
        { $set: { aiSummary: aiSummaryDoc, triage: triageDoc, updatedAt: new Date().toISOString() } }
      );
    }

    return res.status(200).json({
      success: true,
      conversationId,
      data: conversation
    });
  } catch (err) {
    console.error('[VoiceController] Error in analyzeVoiceConversation:', err.stack || err.message);
    return res.status(500).json({
      success: false,
      error: 'Voice problem analysis failed',
      details: err.message || 'Failed to analyze conversation with Gemini AI'
    });
  }
}

/**
 * GET /api/voice/:conversationId
 */
async function getVoiceConversation(req, res) {
  try {
    const { conversationId } = req.params;
    const conversation = fileUtils.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: `Conversation not found: ${conversationId}`
      });
    }
    return res.status(200).json({
      success: true,
      data: conversation
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /api/voice
 */
async function listVoiceConversations(req, res) {
  try {
    const conversations = fileUtils.listConversations();
    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

module.exports = {
  completeVoiceIntake,
  analyzeVoiceConversation,
  getVoiceConversation,
  listVoiceConversations
};
