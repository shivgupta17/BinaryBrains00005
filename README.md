# 🏥 GramCare AI — Virtual Village Telemedicine & Clinical Triage System

**GramCare AI** is an end-to-end, safety-first telemedicine and clinical triage platform engineered for primary health centres and rural clinic assistants. It bridges village clinic assistants, remote doctors, and rural patients through AI-powered voice intake, automatic multilingual translation, document OCR, risk triage, and persistent MongoDB Atlas data linking.

---

## 🌟 Key Pillars & Features

- **Direct Role-Based Authentication**: Instant registration and login for **Assistant**, **Doctor**, and **Patient** roles with backend JWT session management and permanent unique IDs.
- **Multilingual Voice Intake & Gemini AI**: High-accuracy voice intake audio transcription (`audio/webm`) with automatic Hindi-to-English translation, clinical problem identification, AI summary generation, and safety triage assessment powered by Google Gemini AI.
- **Single-Generation AI Persistence**: AI analysis is generated once during Voice Intake and saved directly to **MongoDB Atlas**. Remote doctors inspect the saved report without triggering redundant AI calls.
- **Doctor Referral & Case Packet Handoff**: Assistant searches doctors by real `doctorId` (`DOC-XXXXXXXX`) and sends complete case packets (`patientId`, `caseId`, `assistantId`, `doctorId`).
- **Patient Privacy & Safety Gate**: Patient Care Portal enforces strict privacy rules — displaying ONLY doctor-approved prescription medications (`DOCTOR_APPROVED`). Unapproved AI candidates are strictly hidden.
- **Nodemailer Assistant Reminders**: Patients can send real-time email reminder alerts to their assigned clinic assistant directly through **Nodemailer** SMTP configuration.

---

## 📁 Repository Structure

```text
Demo folder /
├── index.html                   # Main Single Page Application (SPA) Shell
├── server.js                    # Web Application Static Server (Port 3000)
├── package.json                 # Node.js Dependencies & Run Scripts
├── README.md                    # System Architecture & Documentation
│
├── assets/                      # Application Assets & Core Logic
│   ├── css/
│   │   ├── main.css             # Design Tokens, Color Palette, Typography & Layout
│   │   └── animations.css       # Micro-animations, Transitions & Dynamic Keyframes
│   └── js/
│       ├── app.js               # SPA Navigation Router, State Management & Modals
│       └── animations.js        # UI Interactions & Visual Animations
│
├── pages/                       # SPA Dynamic View Templates
│   ├── dashboard.html           # Assistant Dashboard & Clinical Care Panel
│   ├── new-patient.html         # Patient Registration Form
│   ├── intake.html              # Multilingual Voice Intake Module
│   ├── documents.html           # Document Upload & OCR Intelligence
│   ├── triage.html              # Triage Engine Risk Assessment
│   ├── protocol.html            # First-Aid Clinical Protocols
│   ├── medicine.html            # Medicine Safety Gate (Doctor Approval)
│   ├── doctor.html              # Remote Doctor Dashboard & Referral Queue
│   ├── patient-dashboard.html   # Authorized Patient Care Portal
│   ├── records.html             # Digital Encounter Audit Trail
│   └── queue.html               # Daily Patient Queue Management
│
└── voice-ai-backend/            # Node.js & Express Backend Service (Port 5000)
    ├── .env                     # MongoDB Atlas URI, Gemini API Key, SMTP Credentials
    └── src/
        ├── server.js            # Express Server Entrypoint
        ├── config/
        │   └── db.js            # Native MongoClient MongoDB Atlas Connection
        ├── controllers/
        │   ├── authController.js             # User Auth & Role Management
        │   ├── caseController.js             # Encounter Case Operations & Vitals
        │   ├── doctorController.js           # Doctor Prescriptions & Instructions
        │   ├── documentController.js         # Document OCR Extraction
        │   ├── patientDashboardController.js # Patient Portal & Nodemailer Alerts
        │   ├── referralController.js         # Doctor Referral Routing
        │   └── voiceController.js            # Voice Processing & Gemini AI Analysis
        ├── middleware/
        │   └── authMiddleware.js             # JWT & Role Authentication Guards
        ├── routes/
        │   ├── authRoutes.js
        │   ├── caseRoutes.js
        │   ├── doctorRoutes.js
        │   ├── documentRoutes.js
        │   ├── patientRoutes.js
        │   ├── referralRoutes.js
        │   └── voiceRoutes.js
        └── services/
            ├── aiSummaryService.js           # Unified AI Summary Generator
            ├── emailService.js               # Nodemailer SMTP Email Service
            ├── geminiService.js             # Google Gemini AI Integration
            ├── notificationService.js        # Role-Scoped Notification Engine
            ├── ocrService.js                 # Medical Document OCR Engine
            ├── patientContextService.js      # Patient-Case Context Aggregator
            └── triageEngine.js               # Safety-First Risk Assessment Engine
```

