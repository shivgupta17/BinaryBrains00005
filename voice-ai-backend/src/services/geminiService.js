const fs = require('fs');

// Valid Gemini REST API model IDs for this API key
const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

/**
 * Robust helper to call Gemini REST API with retry & model fallback
 */
async function callGeminiAPI(promptText, apiKey, preferredModel = 'gemini-flash-latest', jsonOutput = true, inlineData = null) {
  const models = [preferredModel, ...GEMINI_MODELS.filter(m => m !== preferredModel)];
  // Deduplicate models preserving order
  const uniqueModels = [...new Set(models)];
  let lastErr = null;

  for (const model of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [];
    if (inlineData) {
      parts.push({ inlineData });
    }
    parts.push({ text: promptText });

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: jsonOutput ? 'application/json' : 'text/plain',
      }
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[GeminiService] Calling model ${model} (attempt ${attempt})...`);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!candidateText) {
            throw new Error(`Gemini API on ${model} returned empty response content`);
          }

          if (jsonOutput) {
            const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
            return JSON.parse(cleanJson);
          }

          return candidateText;
        }

        const errorText = await response.text();

        // 429 = quota exhausted — stop immediately, retrying burns the same quota
        if (response.status === 429) {
          throw new Error(`Gemini quota exhausted (429). Please wait and try again. Details: ${errorText}`);
        }

        lastErr = new Error(`Gemini API error (${response.status}) on ${model}: ${errorText}`);

        if (response.status === 503) {
          console.warn(`[GeminiService] ${model} attempt ${attempt} returned HTTP 503. Retrying in backoff...`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
        } else {
          console.warn(`[GeminiService] ${model} returned HTTP ${response.status}. Trying next model...`);
          break;
        }
      } catch (err) {
        // Re-throw quota errors immediately — no point retrying
        if (err.message && err.message.includes('quota exhausted')) {
          throw err;
        }
        lastErr = err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastErr || new Error('Gemini API call failed across all models.');
}

/**
 * Stage 1: Transcribe & Translate Audio Intake (REAL AUDIO ONLY - NO DUMMY FALLBACKS)
 */
async function transcribeAndTranslateAudio(filePath, rawMimeType) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is required for transcription. Please configure GEMINI_API_KEY in .env.');
  }

  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('The recorded audio file is missing or invalid on the backend server.');
  }

  const audioBuffer = fs.readFileSync(filePath);
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('The recorded audio is empty (0 bytes).');
  }

  // Normalize MIME type (e.g. "audio/webm;codecs=opus" -> "audio/webm")
  let cleanMime = (rawMimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (!cleanMime || cleanMime === 'application/octet-stream') {
    cleanMime = 'audio/webm';
  }

  console.log(`[GeminiService] Processing REAL audio file: ${filePath} (${audioBuffer.length} bytes, MIME: ${cleanMime})`);

  const base64Data = audioBuffer.toString('base64');
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';

  const prompt = `You are a speech-to-text and translation model for client intake.
Analyze the actual audio recording provided in this request.
1. Detect the spoken language from the actual audio.
2. Provide the exact original-language transcription in its native script (e.g., Devanagari for Hindi, Tamil script for Tamil, English for English).
3. Provide a complete, accurate English translation of what was actually spoken in the audio.

Return ONLY a JSON object with this exact structure:
{
  "language": {
    "detected": "Language Name (e.g., Hindi, English, Hinglish, Tamil)",
    "languageCode": "ISO language code (e.g., hi, en, ta)"
  },
  "transcription": {
    "original": "Actual original spoken text from the audio",
    "english": "Actual English translation of the spoken audio"
  }
}`;

  const inlineData = {
    mimeType: cleanMime,
    data: base64Data
  };

  const parsed = await callGeminiAPI(prompt, apiKey, primaryModel, true, inlineData);

  if (!parsed.language || !parsed.transcription) {
    throw new Error('Invalid JSON structure returned by Gemini transcription service');
  }

  console.log(`[GeminiService] Real transcription generated: "${parsed.transcription.english}"`);
  return parsed;
}

/**
 * Stage 2: Analyze Client Problem & Generate AI Suggestions (REAL GEMINI ANALYSIS ONLY)
 */
async function analyzeClientProblem(transcriptionData) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is required for AI problem analysis. Please set GEMINI_API_KEY in .env.');
  }

  const originalText = transcriptionData?.original || '';
  const englishText  = transcriptionData?.english || '';

  if (!originalText && !englishText) {
    throw new Error('Cannot analyze problem: Conversation transcript is empty.');
  }

  console.log(`[GeminiService] Analyzing REAL client transcript: "${englishText}"`);

  const promptText = `You are analyzing the actual statement made by a client during a healthcare intake.

Use ONLY the client information supplied below:
- Client Spoken Original Words: "${originalText}"
- Client Spoken English Translation: "${englishText}"

Do not invent symptoms.
Do not invent duration.
Do not invent diagnoses.
Do not invent medications.
Do not invent vitals.
Do not invent medical history.
Do not assume information that the client did not provide.

Identify the client's main reported problem.
Extract the symptoms actually mentioned.
Summarize what the client said in clear language.
Classify the problem category accurately based strictly on the client statement (e.g., Acute Illness, Injury/Laceration, Respiratory, Gastrointestinal, Pain, General Healthcare Inquiry).
If the information is insufficient to determine a specific category, classify as "Unspecified / Insufficient Information".
Classify severity (low, medium, high, critical, unknown) strictly based on reported symptoms. If insufficient info, set severity to "unknown".
Do not convert an AI possibility into a confirmed diagnosis.
Provide appropriate next steps based only on the available information and the application's approved clinical workflow.
If medication information is not appropriate or insufficient, do not recommend a medication.

Return ONLY a JSON object matching this exact schema:
{
  "problemAnalysis": {
    "mainProblem": "Actual problem identified strictly from voice statement",
    "category": "Actual relevant category",
    "severity": "low | medium | high | critical | unknown",
    "problemSummary": "Clear summary of what the client actually reported",
    "keyIssues": [
      "Actual key issue 1"
    ],
    "importantDetails": [
      "Actual important detail 1"
    ]
  },
  "symptoms": [
    {
      "name": "Actual symptom mentioned",
      "source": "client_reported"
    }
  ],
  "aiSuggestions": [
    "Relevant next step based on actual statement"
  ],
  "recommendedNextStep": "Actual appropriate next step",
  "confidence": 0.85,
  "missingInformation": []
}`;

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const analysisResult = await callGeminiAPI(promptText, apiKey, primaryModel, true);

  // Backward compatibility alias for aiSuggestions vs suggestions
  if (!analysisResult.aiSuggestions && analysisResult.suggestions) {
    analysisResult.aiSuggestions = analysisResult.suggestions;
  }

  console.log(`[GeminiService] Real AI Problem Identified: "${analysisResult.problemAnalysis?.mainProblem}"`);
  return analysisResult;
}

module.exports = {
  transcribeAndTranslateAudio,
  analyzeClientProblem,
};
