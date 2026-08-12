const fileUtils = require('../utils/fileUtils');
const ocrService = require('../services/ocrService');
const documentAiService = require('../services/documentAiService');
const aiSummaryService = require('../services/aiSummaryService');
const patientContextService = require('../services/patientContextService');
const firstAidService = require('../services/firstAidService');
const medicineGateService = require('../services/medicineGateService');
const { getDb, isDbConnected } = require('../config/db');

/**
 * Register / Update Patient Demographics & Vitals
 * POST /api/patients
 */
async function registerPatient(req, res) {
  try {
    const { id, name, age, sex, village, language, vitals, history, allergies } = req.body;
    const patientId = fileUtils.sanitizeId(id) || `PAT_${Date.now()}`;

    const patientData = {
      patientId,
      id: patientId,
      name: name || 'Patient',
      age: age ? parseInt(age, 10) : 'Not provided',
      sex: sex || 'Not provided',
      village: village || 'Not provided',
      language: language || 'Hindi',
      history: history || [],
      allergies: allergies || [],
      updatedAt: new Date().toISOString()
    };

    fileUtils.savePatient(patientId, patientData);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('patients').updateOne({ patientId }, { $set: patientData }, { upsert: true });
      if (vitals) {
        await db.collection('vitals').updateOne({ patientId }, { $set: { ...vitals, updatedAt: new Date().toISOString() } }, { upsert: true });
      }
    }

    if (vitals) {
      fileUtils.savePatientVitals(patientId, vitals);
    }

    return res.status(200).json({
      success: true,
      patientId,
      data: patientData
    });
  } catch (err) {
    console.error('[DocumentController] Register patient error:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Upload & Process Patient Medical Document (Real OCR + Gemini AI Extraction)
 * POST /api/patients/:patientId/documents
 */
async function uploadPatientDocument(req, res) {
  let uploadedFilePath = null;
  try {
    const { patientId } = req.params;
    const file = req.file;

    if (!file || !file.path || file.size === 0) {
      return res.status(400).json({
        success: false,
        error: 'The uploaded document file is missing or empty.'
      });
    }

    uploadedFilePath = file.path;
    const cleanPatientId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';

    console.log(`[DocumentController] Processing document upload for patient ${cleanPatientId}: ${file.originalname} (${file.size} bytes)`);

    const ocrResult = await ocrService.processDocumentOCR(uploadedFilePath, file.originalname, file.mimetype);

    let aiExtraction = null;
    try {
      aiExtraction = await documentAiService.extractDocumentInformation(ocrResult, uploadedFilePath, file.mimetype);
    } catch (aiErr) {
      console.warn('[DocumentController] Document AI extraction warning:', aiErr.message);
      aiExtraction = {
        documentType: 'unknown',
        extractedData: { medications: [], diagnoses: [], symptoms: [], labResults: [], medicalHistory: [], allergies: [] },
        safetyFlags: [],
        confidence: 0
      };
    }

    const saveDocs = process.env.SAVE_AUDIO === 'true';
    if (!saveDocs && uploadedFilePath) {
      fileUtils.deleteFile(uploadedFilePath);
    }

    const docRecord = {
      documentId: ocrResult.documentId,
      patientId: cleanPatientId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
      documentType: aiExtraction.documentType || 'unknown',
      ocrText: ocrResult.fullText || '',
      ocrEngine: ocrResult.ocr?.engine || 'PaddleOCR',
      extractedData: aiExtraction.extractedData || {
        medications: [],
        diagnoses: [],
        symptoms: [],
        labResults: [],
        medicalHistory: [],
        allergies: [],
        dates: [],
        doctorName: null,
        hospitalName: null
      },
      safetyFlags: aiExtraction.safetyFlags || [],
      woundAssessment: aiExtraction.woundAssessment || null,
      confidence: aiExtraction.confidence || 0.9
    };

    fileUtils.savePatientDocument(cleanPatientId, docRecord.documentId, docRecord);

    if (isDbConnected()) {
      const db = getDb();
      await db.collection('documents').updateOne({ documentId: docRecord.documentId }, { $set: docRecord }, { upsert: true });
    }

    return res.status(200).json({
      success: true,
      patientId: cleanPatientId,
      documentId: docRecord.documentId,
      data: docRecord
    });
  } catch (err) {
    console.error('[DocumentController] Error in uploadPatientDocument:', err.message);
    if (uploadedFilePath) fileUtils.deleteFile(uploadedFilePath);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to process document OCR and AI extraction'
    });
  }
}

