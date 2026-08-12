const fileUtils = require('../utils/fileUtils');
const patientContextService = require('./patientContextService');

async function callGeminiApiWithRetry(apiKey, payload, preferredModel = 'gemini-flash-latest') {
  const models = [preferredModel, 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
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
        lastErr = new Error(`Gemini API error (${response.status}) on ${model}: ${errText}`);

        if (response.status === 429 || response.status === 503) {
          console.warn(`[GeminiRetry] ${model} attempt ${attempt} returned ${response.status}. Retrying...`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
        } else {
          break;
        }
      } catch (fetchErr) {
        lastErr = fetchErr;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastErr || new Error('Gemini API call failed after retries.');
}

/**
 * Service to generate Unified AI Summary & Triage via Gemini API
 */
async function generatePatientAiSummary(patientId) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is required for AI summary generation. Please set GEMINI_API_KEY in .env.');
  }

  const patientContext = patientContextService.getPatientContext(patientId);

  console.log(`[AISummaryService] Generating Unified AI Summary for Patient ID: ${patientId}`);

  const promptText = `You are an expert clinical decision support AI for a virtual village health clinic (GramCare AI).

You are analyzing a real patient case.
Use ONLY the patient information provided in this request.
Do NOT invent symptoms, duration, medications, vitals, diagnoses, allergies, history, or other facts.
If information is missing, explicitly state "Not recorded" or "Not available".

Unified Patient Context:
- Demographics: Name: "${patientContext.demographics?.name || 'Not provided'}", Age: ${patientContext.demographics?.age || 'Not provided'}, Sex: "${patientContext.demographics?.sex || 'Not provided'}", Language: "${patientContext.demographics?.language || 'Hindi'}"
- Vitals: Temp: "${patientContext.vitals?.temp || 'Not recorded'}", BP: "${patientContext.vitals?.bp || 'Not recorded'}", Pulse: "${patientContext.vitals?.pulse || 'Not recorded'}", SpO2: "${patientContext.vitals?.spo2 || 'Not recorded'}"
- Voice Intake Transcript (Original): "${patientContext.voiceIntake?.transcription?.original || 'None recorded'}"
- Voice Intake Transcript (English): "${patientContext.voiceIntake?.transcription?.english || 'None recorded'}"
- Voice Intake AI Problem Analysis: ${JSON.stringify(patientContext.voiceIntake?.aiAnalysis || null)}
- Uploaded Documents Count: ${patientContext.documents?.length || 0}
- Document OCR Extracted Findings: ${JSON.stringify(patientContext.aggregatedFindings || {})}

Tasks:
1. Synthesize all patient information into a coherent, professional clinical summary.
2. Distinguish clearly between patient-reported symptoms (voice intake) vs documented findings (OCR/reports).
3. Classify clinical triage risk level:
   - "routine" (GREEN): Mild/stable symptoms, appropriate for preliminary first-aid / OTC protocol.
   - "amber" (AMBER): Moderate symptoms, elevated vitals, or medication review needed — escalate for doctor approval.
   - "red" (RED): Severe/critical symptoms (e.g. chest pain, difficulty breathing, high fever with altered sensorium, severe laceration) — immediate hospital referral required.
4. List missing clinical information (e.g. unconfirmed allergies, missing lab test).

Return ONLY a JSON object with this exact schema:
{
  "patientId": "${patientId}",
  "summary": "Coherent synthesis of patient case based ONLY on actual provided data",
  "reportedProblems": [
    "Problem 1 reported by patient"
  ],
  "documentFindings": [
    "Finding 1 from uploaded document"
  ],
  "medications": [
    "Medication name and dosage from records/intake"
  ],
  "medicalHistory": [
    "History item"
  ],
  "allergies": [
    "Allergy item or 'Allergy status unconfirmed'"
  ],
  "importantFindings": [
    "Key vital sign or clinical observation"
  ],
  "possibleConcerns": [
    "Clinical concern"
  ],
  "recommendedNextSteps": [
    "Recommended immediate next action"
  ],
  "triage": {
    "level": "routine | amber | red",
    "reason": "Detailed reason for triage risk level classification"
  },
  "missingInformation": [
    "Missing clinical detail"
  ],
  "confidence": 0.95
}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  };

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const result = await callGeminiApiWithRetry(apiKey, payload, primaryModel);

  const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('Gemini AI Summary API returned empty output');
  }

  const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const summaryResult = JSON.parse(cleanJson);

  // Save persistent summary JSON
  fileUtils.savePatientSummary(patientId, summaryResult);
  console.log(`[AISummaryService] Generated AI Summary & Triage for ${patientId}. Risk Level: ${summaryResult.triage?.level}`);

  return summaryResult;
}

module.exports = {
  generatePatientAiSummary
};
