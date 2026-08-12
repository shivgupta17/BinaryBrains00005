const fs = require('fs');

/**
 * Robust helper to call Gemini REST API with retry & model fallback
 * Verified active models for this API key: gemini-flash-latest, gemini-flash-lite-latest, gemini-3.5-flash
 */
async function callGeminiAPI(promptText, apiKey, preferredModel = 'gemini-flash-latest', jsonOutput = true, inlineData = null) {
  const models = [preferredModel, 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
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
        console.log(`[GeminiService] Calling active model ${model} (attempt ${attempt})...`);
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
        lastErr = new Error(`Gemini API error (${response.status}) on ${model}: ${errorText}`);

        if (response.status === 429 || response.status === 503) {
          console.warn(`[GeminiService] ${model} attempt ${attempt} returned HTTP ${response.status}. Retrying in backoff...`);
          await new Promise(r => setTimeout(r, 1200 * attempt));
        } else {
          console.warn(`[GeminiService] ${model} returned HTTP ${response.status}. Trying next active model...`);
          break;
        }
      } catch (err) {
        lastErr = err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastErr || new Error('Gemini API call failed across all active models.');
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

  const promptText = `You are a client-intake analysis AI.

You must analyze the actual client content provided in this request.
Do not assume or invent a problem.
Do not use pre-existing examples or demo scenarios.
The output must be based ONLY on the actual client input provided below:

- Client Original Words: "${originalText}"
- Client English Translation: "${englishText}"

Identify:
1. What the client is actually complaining about / main problem.
2. Problem category (e.g. Technical, Financial, Operational, Clinical, Hardware, Connectivity, General Inquiry).
3. Severity if reasonably determinable (low, medium, high, critical).
4. Problem summary based strictly on the client's words.
5. Specific key issues mentioned by the client.
6. Important details extracted from the client's statement.
7. Actionable suggestions to resolve the client's problem.
8. Recommended immediate next step.
9. Confidence score (0.0 to 1.0).

If the client's problem is unclear, explicitly state that it is unclear rather than guessing.

Return ONLY a JSON object with this exact schema:
{
  "problemAnalysis": {
    "mainProblem": "Clear, concise main identified problem",
    "category": "Problem category",
    "severity": "low | medium | high | critical",
    "problemSummary": "Detailed summary based on client input",
    "keyIssues": [
      "Issue 1",
      "Issue 2"
    ],
    "importantDetails": [
      "Detail 1",
      "Detail 2"
    ]
  },
  "suggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ],
  "recommendedNextStep": "Recommended immediate next step",
  "confidence": 0.95
}`;

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const analysisResult = await callGeminiAPI(promptText, apiKey, primaryModel, true);
  console.log(`[GeminiService] Real AI Problem Identified: "${analysisResult.problemAnalysis?.mainProblem}"`);
  return analysisResult;
}

module.exports = {
  transcribeAndTranslateAudio,
  analyzeClientProblem,
};