async function getPatientDocuments(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
    const docs = fileUtils.getPatientDocuments(cleanId);
    return res.status(200).json({
      success: true,
      patientId: cleanId,
      count: docs.length,
      data: docs
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

async function getSinglePatientDocument(req, res) {
  try {
    const { patientId, documentId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
    const docs = fileUtils.getPatientDocuments(cleanId);
    const doc = docs.find(d => d.documentId === documentId);

    if (!doc) {
      return res.status(404).json({
        success: false,
        error: `Document not found: ${documentId}`
      });
    }

    return res.status(200).json({
      success: true,
      data: doc
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

async function generatePatientAiSummary(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';

    const summaryResult = await aiSummaryService.generatePatientAiSummary(cleanId);

    return res.status(200).json({
      success: true,
      patientId: cleanId,
      data: summaryResult
    });
  } catch (err) {
    console.error('[DocumentController] Error in generatePatientAiSummary:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate unified AI summary & triage'
    });
  }
}

async function getPatientSummary(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
    const summary = fileUtils.getPatientSummary(cleanId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'AI summary not generated yet for this patient.'
      });
    }

    return res.status(200).json({
      success: true,
      patientId: cleanId,
      data: summary
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

async function getPatientContextEndpoint(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
    const context = patientContextService.getPatientContext(cleanId);

    return res.status(200).json({
      success: true,
      patientId: cleanId,
      data: context
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * GET /api/patients/:patientId/first-aid
 */
async function getPatientFirstAidProtocol(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
    const result = await firstAidService.getFirstAidProtocolForPatient(cleanId);

    return res.status(200).json({
      success: true,
      patientId: cleanId,
      data: result
    });
  } catch (err) {
    console.error('[DocumentController] Error in getPatientFirstAidProtocol:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve first-aid protocol'
    });
  }
}

/**
 * GET /api/patients/:patientId/medicine-gate
 */
async function getPatientMedicineGate(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = fileUtils.sanitizeId(patientId) || 'PAT_DEFAULT';
    const result = await medicineGateService.evaluateMedicineGateForPatient(cleanId);

    return res.status(200).json({
      success: true,
      patientId: cleanId,
      data: result
    });
  } catch (err) {
    console.error('[DocumentController] Error in getPatientMedicineGate:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function lookupPatientById(req, res) {
  try {
    const { patientId } = req.params;
    const cleanId = (patientId || '').trim();

    if (!cleanId) {
      return res.status(400).json({ success: false, error: 'Patient ID parameter is required.' });
    }

    let patient = null;
    let activeCase = null;

    if (isDbConnected()) {
      const db = getDb();
      patient = await db.collection('patients').findOne({
        $or: [
          { patientId: cleanId },
          { userId: cleanId }
        ]
      });

      if (!patient) {
        const userDoc = await db.collection('users').findOne({
          role: 'patient',
          $or: [
            { patientId: cleanId },
            { userId: cleanId }
          ]
        });
        if (userDoc) {
          patient = {
            patientId: userDoc.patientId || cleanId,
            name: userDoc.name,
            email: userDoc.email,
            phone: userDoc.phone || '',
            age: 30,
            sex: 'Male'
          };
        }
      }

      if (patient) {
        const pId = patient.patientId || cleanId;
        activeCase = await db.collection('cases').findOne({
          patientId: pId,
          status: { $in: ['OPEN', 'REFERRED', 'IN_CONSULTATION'] }
        });
      }
    }

    if (!patient) {
      patient = fileUtils.getPatient(cleanId);
    }

    if (!patient) {
      return res.status(404).json({ success: false, error: `Patient not found for ID: ${cleanId}` });
    }

    const pId = patient.patientId || cleanId;
    if (!activeCase) {
      activeCase = fileUtils.getCase(`CASE_${pId}`) || fileUtils.getCase(pId);
    }

    const vitals = fileUtils.getPatientVitals(pId) || {};
    const summary = fileUtils.getPatientSummary(pId) || null;

    return res.status(200).json({
      success: true,
      data: {
        patientId: pId,
        name: patient.name || 'Patient',
        age: patient.age || 30,
        sex: patient.sex || 'Male',
        village: patient.village || 'Rajpur',
        email: patient.email || '',
        phone: patient.phone || '',
        vitals,
        aiSummary: summary,
        currentCaseId: activeCase ? activeCase.caseId : null,
        caseStatus: activeCase ? activeCase.status : 'NO_ACTIVE_CASE',
        assignedDoctorId: activeCase ? activeCase.assignedDoctorId : null,
        assignedAssistantId: activeCase ? activeCase.assistantId : null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  registerPatient,
  lookupPatientById,
  uploadPatientDocument,
  getPatientDocuments,
  getSinglePatientDocument,
  generatePatientAiSummary,
  getPatientSummary,
  getPatientContextEndpoint,
  getPatientFirstAidProtocol,
  getPatientMedicineGate
};