---

## 🆔 Permanent Unique Identifiers

Every registered user and clinical encounter receives a backend-generated permanent identifier:
- **Assistant ID**: `AST-XXXXXXXX` (e.g. `AST-PL92AYNU`)
- **Doctor ID**: `DOC-XXXXXXXX` (e.g. `DOC-1A233X8Q`)
- **Patient ID**: `PAT-XXXXXXXX` (e.g. `PAT-OR9DN1X8`)
- **Case Encounter ID**: `CASE-XXXXXXXX` (e.g. `CASE-NQM3F8XM`)
- **Referral ID**: `REF-XXXXXXXX` (e.g. `REF-QJ9BATO0`)

*`patientId` and `caseId` are strictly separate entities across all MongoDB Atlas collections.*

---

## 🔄 End-to-End Workflow Pipeline

```text
Assistant Registers Patient
          ↓
Generates permanent patientId (PAT-XXXXXXXX) & encounter caseId (CASE-XXXXXXXX)
          ↓
Assistant enters Vitals & conducts Multilingual Voice Intake
          ↓
Backend processes audio via Google Gemini AI (Transcription + Translation)
          ↓
Gemini generates AI Summary & Triage Assessment (LOW / MEDIUM / HIGH)
          ↓
ALL RESULTS PERSISTED TO MONGODB ATLAS (`cases`, `voice`, `conversations`)
          ↓
Assistant enters Doctor ID (DOC-XXXXXXXX) & clicks "Send to Doctor"
          ↓
Referral saved in MongoDB Atlas linking patientId + caseId + assistantId + doctorId
          ↓
Doctor logs in ➔ Selects referral from queue ➔ Fetches GET /api/cases/:caseId
          ↓
Doctor Dashboard renders SAVED AI Report (Demographics, Vitals, Voice, Translation, AI Summary, Triage, OCR)
          ↓
Doctor approves prescription (DOCTOR_APPROVED) & sends clinical instruction
          ↓
Assistant Care Panel displays approved meds & doctor instructions
          ↓
Patient logs in to Patient Portal ➔ Views ONLY Doctor-Approved Medications & Care Team info
          ↓
Patient clicks "Remind Assistant" ➔ Nodemailer dispatches email alert to Assistant's email
```

---

## 📊 MongoDB Atlas Schemas

### 1. `users` Collection
```json
{
  "userId": "usr_mrshivop170gmailcom",
  "name": "Attending Doctor",
  "email": "drritik341@gmail.com",
  "passwordHash": "$2b$10$...",
  "role": "doctor",
  "doctorId": "DOC-1A233X8Q",
  "createdAt": "2026-08-13T00:00:00.000Z"
}
```

