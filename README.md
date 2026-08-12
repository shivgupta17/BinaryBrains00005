# 🏥 GramCare AI — Virtual Village Clinic

GramCare AI is a safety-first telemedicine and clinical triage platform designed for rural primary health centres.

---

## 📁 Project Folder Structure

```text
GramCare AI /
├── index.html                   # Main Application Shell & Entry Point
├── package.json                 # Node.js configuration & start scripts
├── README.md                    # Project Documentation
│
├── assets/                      # Application Assets
│   ├── css/
│   │   ├── main.css             # Design Tokens, Components & Layout
│   │   └── animations.css       # Dynamic Animations & Keyframes
│   └── js/
│       ├── app.js               # Application State & Navigation Router
│       └── animations.js        # UI Animations & Interactive Handlers
│
├── pages/                       # Modular Application Views (SPA Fragments)
│   ├── dashboard.html           # Overview & Real-time Metrics
│   ├── new-patient.html         # Patient Registration & Consent
│   ├── intake.html              # Multilingual Voice Intake
│   ├── documents.html           # Medical Document Intelligence & OCR
│   ├── triage.html               # Safety-First Risk Assessment Engine
│   ├── protocol.html            # First-Aid Clinical Protocol Assistant
│   ├── medicine.html            # Medicine Safety Gate (6-layer checks)
│   ├── doctor.html              # Remote Physician Dashboard
│   ├── records.html             # Immutable Digital Encounter Audit Trail
│   ├── ibmbob.html              # IBM Bob & MCP Agent Architecture
│   └── queue.html               # Daily Patient Queue Management
│
└── docs/                        # Project References & Design Documentation
    ├── gramcare-ai.html         # Monolithic Preview Reference
    └── AI & BOB Implementation.html  # System Architecture Specification Document
```

---

## 🚀 How to Run the Application

### Option 1: Live Server (Active Right Now)
The server is currently running at:
- **`http://localhost:3000`**
- **`http://127.0.0.1:3000`**

### Option 2: Run via NPM
Open terminal in the project directory and run:
```bash
npm start
```
(or `node server.js`).

### Option 3: Double-Click `index.html`
You can also open [`index.html`](file:///c:/Users/Acer/Desktop/Demo%20folder/index.html) directly in any browser.
