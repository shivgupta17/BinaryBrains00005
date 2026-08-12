const fs = require('fs');
const geminiService = require('./geminiService');

/**
 * Service for Gemini Structured Document AI Extraction
 */
async function extractDocumentInformation(ocrResult, filePath, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Gemini API key is required for document AI interpretation. Please set GEMINI_API_KEY in .env.');
  }

  const ocrText = ocrResult.fullText || '';
  const fileName = ocrResult.fileName || '';
  const isImage = mimeType && mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

  console.log(`[DocumentAIService] Extracting structured data from OCR text (${ocrText.length} chars) and document file`);

  let prompt = `You are a medical document AI parser.

Analyze the actual patient document provided in this request (both the attached file and the extracted OCR text).

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

  let inlineData = null;
  if (filePath && fs.existsSync(filePath) && (isImage || isPdf)) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      const docMime = isPdf ? 'application/pdf' : (mimeType || 'image/jpeg');
      inlineData = {
        mimeType: docMime,
        data: base64Data
      };
      if (isImage) {
        prompt += '\nNote: If this image is a wound/injury photograph, also populate the "woundAssessment" field with a visual assessment.';
      }
      console.log(`[DocumentAIService] Attached inline document buffer to Gemini payload (${docMime})`);
    } catch (err) {
      console.warn('[DocumentAIService] Document buffer inline payload notice:', err.message);
    }
  }

  const primaryModel = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const models = [primaryModel, 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
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
      lastErr = new Error(`Gemini Document AI API error (${response.status}) on ${model}: ${errText}`);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error('Gemini Document AI failed across models');
}

module.exports = {
  extractDocumentInformation
};
