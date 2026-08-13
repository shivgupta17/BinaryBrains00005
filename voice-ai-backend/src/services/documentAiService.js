const fs = require('fs');

// Max OCR characters to include in prompt — avoids token bloat
const MAX_OCR_CHARS = 3000;

// Valid Gemini REST API model IDs for this API key (ordered cheapest → most capable)
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
];

/**
 * Service for Gemini Structured Document AI Extraction
 */
async function extractDocumentInformation(ocrResult, filePath, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is required for document AI interpretation. Please set GEMINI_API_KEY in .env.');
  }

  const rawOcrText = ocrResult.fullText || '';
  // Truncate OCR text to avoid sending thousands of tokens in the prompt
  const ocrText = rawOcrText.length > MAX_OCR_CHARS
    ? rawOcrText.substring(0, MAX_OCR_CHARS) + '\n...[truncated]'
    : rawOcrText;

  const fileName = ocrResult.fileName || '';
  const isImage = mimeType && mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  // Text was successfully extracted locally — no need to send raw file bytes to Gemini
  const hasLocalText = rawOcrText.trim().length > 50;

  console.log(`[DocumentAIService] Extracting structured data. OCR chars: ${rawOcrText.length}, sendFile: ${!hasLocalText || isImage}`);

  let prompt = `You are a medical document AI parser.

DO NOT invent or hardcode medications, symptoms, diagnoses, history, allergies, or lab values.
Extract ONLY information that is explicitly stated in the document text provided below.

- Document Filename: "${fileName}"
- Extracted OCR Text:
"${ocrText}"

Perform:
1. Classify the document type into ONE of:
   "prescription", "lab_report", "blood_test", "discharge_summary", "medical_record", "medicine_receipt", "medical_bill", "injury_photo", "imaging_report", "other", "unknown"
2. Extract structured fields. If a field is not present in the document, return empty array [] or null. Do not guess.

Return ONLY a JSON object with this exact schema:
{
  "documentType": "classified_type_here",
  "extractedData": {
    "medications": [
      { "name": "Medication Name", "dose": "5mg", "frequency": "OD / Twice daily" }
    ],
    "diagnoses": ["Diagnosis 1"],
    "symptoms": ["Symptom 1"],
    "labResults": [
      { "test": "Test Name", "value": "120", "unit": "mg/dL", "flag": "normal | high | low" }
    ],
    "medicalHistory": ["History item"],
    "allergies": ["Allergy item"],
    "dates": ["Document date or test date"],
    "doctorName": "Doctor name or null",
    "hospitalName": "Hospital/Pharmacy name or null"
  },
  "safetyFlags": [
    "Safety alert or allergy warning if present in text"
  ],
  "woundAssessment": null,
  "confidence": 0.95
}`;

  // Only attach the raw file when:
  // 1. It is an image (wound photo / scanned image — needs vision)
  // 2. It is a scanned PDF with no extractable text
  let inlineData = null;
  const shouldSendFile = filePath && fs.existsSync(filePath) && (isImage || (isPdf && !hasLocalText));
  if (shouldSendFile) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const docMime = isPdf ? 'application/pdf' : (mimeType || 'image/jpeg');
      inlineData = {
        mimeType: docMime,
        data: fileBuffer.toString('base64')
      };
      if (isImage) {
        prompt += '\nNote: If this image is a wound/injury photograph, also populate the "woundAssessment" field with a visual assessment.';
      }
      console.log(`[DocumentAIService] Attached inline file to Gemini (${docMime}, ${fileBuffer.length} bytes)`);
    } catch (err) {
      console.warn('[DocumentAIService] Could not read file for inline payload:', err.message);
    }
  } else {
    console.log('[DocumentAIService] Skipping inline file — using OCR text only (saves tokens)');
  }

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const models = [primaryModel, ...GEMINI_MODELS.filter(m => m !== primaryModel)];
  const uniqueModels = [...new Set(models)];
  let lastErr = null;

  for (const model of uniqueModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const parts = [];
    if (inlineData) {
      parts.push({ inlineData });
    }
    parts.push({ text: prompt });

    const payload = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) {
          throw new Error('Gemini Document AI returned empty output');
        }

        const cleanJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsedData = JSON.parse(cleanJson);
        console.log(`[DocumentAIService] Document classified as "${parsedData.documentType}". Detected ${parsedData.extractedData?.medications?.length || 0} medications.`);
        return parsedData;
      }

      const errText = await response.text();

      // 429 = quota exhausted — retrying other models wastes the same quota
      if (response.status === 429) {
        throw new Error(`Gemini quota exhausted (429). Please wait and try again. Details: ${errText}`);
      }

      lastErr = new Error(`Gemini Document AI API error (${response.status}) on ${model}: ${errText}`);
      console.warn(`[DocumentAIService] Model ${model} returned HTTP ${response.status}. Trying next model...`);
    } catch (err) {
      // Re-throw quota errors immediately — no point retrying
      if (err.message && err.message.includes('quota exhausted')) {
        throw err;
      }
      lastErr = err;
    }
  }

  throw lastErr || new Error('Gemini Document AI failed across all models');
}

module.exports = {
  extractDocumentInformation
};