### 2. `cases` Collection
```json
{
  "caseId": "CASE-NQM3F8XM",
  "patientId": "PAT-OR9DN1X8",
  "assistantId": "AST-PL92AYNU",
  "assignedDoctorId": "DOC-1A233X8Q",
  "status": "IN_CONSULTATION",
  "vitals": {
    "temp": "102.4°F",
    "bp": "130/85 mmHg",
    "pulse": "98 bpm",
    "spo2": "96%",
    "respRate": "22 bpm"
  },
  "aiSummary": {
    "summary": "Persistent high fever and respiratory distress for 2 days.",
    "mainProblem": {
      "title": "High Fever & Respiratory Distress",
      "summary": "Patient experiencing high temperature and shortness of breath."
    },
    "reportedSymptoms": ["Fever", "Breathlessness"],
    "recommendedNextStep": "Physician evaluation and prescription"
  },
  "triage": {
    "level": "amber",
    "rationale": "Physician consultation requested based on clinical symptoms.",
    "recommendedAction": "Physician review and prescription"
  },
  "approvedMedications": [
    {
      "medicationId": "med_1786582033",
      "name": "Ciprofloxacin 500mg",
      "dosage": "1 Tablet (500mg)",
      "route": "Oral",
      "frequency": "Twice Daily (BD)",
      "duration": "5 Days",
      "status": "DOCTOR_APPROVED",
      "approvedAt": "2026-08-13T01:00:00.000Z"
    }
  ],
  "doctorInstructions": [
    {
      "messageId": "msg_1786582033",
      "message": "Keep patient head elevated 30 degrees and monitor temperature every 4 hours.",
      "doctorId": "DOC-1A233X8Q",
      "createdAt": "2026-08-13T01:00:00.000Z"
    }
  ]
}
```

### 3. `referrals` Collection
```json
{
  "referralId": "REF-QJ9BATO0",
  "patientId": "PAT-OR9DN1X8",
  "caseId": "CASE-NQM3F8XM",
  "doctorId": "DOC-1A233X8Q",
  "assistantId": "AST-PL92AYNU",
  "riskLevel": "amber",
  "reason": "Persistent high fever and respiratory distress requiring physician evaluation",
  "status": "ACCEPTED",
  "createdAt": "2026-08-13T00:50:00.000Z"
}
```

---

## 🛠️ API Reference

### Authentication Endpoints
- `POST /api/auth/register` — Register user (`assistant`, `doctor`, `patient`). Returns JWT token & role ID.
- `POST /api/auth/login` — Login user with email, password, and role.

### Case Encounter Endpoints
- `POST /api/cases` — Create new encounter case (`CASE-XXXXXXXX`).
- `GET /api/cases/:caseId` — Fetch complete unified case packet (demographics, vitals, voice, AI summary, triage, documents, OCR).
- `POST /api/cases/:caseId/vitals` — Record patient vitals.
- `POST /api/cases/:caseId/reminders` — Send patient reminder request to assigned assistant via Nodemailer.

### Referral Endpoints
- `POST /api/referrals` — Create referral linking `patientId`, `caseId`, `assistantId`, `doctorId`.
- `GET /api/referrals/doctor/referrals` — Fetch incoming referral queue for authenticated doctor.
- `POST /api/referrals/:referralId/accept` — Doctor accepts referral.

### Doctor Action Endpoints
- `POST /api/doctors/cases/:caseId/medications` — Doctor approves prescription medications (`DOCTOR_APPROVED`).
- `POST /api/doctors/cases/:caseId/instruction` — Doctor dispatches clinical instructions to assistant.

### Voice & Gemini AI Endpoints
- `POST /api/voice/complete` — Upload audio recording (`audio/webm`) for Gemini transcription & translation.
- `POST /api/voice/:conversationId/analyze` — Run Gemini AI clinical problem analysis & triage generation.

### Patient Portal Endpoints
- `GET /api/patient/dashboard-data` — Fetch authorized patient dashboard data (Doctor-Approved medications ONLY, assigned Doctor, assigned Assistant contact info).

---

## 🚀 Running the Application

### 1. Start the Voice AI Backend Server (Port 5000)
```bash
cd voice-ai-backend
node src/server.js
```

### 2. Start the Frontend Web Server (Port 3000)
```bash
npm start
```
Access the application in your browser at: **`http://localhost:3000`**.

---

## ⚖️ License & Clinical Disclaimer

*GramCare AI is a clinical decision-support and telemedicine system. AI-generated summaries and triage suggestions are designed for physician review. All final clinical assessments, prescriptions, and diagnoses remain the sole responsibility of the Registered Medical Practitioner (RMP).*
