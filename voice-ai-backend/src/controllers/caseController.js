const fileUtils = require('../utils/fileUtils');
const patientContextService = require('../services/patientContextService');
const aiSummaryService = require('../services/aiSummaryService');

/**
 * Creates a new clinical encounter case (separates patientId vs caseId)
 */
async function createCase(req, res) {
  try {
    const { patientId, caseType, assistantId } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, error: 'patientId is required' });
    }

    const cleanPatientId = fileUtils.sanitizeId(patientId);
    const caseId = `CASE_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const createdAt = new Date().toISOString();

    const caseData = {
      caseId,
      patientId: cleanPatientId,
      assistantId: assistantId || 'ASSISTANT_DEFAULT',
      createdAt,
      status: 'OPEN',
      caseType: caseType || 'General Consultation',
      textStatements: [],
      imageUploads: [],
      videoUploads: [],
      doctorNotes: [],
      assistantNotes: [],
      assignedDoctorId: null,
      bedAssignment: null,
      followUp: null,
      medications: []
    };

    fileUtils.saveCase(caseId, caseData);
    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'PATIENT_REGISTERED',
      title: 'Encounter Case Created',
      description: `New clinical encounter ${caseId} created for patient ${cleanPatientId}`,
      actor: 'Clinic Assistant',
      actorRole: 'assistant'
    });

    return res.status(201).json({
      success: true,
      caseId,
      patientId: cleanPatientId,
      data: caseData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getCaseDetails(req, res) {
  try {
    const { caseId } = req.params;
    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const fullContext = patientContextService.getPatientCaseContext(caseData.patientId, caseId);
    return res.status(200).json({
      success: true,
      data: fullContext
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function addCaseVitals(req, res) {
  try {
    const { caseId } = req.params;
    const { temp, bp, pulse, spo2, weight, respRate } = req.body;

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const vitalsData = {
      temp: temp || 'Not recorded',
      bp: bp || 'Not recorded',
      pulse: pulse || 'Not recorded',
      spo2: spo2 || 'Not recorded',
      weight: weight || 'Not recorded',
      respRate: respRate || 'Not recorded',
      recordedAt: new Date().toISOString()
    };

    fileUtils.savePatientVitals(caseData.patientId, vitalsData);

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'VITALS_ENTERED',
      title: 'Vitals Recorded',
      description: `Temp: ${vitalsData.temp}, BP: ${vitalsData.bp}, Pulse: ${vitalsData.pulse}, SpO2: ${vitalsData.spo2}`,
      actor: 'Clinic Assistant',
      actorRole: 'assistant',
      data: vitalsData
    });

    return res.status(200).json({
      success: true,
      caseId,
      data: vitalsData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function addCaseText(req, res) {
  try {
    const { caseId } = req.params;
    const { text, author } = req.body;

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const statement = {
      id: `stmt_${Date.now()}`,
      text,
      author: author || 'Assistant',
      createdAt: new Date().toISOString()
    };

    caseData.textStatements = caseData.textStatements || [];
    caseData.textStatements.push(statement);
    fileUtils.saveCase(caseId, caseData);

    fileUtils.addCaseTimelineEvent(caseId, {
      type: 'TEXT_STATEMENT_ADDED',
      title: 'Patient Statement Added',
      description: `"${text}"`,
      actor: author || 'Clinic Assistant',
      actorRole: 'assistant'
    });

    return res.status(200).json({
      success: true,
      caseId,
      data: statement
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function addCaseMedia(req, res) {
  try {
    const { caseId } = req.params;
    const file = req.file;

    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';
    const mediaObj = {
      mediaId: `med_${Date.now()}`,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      mediaType,
      url: `/uploads/${file.filename}`,
      uploadedAt: new Date().toISOString()
    };

    if (mediaType === 'image') {
      caseData.imageUploads = caseData.imageUploads || [];
      caseData.imageUploads.push(mediaObj);
    } else {
      caseData.videoUploads = caseData.videoUploads || [];
      caseData.videoUploads.push(mediaObj);
    }

    fileUtils.saveCase(caseId, caseData);

    fileUtils.addCaseTimelineEvent(caseId, {
      type: mediaType === 'image' ? 'IMAGE_UPLOADED' : 'VIDEO_UPLOADED',
      title: `${mediaType === 'image' ? 'Injury/Clinical Image' : 'Clinical Video'} Uploaded`,
      description: `${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`,
      actor: 'Clinic Assistant',
      actorRole: 'assistant'
    });

    return res.status(200).json({
      success: true,
      caseId,
      data: mediaObj
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function getCaseHandoff(req, res) {
  try {
    const { caseId } = req.params;
    const caseData = fileUtils.getCase(caseId);
    if (!caseData) {
      return res.status(404).json({ success: false, error: `Case not found: ${caseId}` });
    }

    const context = patientContextService.getPatientCaseContext(caseData.patientId, caseId);
    const summary = await aiSummaryService.generatePatientAiSummary(caseData.patientId);

    const handoffBrief = {
      caseId,
      patientId: caseData.patientId,
      patientName: context.demographics?.name || 'Patient',
      age: context.demographics?.age,
      sex: context.demographics?.sex,
      mainProblem: summary.mainProblem?.title || summary.mainProblem?.summary || summary.summary,
      reportedSymptoms: summary.reportedSymptoms || [],
      vitals: context.vitals,
      importantFindings: summary.importantFindings || [],
      redFlags: summary.redFlags || [],
      currentActions: summary.whatCanBeDoneNow || [],
      recommendedNextStep: summary.recommendedNextStep,
      triageLevel: summary.triage?.level || 'routine',
      sources: {
        voice: context.voice ? 'Recorded & Transcribed Voice Intake' : 'None',
        documentsCount: context.documents?.length || 0,
        vitalsRecorded: context.vitals?.temp !== 'Not recorded'
      },
      generatedAt: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: handoffBrief
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  createCase,
  getCaseDetails,
  addCaseVitals,
  addCaseText,
  addCaseMedia,
  getCaseHandoff
};
