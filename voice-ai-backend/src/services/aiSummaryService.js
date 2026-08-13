const fileUtils = require('../utils/fileUtils');
const patientContextService = require('./patientContextService');

// Valid Gemini REST API model IDs for this API key (ordered cheapest → most capable)
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

// Max characters for aggregated findings JSON in the AI summary prompt
const MAX_FINDINGS_CHARS = 2000;

async function callGeminiApiWithRetry(apiKey, payload, preferredModel = 'gemini-3.5-flash-lite') {
  const models = [preferredModel, ...GEMINI_MODELS.filter(m => m !== preferredModel)];
  const uniqueModels = [...new Set(models)];
  let lastErr = null;

  for (const model of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          return await response.json();
        }

        const errText = await response.text();

        // 429 = quota exhausted — stop immediately, do not retry other models
        if (response.status === 429) {
          throw new Error(`Gemini quota exhausted (429). Please wait and try again. Details: ${errText}`);
        }

        lastErr = new Error(`Gemini API error (${response.status}) on ${model}: ${errText}`);

        if (response.status === 503) {
          console.warn(`[GeminiRetry] ${model} attempt ${attempt} returned ${response.status}. Retrying...`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
        } else {
          break;
        }
      } catch (fetchErr) {
        // Re-throw quota errors immediately
        if (fetchErr.message && fetchErr.message.includes('quota exhausted')) {
          throw fetchErr;
        }
        lastErr = fetchErr;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastErr || new Error('Gemini API call failed after retries.');
}

/**
 * Service to generate Unified AI Clinical Report & Triage via Gemini API
 */
async function generatePatientAiSummary(patientId) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is required for AI summary generation. Please set GEMINI_API_KEY in .env.');
  }

  // await is required — getPatientContext is async
  const patientContext = await patientContextService.getPatientContext(patientId);

  console.log(`[AISummaryService] Generating Unified AI Clinical Report for Patient ID: ${patientId}`);

  const promptText = `You are an AI clinical intake assistant helping a qualified healthcare professional review a patient case at a rural health centre (GramCare AI).

Analyze ONLY the patient information supplied in the context below.
Do NOT invent symptoms, duration, medications, vitals, diagnoses, allergies, history, age, gender, or lab values.
If information is missing, explicitly mark it as "Not recorded" or "Unknown".

Unified Patient Context:
- Patient Demographics: Name: "${patientContext.demographics?.name || 'Not recorded'}", Age: ${patientContext.demographics?.age || 'Not recorded'}, Sex: "${patientContext.demographics?.sex || 'Not recorded'}", Language: "${patientContext.demographics?.language || 'Hindi'}"
- Vitals: Temp: "${patientContext.vitals?.temp || 'Not recorded'}", BP: "${patientContext.vitals?.bp || 'Not recorded'}", Pulse: "${patientContext.vitals?.pulse || 'Not recorded'}", SpO2: "${patientContext.vitals?.spo2 || 'Not recorded'}"
- Voice Intake Transcript (Original): "${patientContext.voiceIntake?.transcription?.original || 'None recorded'}"
- Voice Intake Transcript (English): "${patientContext.voiceIntake?.transcription?.english || 'None recorded'}"
- Voice Intake AI Problem Analysis: ${JSON.stringify(patientContext.voiceIntake?.aiAnalysis || null)}
- Uploaded Documents Count: ${patientContext.documents?.length || 0}
- Document OCR Extracted Findings: ${(() => {
    const raw = JSON.stringify(patientContext.aggregatedFindings || {});
    return raw.length > MAX_FINDINGS_CHARS ? raw.substring(0, MAX_FINDINGS_CHARS) + '...[truncated]' : raw;
  })()}

Tasks:
1. Identify the Primary Main Problem first (one clear, short sentence).
2. List reported & documented symptoms as clean items.
3. List important findings (Vitals, Medical History, Allergies, Lab Findings).
4. Write a concise, readable clinical summary paragraph explaining the case without raw JSON or AI chain-of-thought.
5. Provide practical "What can be done now" supportive actions.
6. Identify warning signs / red flags (or state "No specific red flags identified from the available information.").
7. Only suggest OTC medications if supported by the patient's actual condition and approved clinical guidelines. Do NOT invent medications. Every medication MUST require doctor approval.
8. Specify one clear recommended next step.
9. Classify clinical triage risk level: "routine" (GREEN), "amber" (AMBER), or "red" (RED).

Return ONLY a JSON object with this exact schema:
{
  "patientId": "${patientId}",
  "patient": {
    "name": "${patientContext.demographics?.name || 'Not recorded'}",
    "age": "${patientContext.demographics?.age || 'Not recorded'}",
    "sex": "${patientContext.demographics?.sex || 'Not recorded'}",
    "patientId": "${patientId}"
  },
  "mainProblem": {
    "title": "Short primary problem title",
    "summary": "One clear sentence describing primary complaint based strictly on patient context."
  },
  "reportedSymptoms": [
    "Symptom 1"
  ],
  "importantFindings": [
    "Temperature: ...",
    "Blood Pressure: ...",
    "Allergies: ...",
    "Medical History: ..."
  ],
  "clinicalSummary": "Concise, easy-to-understand paragraph connecting available facts logically.",
  "whatCanBeDoneNow": [
    "Practical supportive action 1"
  ],
  "redFlags": [
    "Warning sign 1 or 'No specific red flags identified from the available information.'"
  ],
  "medicationSuggestions": [
    {
      "name": "Medication Name",
      "reason": "Why relevant",
      "sourceProtocol": "Approved MoHFW / ASHA Protocol",
      "safetyConsiderations": "Allergy and age safety notes",
      "doctorApprovalRequired": true
    }
  ],
  "recommendedNextStep": "One concise patient-specific next action",
  "triage": {
    "level": "routine | amber | red",
    "reason": "Detailed clinical reason for risk level classification"
  },
  "disclaimer": "AI-generated clinical support. Doctor/qualified clinician review and approval is required before medication is taken or administered."
}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const result = await callGeminiApiWithRetry(apiKey, payload, primaryModel);

  const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('Gemini AI Summary API returned empty output');
  }

  const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const summaryResult = JSON.parse(cleanJson);

  // Backward compatibility aliases
  if (!summaryResult.summary) summaryResult.summary = summaryResult.clinicalSummary || summaryResult.mainProblem?.summary;
  if (!summaryResult.reportedProblems) summaryResult.reportedProblems = summaryResult.reportedSymptoms || [];
  if (!summaryResult.recommendedNextSteps) summaryResult.recommendedNextSteps = summaryResult.whatCanBeDoneNow || [summaryResult.recommendedNextStep];

  // Save persistent summary JSON
  fileUtils.savePatientSummary(patientId, summaryResult);
  console.log(`[AISummaryService] Generated Structured AI Clinical Report for ${patientId}. Triage Level: ${summaryResult.triage?.level}`);

  return summaryResult;
}

module.exports = {
  generatePatientAiSummary
};
