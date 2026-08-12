# 🎙️ Voice AI Backend Service

Separate Node.js/Express backend for multilingual voice intake, transcription, translation, and Gemini AI problem analysis.

---

## 🏗 Architecture & Design

```text
            EXISTING FRONTEND
                   │
            Voice Recording (MediaRecorder / Audio Blob)
                   │
                   ▼
                [DONE] Button
                   │
                   ▼
          POST /api/voice/complete (Multipart form-data)
                   │
                   ▼
          Node.js / Express Backend
                   │
                   ▼
          Stage 1: Transcription + Translation
                   │
                   ▼
         conversationId + JSON created (aiAnalysis = null)
                   │
                   ▼
          [AI SUGGESTION] Button (Enabled on Frontend)
                   │
                   ▼
    POST /api/voice/:conversationId/analyze
                   │
                   ▼
              GEMINI API
                   │
                   ▼
          Stage 2: Problem Analysis & Recommendations
                   │
         JSON updated with aiAnalysis & returned
                   │
                   ▼
       Main Identified Problem Highlighted on Frontend
```

---

## 📁 Directory Structure

```text
voice-ai-backend/
├── src/
│   ├── controllers/
│   │   └── voiceController.js    # Express controller for Done & Analyze stages
│   ├── routes/
│   │   └── voiceRoutes.js        # API Routes and Multer audio upload config
│   ├── services/
│   │   └── geminiService.js      # Multimodal Gemini API integration
│   ├── utils/
│   │   └── fileUtils.js          # File storage & sanitization helpers
│   └── server.js                 # Express app & error handler
├── uploads/                      # Temporary audio uploads
├── data/
│   └── conversations/            # Stored conversation JSON files
├── .env                          # Environment variables
├── .env.example                  # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Installation & Environment Setup

1. Navigate to `voice-ai-backend`:
   ```bash
   cd voice-ai-backend
   ```

2. Configure `.env`:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   SAVE_AUDIO=false
   MAX_AUDIO_SIZE_MB=25
   ```

3. Start Backend:
   ```bash
   npm start
   ```

---

## 🛠 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & Gemini status |
| `POST` | `/api/voice/complete` | Submits recorded audio, creates JSON with `aiAnalysis: null` |
| `POST` | `/api/voice/:id/analyze` | Triggers Gemini AI analysis & updates JSON |
| `GET` | `/api/voice/:id` | Fetches single conversation JSON |
| `GET` | `/api/voice` | Lists all saved conversation JSONs |

---

## 🔒 Security
- Gemini API key remains strictly on backend.
- Path traversal protection on conversation IDs.
- Upload size and MIME type limits enforced.
