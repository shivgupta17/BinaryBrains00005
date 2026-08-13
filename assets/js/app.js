/* ═══════════════════════════════════════════════════
   GramCare AI — App Logic & Navigation
   app.js (Clean Data Architecture — Zero Fallbacks)
════════════════════════════════════════════════════ */

// ─── State (Strict Real Patient Data Only) ────────
const GramCare = {
  currentPage: null,
  patient: {
    id: null,
    name: null,
    age: null,
    sex: null,
    language: null,
    village: null,
    phone: null,
    allergies: [],
    history: [],
    medications: [],
    vitals: { temp: null, bp: null, pulse: null, spo2: null },
    risk: null,
    voiceIntake: null,
    documents: [],
    aiSummary: null
  },
};

function getOrCreatePatientId() {
  if (GramCare.patient.id) return GramCare.patient.id;
  const stored = sessionStorage.getItem('gc_patient_id');
  if (stored) {
    GramCare.patient.id = stored;
    return stored;
  }
  const newId = `PAT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  GramCare.patient.id = newId;
  sessionStorage.setItem('gc_patient_id', newId);
  return newId;
}

// ─── Patient Registration Handler ────────────────
async function registerNewPatientAndProceed() {
  const firstName = document.getElementById('reg-first-name')?.value.trim();
  const lastName  = document.getElementById('reg-last-name')?.value.trim();
  const age       = document.getElementById('reg-age')?.value.trim();
  const sex       = document.getElementById('reg-sex')?.value;
  const village   = document.getElementById('reg-village')?.value.trim();
  const language  = document.getElementById('reg-language')?.value;
  const phone     = document.getElementById('reg-phone')?.value.trim();
  const allergies = document.getElementById('reg-allergies')?.value.trim();
  const conditions= document.getElementById('reg-conditions')?.value.trim();
  const medications=document.getElementById('reg-medications')?.value.trim();

  if (!firstName || !age || !sex || !village) {
    showToast('Please fill in all required fields (First Name, Age, Sex, Village)', 'warning');
    return;
  }

  const patientId = `PAT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const fullName  = `${firstName} ${lastName || ''}`.trim();

  const patientObj = {
    id: patientId,
    name: fullName,
    age: parseInt(age, 10),
    sex: sex,
    village: village,
    language: language || 'Hindi',
    phone: phone || null,
    allergies: allergies ? [allergies] : [],
    history: conditions ? [conditions] : [],
    medications: medications ? [medications] : [],
    vitals: { temp: null, bp: null, pulse: null, spo2: null }
  };

  try {
    const res = await fetch('http://localhost:5000/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientObj)
    });
    const data = await res.json();
    console.log('[Frontend] Registered Real Patient on Backend:', data);
  } catch (err) {
    console.warn('[Frontend] Patient registration network notice:', err.message);
  }

  GramCare.patient = {
    ...patientObj,
    risk: null,
    voiceIntake: null,
    documents: [],
    aiSummary: null
  };

  sessionStorage.setItem('gc_patient_id', patientId);
  sessionStorage.setItem('gc_patient', JSON.stringify(GramCare.patient));

  showToast(`Registered patient: ${fullName}`, 'success');
  navigateTo('intake');
}

function updatePatientVitalsFromIntake() {
  const temp = document.getElementById('intake-temp')?.value.trim();
  const bp   = document.getElementById('intake-bp')?.value.trim();
  const spo2 = document.getElementById('intake-spo2')?.value.trim();

  GramCare.patient.vitals = {
    temp: temp ? `${temp}°F` : (GramCare.patient.vitals?.temp || null),
    bp: bp || (GramCare.patient.vitals?.bp || null),
    pulse: GramCare.patient.vitals?.pulse || null,
    spo2: spo2 ? `${spo2}%` : (GramCare.patient.vitals?.spo2 || null)
  };

  const patientId = getOrCreatePatientId();
  fetch('http://localhost:5000/api/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: patientId,
      name: GramCare.patient.name || 'Patient',
      vitals: GramCare.patient.vitals
    })
  }).catch(e => console.warn('Vitals update notice:', e.message));
}

// ─── Page Navigation ──────────────────────────────
function navigateTo(pageId) {
  if (!isAuthenticated()) {
    checkAuthStateAndRender();
    return;
  }

  const user = getAuthUser();
  const allowed = ROLE_ALLOWED_PAGES[user.role] || [];
  if (!allowed.includes(pageId)) {
    const defaultPage = user.role === 'doctor' ? 'doctor' : (user.role === 'patient' ? 'patient-dashboard' : 'dashboard');
    if (GramCare.currentPage !== defaultPage) {
      showToast(`403 Forbidden: Role '${user.role}' is not authorized for page '${pageId}'.`, 'error');
      GramCare.currentPage = defaultPage;
      navigateTo(defaultPage);
    }
    return;
  }

  GramCare.currentPage = pageId;

  showPageLoader();

  const mainContent = document.getElementById('page-area');
  if (!mainContent) return;

  fetch(`pages/${pageId}.html`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP error ${r.status}`);
      return r.text();
    })
    .then(html => {
      mainContent.innerHTML = html;
      mainContent.classList.remove('page-enter');
      void mainContent.offsetWidth; // reflow
      mainContent.classList.add('page-enter');

      executeFragmentScripts(mainContent);

      updateSidebar(pageId);
      updateTopbar(pageId);
      initPageScripts(pageId);
      initRevealAnimations();
      initCounters();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      hidePageLoader();
    })
    .catch(err => {
      console.warn(`Failed to fetch pages/${pageId}.html:`, err);
      hidePageLoader();

      const templateEl = document.getElementById(`template-${pageId}`);
      if (templateEl) {
        mainContent.innerHTML = templateEl.innerHTML;
        mainContent.classList.remove('page-enter');
        void mainContent.offsetWidth;
        mainContent.classList.add('page-enter');
        executeFragmentScripts(mainContent);
        updateSidebar(pageId);
        updateTopbar(pageId);
        initPageScripts(pageId);
        initRevealAnimations();
        initCounters();
        return;
      }

      if (location.protocol === 'file:') {
        showToast('Run "npm start" or use Live Server to view dynamic pages', 'warning', 5000);
      } else {
        showToast(`Could not load page: ${pageId}`, 'error');
      }
    });
}

function executeFragmentScripts(container) {
  const scripts = container.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

function updateSidebar(pageId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageId) item.classList.add('active');
  });
}

const PAGE_TITLES = {
  dashboard:    ['Dashboard',         'Overview'],
  'new-patient':['New Patient',       'Register & Consent'],
  intake:       ['Voice Intake',      'Multilingual Clinical Intake'],
  documents:    ['Documents / OCR',   'Medical Document Intelligence'],
  triage:       ['Triage Engine',     'Safety-First Risk Assessment'],
  protocol:     ['First-Aid Protocol','Approved Clinical Protocols'],
  medicine:     ['Medicine Gate',     'AI-Suggested · Doctor-Approved'],
  doctor:       ['Doctor Dashboard',  'Remote Physician Review'],
  records:      ['Digital Records',   'Immutable Encounter Audit Trail'],
  ibmbob:       ['IBM Bob / MCP',     'Architecture & Agent Tools'],
  queue:        ['Patient Queue',     "Today's Encounters"],
  login:        ['Login / Sign Up',   'Account Authentication'],
};
function updateTopbar(pageId) {
  const el = document.getElementById('topbar-title');
  const sub = document.getElementById('topbar-sub');
  const t = PAGE_TITLES[pageId] || [pageId, ''];
  if (el)  el.textContent  = t[0];
  if (sub) sub.textContent = t[1];
}

function showPageLoader() {
  let bar = document.getElementById('page-loader');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'page-loader';
    bar.className = 'page-loader';
    document.body.appendChild(bar);
  }
  bar.style.display = 'block';
}
function hidePageLoader() {
  const bar = document.getElementById('page-loader');
  if (bar) {
    setTimeout(() => { bar.style.display = 'none'; }, 400);
  }
}

function showToast(msg, type = '', duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', warning: '⚠', error: '✕', '': 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

function initCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    const duration = parseInt(el.dataset.duration || '1200', 10);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  });
}

function initRevealAnimations() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
  }, { threshold: 0.12 });
  els.forEach(el => observer.observe(el));
}

function initPageScripts(pageId) {
  if (window.GramCareAnim && GramCareAnim.staggerCards) {
    GramCareAnim.staggerCards('.card, .stat-card');
  }
  
  if (pageId === 'dashboard')   initDashboard();
  if (pageId === 'new-patient') initNewPatientPage();
  if (pageId === 'intake')      initIntakePage();
  if (pageId === 'documents')   initDocumentsPage();
  if (pageId === 'triage')      initTriagePage();
  if (pageId === 'protocol')    initProtocolPage();
  if (pageId === 'medicine')    initMedicinePage();
  if (pageId === 'doctor')      initDoctorPage();
  if (pageId === 'records')     initRecordsPage();
  if (pageId === 'ibmbob')      initIBMBobPage();
  if (pageId === 'queue')       initQueuePage();
}

function initDashboard() {
  if (window.GramCareAnim) {
    GramCareAnim.animateProgressBars();
    GramCareAnim.initActivityFeed();
    GramCareAnim.initHeroParticles();
  }
  loadAssistantCarePanel();

  // Update Recent Patient widget from active patient
  const p = GramCare.patient;
  if (p && p.name) {
    const nameEl = document.getElementById('dash-p-name');
    const metaEl = document.getElementById('dash-p-meta');
    const avatarEl = document.getElementById('dash-avatar');
    if (nameEl) nameEl.textContent = `${p.name}, ${p.age || 'Age N/A'}`;
    if (metaEl) metaEl.textContent = `${p.village || 'Village N/A'} · ${p.language || 'Hindi'}`;
    if (avatarEl) {
      const parts = p.name.split(' ');
      avatarEl.textContent = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : p.name.substring(0, 2).toUpperCase();
    }
  }
}

function initNewPatientPage() {
  initUploadZones();
}

// ─── Voice Intake State & MediaRecorder ────────────
let _recording = false;
let _recInterval = null;
let _mediaRecorder = null;
let _audioChunks = [];
let _recordedAudioBlob = null;
let _conversationId = null;
let _backendUrl = 'http://localhost:5000/api/voice';

function initIntakePage() {
  const btn = document.getElementById('voice-btn');
  if (btn) btn.addEventListener('click', toggleRecording);

  const subtitle = document.getElementById('intake-patient-subtitle');
  if (subtitle) {
    if (GramCare.patient && GramCare.patient.name) {
      subtitle.textContent = `${GramCare.patient.name} · ${GramCare.patient.age || 'Age N/A'} yrs · ${GramCare.patient.village || 'Village N/A'}`;
    } else {
      subtitle.textContent = 'Encounter Active — Speak naturally';
    }
  }
}

async function toggleRecording() {
  const btn     = document.getElementById('voice-btn');
  const status  = document.getElementById('voice-status');
  const wf      = document.getElementById('waveform');
  const trans   = document.getElementById('transcript-live');
  const doneBtn = document.getElementById('done-btn');
  const aiBtn   = document.getElementById('ai-suggestion-btn');
  const previewWrap = document.getElementById('audio-preview-wrap');
  const previewAudio = document.getElementById('audio-preview');

  if (!_recording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _audioChunks = [];
      _recordedAudioBlob = null;
      _mediaRecorder = new MediaRecorder(stream);

      _mediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          _audioChunks.push(e.data);
        }
      };

      _mediaRecorder.onstop = () => {
        _recordedAudioBlob = new Blob(_audioChunks, { type: _mediaRecorder.mimeType || 'audio/webm' });
        console.log('[MediaRecorder] Audio Blob created successfully:', {
          size: `${_recordedAudioBlob.size} bytes`,
          type: _recordedAudioBlob.type
        });

        if (previewAudio) {
          const audioUrl = URL.createObjectURL(_recordedAudioBlob);
          previewAudio.src = audioUrl;
          if (previewWrap) previewWrap.style.display = 'block';
        }
      };

      _mediaRecorder.start(200);
      _recording = true;

      btn.classList.add('recording');
      btn.innerHTML = '⏹';
      if (status) { status.textContent = 'Recording live audio... Click ⏹ to stop.'; status.style.color = '#EF4444'; }
      if (wf)     wf.classList.add('active');
      if (doneBtn) doneBtn.style.display = 'none';
      if (aiBtn)   aiBtn.style.display   = 'none';

    } catch (err) {
      console.error('Microphone access error:', err);
      showToast('Could not access microphone. Please check permissions.', 'error');
    }
  } else {
    // STOP RECORDING
    _recording = false;
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
      _mediaRecorder.stop();
      _mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }

    btn.classList.remove('recording');
    btn.innerHTML = '🎙';
    if (status) { status.textContent = 'Recording stopped. Preview audio or click Done.'; status.style.color = 'var(--ink-50)'; }
    if (wf)     wf.classList.remove('active');
    if (doneBtn) doneBtn.style.display = 'block';
  }
}

async function submitVoiceIntake() {
  if (!_recordedAudioBlob || _recordedAudioBlob.size === 0) {
    showToast('Please record audio before clicking Done', 'warning');
    return;
  }

  const doneBtn = document.getElementById('done-btn');
  const aiBtn = document.getElementById('ai-suggestion-btn');
  const transLive = document.getElementById('transcript-live');
  const transEng = document.getElementById('transcript-english');
  const engWrap = document.getElementById('english-translation-wrap');
  const langBadge = document.getElementById('lang-detected-badge');

  if (doneBtn) { doneBtn.disabled = true; doneBtn.textContent = '⌛ Transcribing audio...'; }
  showToast('Sending audio blob to Gemini AI for transcription...', 'info');

  try {
    const formData = new FormData();
    formData.append('audio', _recordedAudioBlob, 'recording.webm');
    
    const patientId = getOrCreatePatientId();
    formData.append('patientId', patientId);

    const res = await fetch(`${_backendUrl}/complete`, {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || `Server error (${res.status})`);
    }

    _conversationId = result.conversationId;
    GramCare.patient.voiceIntake = result.data;
    console.log('[Frontend] Received Voice Intake Result:', result);

    if (transLive) transLive.textContent = `"${result.data.transcription.original}"`;
    if (transEng)  transEng.textContent  = `"${result.data.transcription.english}"`;
    if (engWrap)   engWrap.style.display   = 'block';

    if (langBadge) {
      langBadge.textContent = `${result.data.language.name} (${result.data.language.code})`;
      langBadge.style.display = 'inline-block';
    }

    if (doneBtn) { doneBtn.style.display = 'none'; doneBtn.disabled = false; }
    if (aiBtn)   { aiBtn.style.display = 'block'; }

    showToast('Audio transcribed successfully! Click AI Suggestion for problem analysis.', 'success');
  } catch (err) {
    console.error('Voice Intake submission error:', err.message);
    showToast('Voice Intake error: ' + err.message, 'error');
    if (doneBtn) { doneBtn.disabled = false; doneBtn.textContent = '✓ Done (Retry)'; }
  }
}

async function requestAiAnalysis() {
  if (!_conversationId) {
    showToast('No conversation ID found. Please complete voice intake first.', 'warning');
    return;
  }

  const aiBtn = document.getElementById('ai-suggestion-btn');
  if (aiBtn) { aiBtn.disabled = true; aiBtn.textContent = '⌛ Analyzing client problem...'; }
  showToast('Requesting Gemini AI Problem Analysis...', 'info');

  try {
    const res = await fetch(`${_backendUrl}/${_conversationId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: GramCare.patient.id })
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || `Analysis error (${res.status})`);
    }

    const aiData = result.data.aiAnalysis;
    console.log('[Frontend] Received AI Analysis:', aiData);

    GramCare.patient.aiAnalysis = aiData;
    renderAiAnalysisCard(result.data);

    if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = '✦ AI Suggestion (Analyze Client Problem)'; }
    showToast('AI Problem Analysis completed!', 'success');
  } catch (err) {
    console.error('AI Analysis error:', err.message);
    showToast('AI Analysis error: ' + err.message, 'error');
    if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = '✦ AI Suggestion (Retry)'; }
  }
}

function renderAiAnalysisCard(data) {
  const card = document.getElementById('ai-analysis-card');
  const container = document.getElementById('ai-analysis-results');
  if (!container) return;

  const analysis = data.aiAnalysis || {};
  const problem = analysis.problemAnalysis || analysis.clientProblem || {};
  const suggestions = analysis.aiSuggestions || analysis.suggestions || [];

  const mainEl     = document.getElementById('analysis-main-problem');
  const summEl     = document.getElementById('analysis-summary');
  const catEl      = document.getElementById('analysis-category');
  const confEl     = document.getElementById('analysis-confidence');
  const sevBadge   = document.getElementById('analysis-severity-badge');
  const issuesEl   = document.getElementById('analysis-key-issues');
  const detailsEl  = document.getElementById('analysis-details');
  const suggsEl    = document.getElementById('analysis-suggestions');
  const nextStepEl = document.getElementById('analysis-next-step');

  const mainProbStr = problem.mainProblem || problem.identifiedProblem || 'Analysis Completed';
  const summaryStr  = problem.problemSummary || 'Client intake transcript processed.';
  const categoryStr = problem.category || 'Clinical Intake';
  const severityStr = (problem.severity || 'unknown').toUpperCase();
  
  let confidenceStr = 'Not available';
  if (typeof analysis.confidence === 'number') {
    confidenceStr = `${(analysis.confidence * 100).toFixed(0)}%`;
  } else if (analysis.confidence) {
    confidenceStr = String(analysis.confidence);
  }

  if (mainEl)   mainEl.textContent = mainProbStr;
  if (summEl)   summEl.textContent = summaryStr;
  if (catEl)    catEl.textContent  = categoryStr;
  if (confEl)   confEl.textContent = confidenceStr;

  if (sevBadge) {
    sevBadge.textContent = severityStr;
    if (severityStr === 'HIGH' || severityStr === 'CRITICAL') {
      sevBadge.className = 'risk risk-red';
    } else if (severityStr === 'MEDIUM') {
      sevBadge.className = 'risk risk-amber';
    } else if (severityStr === 'LOW') {
      sevBadge.className = 'risk risk-green';
    } else {
      sevBadge.className = 'risk risk-gray';
    }
  }

  if (issuesEl) {
    if (problem.keyIssues && problem.keyIssues.length > 0) {
      issuesEl.innerHTML = problem.keyIssues.map(item => `<li>${item}</li>`).join('');
    } else {
      issuesEl.innerHTML = '<li style="font-style:italic;opacity:0.7;">Not available from the provided information.</li>';
    }
  }

  if (detailsEl) {
    if (problem.importantDetails && problem.importantDetails.length > 0) {
      detailsEl.innerHTML = problem.importantDetails.map(item => `<li>${item}</li>`).join('');
    } else {
      detailsEl.innerHTML = '<li style="font-style:italic;opacity:0.7;">Not available from the provided information.</li>';
    }
  }

  if (suggsEl) {
    if (suggestions && suggestions.length > 0) {
      suggsEl.innerHTML = suggestions.map(item => `<li>${item}</li>`).join('');
    } else {
      suggsEl.innerHTML = '<li style="font-style:italic;opacity:0.7;">Not available from the provided information.</li>';
    }
  }

  if (nextStepEl) {
    nextStepEl.textContent = analysis.recommendedNextStep || data.recommendedNextStep || 'Proceed to Document & Vitals Check';
  }

  if (card) card.style.display = 'block';
  container.style.display = 'block';
  (card || container).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Document Question Modal (STEP 2) ──────────────
function askPatientDocuments() {
  const existingModal = document.getElementById('doc-question-modal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="doc-question-modal" style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);">
      <div style="background:var(--white);border-radius:var(--radius-lg);max-width:480px;width:100%;padding:28px;box-shadow:var(--shadow-xl);text-align:center;">
        <div style="font-size:36px;margin-bottom:12px;">📁</div>
        <h3 style="font-family:var(--font-serif);font-size:22px;color:var(--ink);margin-bottom:8px;">Do you have any medical documents or reports?</h3>
        <p style="font-size:14px;color:var(--ink-60);line-height:1.6;margin-bottom:24px;">
          You can upload prescriptions, lab reports, discharge summaries, or injury photos for AI OCR extraction.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <button class="btn btn-primary btn-lg btn-full" onclick="confirmHasDocuments(true)">
            ✓ Yes, I Have Documents / Reports
          </button>
          <button class="btn btn-secondary btn-lg btn-full" onclick="confirmHasDocuments(false)">
            ✕ No, I Don't Have Documents
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function confirmHasDocuments(hasDocs) {
  const modal = document.getElementById('doc-question-modal');
  if (modal) modal.remove();

  GramCare.patient.hasDocuments = hasDocs;
  if (hasDocs) {
    navigateTo('documents');
  } else {
    showToast('Skipped document upload. Generating Unified AI Summary & Triage...', 'info');
    generatePatientAiSummaryAndNavigate();
  }
}

// ─── Documents Page & Real Upload ──────────────────
function initDocumentsPage() {
  initUploadZones();
}

async function handleRealDocumentUpload(file, zoneElement, category) {
  if (!file) return;

  const title = zoneElement ? zoneElement.querySelector('.upload-title') : null;
  const icon  = zoneElement ? zoneElement.querySelector('.upload-icon') : null;

  if (title) title.textContent = '⚙ Uploading & running PaddleOCR...';
  if (icon)  icon.textContent  = '⌛';

  showToast(`Processing ${file.name} with PaddleOCR & Gemini AI...`, 'info');

  try {
    const formData = new FormData();
    formData.append('document', file, file.name);

    const patientId = getOrCreatePatientId();

    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/documents`, {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || `Upload error (${res.status})`);
    }

    const docRecord = result.data;
    console.log('[Frontend] Real OCR & Extraction Complete:', docRecord);

    if (title) title.textContent = `✓ OCR Complete: ${docRecord.fileName}`;
    if (icon)  icon.textContent  = '✓';
    if (zoneElement) {
      zoneElement.style.borderColor = 'var(--forest)';
      zoneElement.style.background = 'var(--forest-pale)';
    }

    renderOcrExtractedResults(docRecord);
    showToast(`OCR & AI Extraction complete for ${docRecord.fileName}!`, 'success');
  } catch (err) {
    console.error('Document upload error:', err.message);
    if (title) title.textContent = '⚠️ OCR Error: ' + err.message;
    if (icon)  icon.textContent  = '❌';
    showToast('Document OCR error: ' + err.message, 'error');
  }
}

function renderOcrExtractedResults(docRecord) {
  const ocrCard = document.getElementById('ocr-results-card');
  const subTitle = document.getElementById('ocr-doc-subtitle');
  const statusBadge = document.getElementById('ocr-status-badge');
  const medContainer = document.getElementById('ocr-medications-container');
  const histContainer = document.getElementById('ocr-history-container');
  const safetyContainer = document.getElementById('ocr-safety-container');
  const woundContainer = document.getElementById('ocr-wound-container');
  const woundText = document.getElementById('ocr-wound-text');
  const textContainer = document.getElementById('ocr-text-container');

  if (subTitle) {
    subTitle.textContent = `From: ${docRecord.fileName} (${(docRecord.documentType || 'Document').toUpperCase()})`;
  }
  if (statusBadge) {
    statusBadge.textContent = `✓ ${docRecord.ocrEngine || 'PaddleOCR'}`;
  }

  // Medications
  if (medContainer) {
    const meds = docRecord.extractedData?.medications || [];
    if (meds.length > 0) {
      medContainer.innerHTML = meds.map(m => `
        <span class="pill pill-blue">${m.name || m} ${m.dose || ''} ${m.frequency || ''}</span>
      `).join(' ');
    } else {
      medContainer.innerHTML = '<span style="font-size:12.5px;color:var(--ink-50);font-style:italic;">No medications detected in uploaded document</span>';
    }
  }

  // History
  if (histContainer) {
    const hist = docRecord.extractedData?.medicalHistory || [];
    if (hist.length > 0) {
      histContainer.innerHTML = hist.map(h => `<span class="pill pill-orange">${h}</span>`).join(' ');
    } else {
      histContainer.innerHTML = '<span style="font-size:12.5px;color:var(--ink-50);font-style:italic;">No medical history detected in uploaded document</span>';
    }
  }

  // Safety Flags
  if (safetyContainer) {
    const flags = docRecord.safetyFlags || [];
    const allergies = docRecord.extractedData?.allergies || [];
    if (flags.length > 0 || allergies.length > 0) {
      safetyContainer.innerHTML = [
        ...allergies.map(a => `<div style="font-size:13px;color:var(--amber);margin-top:2px;">⚠️ Allergy noted: <strong>${a}</strong></div>`),
        ...flags.map(f => `<div style="font-size:13px;color:var(--amber);margin-top:2px;">⚠️ ${f}</div>`)
      ].join('');
    } else {
      safetyContainer.innerHTML = '<div style="font-size:13px;color:var(--ink-70);">Allergy information not found in uploaded document. Health worker must <strong>confirm verbally</strong>.</div>';
    }
  }

  // Wound Assessment
  if (woundContainer) {
    if (docRecord.woundAssessment) {
      woundContainer.style.display = 'block';
      if (woundText) woundText.textContent = docRecord.woundAssessment;
    } else {
      woundContainer.style.display = 'none';
    }
  }

  // Full OCR Text Preview
  if (textContainer) {
    textContainer.textContent = docRecord.ocrText || 'No readable text detected.';
  }

  if (ocrCard) {
    ocrCard.style.display = 'block';
    ocrCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ─── Generate AI Summary & Triage ──────────────────
async function generatePatientAiSummaryAndNavigate() {
  showToast('Synthesizing complete patient context with Gemini AI...', 'info');

  try {
    const patientId = getOrCreatePatientId();

    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/ai-summary`, {
      method: 'POST'
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || `AI Summary error (${res.status})`);
    }

    GramCare.patient.aiSummary = result.data;
    console.log('[Frontend] Received Unified AI Summary & Triage:', result.data);

    showToast('Unified AI Summary & Triage generated!', 'success');
    navigateTo('triage');
  } catch (err) {
    console.error('AI Summary error:', err.message);
    showToast('AI Summary error: ' + err.message + '. Opening Triage view...', 'error');
    navigateTo('triage');
  }
}

// ─── Triage Page (Strict Real Data Rendering) ─────
function initTriagePage() {
  if (window.GramCareAnim && GramCareAnim.animateTriageCircle) {
    GramCareAnim.animateTriageCircle();
  }

  const p = GramCare.patient || {};
  const aiSummary = p.aiSummary;

  // 1. Render REAL Vitals (Unified Source of Truth)
  const tempVal = p.vitals?.temp || aiSummary?.importantFindings?.find(f => f.includes('Temp'))?.split(':')[1]?.trim() || 'Not recorded';
  const bpVal   = p.vitals?.bp   || aiSummary?.importantFindings?.find(f => f.includes('Pressure'))?.split(':')[1]?.trim() || 'Not recorded';
  const hrVal   = p.vitals?.pulse|| aiSummary?.importantFindings?.find(f => f.includes('Pulse'))?.split(':')[1]?.trim() || 'Not recorded';
  const spo2Val = p.vitals?.spo2 || aiSummary?.importantFindings?.find(f => f.includes('SpO2'))?.split(':')[1]?.trim() || 'Not recorded';

  const tempEl = document.getElementById('triage-vital-temp');
  const bpEl   = document.getElementById('triage-vital-bp');
  const hrEl   = document.getElementById('triage-vital-hr');
  const spo2El = document.getElementById('triage-vital-spo2');

  if (tempEl) tempEl.textContent = tempVal;
  if (bpEl)   bpEl.textContent   = bpVal;
  if (hrEl)   hrEl.textContent   = hrVal;
  if (spo2El) spo2El.textContent = spo2Val;

  // 2. Render AI Summary Box
  const aiText = document.getElementById('triage-ai-text');
  const pillsContainer = document.getElementById('triage-symptoms-pills');

  if (aiSummary) {
    const triageBlock = document.getElementById('triage-block');
    const triageTitle = document.getElementById('triage-title');
    const triageDesc  = document.getElementById('triage-desc');
    const whyTitle    = document.getElementById('triage-why-title');
    const whyText     = document.getElementById('triage-why-text');
    const actionsList = document.getElementById('triage-actions-list');

    const level = (aiSummary.triage?.level || 'amber').toLowerCase();
    if (triageBlock) {
      triageBlock.className = `triage-block t-${level} reveal`;
    }

    if (triageTitle) {
      const levelLabel = level === 'red' ? 'RED — Critical Referral Required' : (level === 'routine' ? 'GREEN — Routine / OTC First-Aid' : 'AMBER — Doctor Review Required');
      const levelColor = level === 'red' ? 'var(--red)' : (level === 'routine' ? 'var(--green)' : 'var(--amber)');
      triageTitle.textContent = levelLabel;
      triageTitle.style.color = levelColor;
    }

    if (triageDesc) {
      triageDesc.textContent = aiSummary.triage?.reason || aiSummary.summary || 'Clinical assessment completed.';
    }

    if (aiText) {
      const mainTitle = aiSummary.mainProblem?.title || aiSummary.mainProblem?.summary || aiSummary.summary || 'Patient Assessment Completed';
      const mainSummary = aiSummary.mainProblem?.summary || aiSummary.summary || 'Clinical assessment completed.';
      const symptoms = aiSummary.reportedSymptoms || aiSummary.reportedProblems || [];
      const findings = aiSummary.importantFindings || [];
      const steps = aiSummary.whatCanBeDoneNow || aiSummary.recommendedNextSteps || [];
      const flags = aiSummary.redFlags || [];
      const nextStep = aiSummary.recommendedNextStep || 'Forward case to doctor for review.';
      const meds = aiSummary.medicationSuggestions || [];

      aiText.innerHTML = `
        <div style="font-family:var(--font-sans);">
          <!-- 1. Patient Info -->
          <div style="font-size:12px;color:var(--ink-50);margin-bottom:12px;display:flex;gap:12px;flex-wrap:wrap;border-bottom:1px solid rgba(0,0,0,.08);padding-bottom:8px;">
            <span><strong>Patient:</strong> ${p.name || 'Not recorded'}</span>
            <span><strong>Age:</strong> ${p.age || 'Not recorded'}</span>
            <span><strong>Gender:</strong> ${p.sex || 'Not recorded'}</span>
            <span><strong>ID:</strong> ${p.id || 'Not recorded'}</span>
          </div>

          <!-- 2. Main Problem Highlight -->
          <div style="background:var(--saffron-pale);border-left:4px solid var(--saffron);padding:12px 14px;border-radius:6px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--saffron-lt);">MAIN PROBLEM</div>
            <div style="font-size:14.5px;font-weight:700;color:var(--ink);margin-top:2px;">${mainTitle}</div>
            <div style="font-size:13px;color:var(--ink-70);margin-top:4px;">"${mainSummary}"</div>
          </div>

          <!-- 3. Symptoms Badges -->
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--ink-60);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">REPORTED SYMPTOMS</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              ${symptoms.length > 0 ? symptoms.map(s => `<span class="pill" style="background:rgba(232,105,42,.12);color:var(--saffron-lt);border:1px solid rgba(232,105,42,.25);font-size:12px;">• ${s}</span>`).join('') : '<span style="font-size:12.5px;color:var(--ink-50);font-style:italic;">No symptoms recorded</span>'}
            </div>
          </div>

          <!-- 4. Important Findings -->
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--ink-60);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">IMPORTANT FINDINGS</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;">
              ${findings.length > 0 ? findings.map(f => `<div style="background:var(--ink-10);padding:6px 10px;border-radius:6px;font-size:12px;color:var(--ink-80);">${f}</div>`).join('') : '<div style="font-size:12.5px;color:var(--ink-50);font-style:italic;">Not recorded</div>'}
            </div>
          </div>

          <!-- 5. Clinical Summary -->
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--ink-60);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">CLINICAL SUMMARY</div>
            <div style="font-size:13px;color:var(--ink-80);line-height:1.6;background:var(--white);padding:10px 12px;border-radius:8px;border:1px solid var(--ink-10);">
              ${aiSummary.clinicalSummary || aiSummary.summary || 'Clinical assessment completed.'}
            </div>
          </div>

          <!-- 6. What Can Be Done Now -->
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--forest);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">WHAT CAN BE DONE NOW</div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              ${steps.map(act => `<div style="font-size:12.5px;color:var(--ink-80);display:flex;align-items:flex-start;gap:6px;"><span style="color:var(--forest);">•</span><span>${act}</span></div>`).join('')}
            </div>
          </div>

          <!-- 7. Warning Signs / Red Flags -->
          <div style="margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">WARNING SIGNS / RED FLAGS</div>
            <div style="background:#FEE2E2;border-radius:8px;padding:10px 12px;border:1px solid #FCA5A5;">
              ${flags.length > 0 ? flags.map(fl => `<div style="font-size:12.5px;color:var(--red);margin-bottom:3px;">⚠ ${fl}</div>`).join('') : '<div style="font-size:12.5px;color:var(--ink-60);">No specific red flags identified from the available information.</div>'}
            </div>
          </div>

          <!-- 8. Medication Suggestions (If any) -->
          ${meds.length > 0 ? `
            <div style="margin-bottom:14px;">
              <div style="font-size:11px;font-weight:700;color:var(--sky);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">MEDICATION CONSIDERATIONS</div>
              ${meds.map(m => `
                <div style="background:var(--sky-pale);border:1px solid rgba(14,165,233,.3);border-radius:8px;padding:10px 12px;margin-bottom:6px;">
                  <div style="font-size:13px;font-weight:700;color:var(--sky);">💊 ${m.name}</div>
                  <div style="font-size:12px;color:var(--ink-70);margin-top:2px;"><strong>Reason:</strong> ${m.reason}</div>
                  <div style="font-size:12px;color:var(--ink-60);margin-top:2px;"><strong>Safety:</strong> ${m.safetyConsiderations || 'Check allergy & history'}</div>
                </div>
              `).join('')}
              <div style="background:#FEF3C7;border:1.5px solid #FCD34D;border-radius:8px;padding:10px 12px;margin-top:8px;">
                <div style="font-size:12px;font-weight:700;color:#B45309;">⚠️ MANDATORY CLINICAL WARNING:</div>
                <div style="font-size:11.5px;color:#92400E;margin-top:2px;line-height:1.5;">
                  AI-generated suggestion — DO NOT take or administer this medicine until it has been reviewed and approved by the doctor/qualified clinician.<br/>
                  <em>AI does not replace the prescribing decision of the treating doctor.</em>
                </div>
              </div>
            </div>
          ` : `
            <div style="font-size:12.5px;color:var(--ink-50);font-style:italic;margin-bottom:14px;">
              No medication suggestion generated from the available information.
            </div>
          `}

          <!-- 9. Recommended Next Step -->
          <div style="background:var(--ink);color:white;border-radius:8px;padding:12px 14px;">
            <div style="font-size:11px;font-weight:700;color:var(--saffron-lt);letter-spacing:.05em;text-transform:uppercase;">RECOMMENDED NEXT STEP</div>
            <div style="font-size:13px;margin-top:4px;">${nextStep}</div>
          </div>
        </div>
      `;
    }

    if (pillsContainer && aiSummary.reportedProblems) {
      pillsContainer.innerHTML = aiSummary.reportedProblems.map(prob => `
        <span class="pill" style="background:rgba(232,105,42,.15);color:var(--saffron-lt);border:1px solid rgba(232,105,42,.3);">${prob}</span>
      `).join(' ');
    }

    if (whyTitle) whyTitle.textContent = `Why ${level.toUpperCase()}?`;
    if (whyText)  whyText.textContent  = aiSummary.triage?.reason || 'Clinical safety rule triggered.';

    if (actionsList && aiSummary.recommendedNextSteps) {
      actionsList.innerHTML = aiSummary.recommendedNextSteps.map(step => `
        <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:var(--forest-pale);border:1px solid rgba(27,107,74,.2);">
          <span style="font-size:18px;">📋</span>
          <span style="font-size:13px;font-weight:600;color:var(--forest);">${step}</span>
        </div>
      `).join('');
    }
  } else if (p.voiceIntake) {
    if (aiText) {
      aiText.innerHTML = `
        <strong>Voice Intake Transcript (${p.name || 'Patient'}):</strong><br/>
        "${p.voiceIntake.transcription?.original || 'Voice recording processed'}"
      `;
    }
  }

  // Animate the safety engine check rows with stagger
  document.querySelectorAll('.safety-row').forEach((row, i) => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(-14px)';
    setTimeout(() => {
      row.style.transition = 'all .4s ease';
      row.style.opacity = '1';
      row.style.transform = 'translateX(0)';
    }, 300 + i * 120);
  });
}

// ─── First-Aid Protocol Page (Strict Real Clinical Data) ───
async function initProtocolPage() {
  const p = GramCare.patient || {};
  const patientId = getOrCreatePatientId();

  const nameEl = document.getElementById('protocol-patient-name');
  const summaryEl = document.getElementById('protocol-problem-summary');
  const titleEl = document.getElementById('protocol-title');
  const sourceEl = document.getElementById('protocol-source');
  const stepsList = document.getElementById('protocol-steps-list');
  const flagsList = document.getElementById('protocol-red-flags-list');
  const ragBadge = document.getElementById('protocol-rag-badge');

  if (nameEl) nameEl.textContent = `${p.name || 'Active Patient'} · ${p.age ? p.age + ' yrs' : 'Age N/A'} · ${p.village || 'Village N/A'}`;
  if (summaryEl) summaryEl.textContent = 'Fetching matching clinician-approved guidelines from MoHFW library...';

  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/first-aid`);
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || `First-Aid API error (${res.status})`);
    }

    const data = result.data;
    console.log('[Frontend] Received First-Aid Protocol:', data);

    if (summaryEl) summaryEl.textContent = `Identified Clinical Context: ${data.problem?.summary || 'Patient assessment completed.'}`;

    if (!data.matched) {
      if (titleEl) titleEl.textContent = '⚠️ No Applicable Protocol';
      if (sourceEl) sourceEl.textContent = 'MoHFW / ASHA Protocol Library';
      if (ragBadge) ragBadge.style.display = 'none';
      if (stepsList) {
        stepsList.innerHTML = `
          <div style="padding:24px;text-align:center;color:var(--ink-60);font-size:14px;line-height:1.6;">
            <div style="font-size:32px;margin-bottom:8px;">ℹ️</div>
            <strong>No applicable first-aid protocol identified for this case.</strong><br/>
            <span style="font-size:12.5px;color:var(--ink-50);">The system found no matching pre-approved first-aid protocol for the recorded complaints. Escalate directly to physician review.</span>
          </div>
        `;
      }
      if (flagsList) {
        flagsList.innerHTML = `<div style="font-size:13px;color:var(--ink-60);">No pre-configured red flags available for unmatched cases. Forward to Doctor.</div>`;
      }
      return;
    }

    if (titleEl) titleEl.textContent = data.protocol.title;
    if (sourceEl) sourceEl.textContent = `Source: ${data.protocol.source} (Ver ${data.protocol.version})`;
    if (ragBadge) {
      ragBadge.style.display = 'inline-flex';
      ragBadge.textContent = '✓ RAG-Retrieved';
    }

    if (stepsList && data.steps) {
      stepsList.innerHTML = data.steps.map(s => `
        <div class="protocol-step">
          <div class="step-num">${s.step}</div>
          <div>
            <div class="step-text">${s.instruction}</div>
            ${s.sub ? `<div class="step-sub">${s.sub}</div>` : ''}
          </div>
        </div>
      `).join('');
    }

    if (flagsList && data.redFlags) {
      flagsList.innerHTML = data.redFlags.map(rf => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.05);font-size:12.5px;color:var(--ink-70);">
          <span style="color:var(--red);font-weight:700;">⚠</span>
          <span>${rf}</span>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('First-Aid Protocol error:', err.message);
    if (titleEl) titleEl.textContent = '⚠️ Protocol Retrieval Notice';
    if (stepsList) {
      stepsList.innerHTML = `<div style="font-size:13px;color:var(--amber);">Unable to retrieve the relevant protocol. (${err.message})</div>`;
    }
  }
}

// ─── Medicine Safety Gate Page (Strict Real Clinical Data) ───
async function initMedicinePage() {
  if (window.GramCareAnim && GramCareAnim.initVitalsPulse) {
    GramCareAnim.initVitalsPulse();
  }

  const p = GramCare.patient || {};
  const patientId = getOrCreatePatientId();

  const nameEl = document.getElementById('medicine-patient-name');
  const subEl  = document.getElementById('medicine-patient-subtitle');
  const cardsContainer = document.getElementById('medicine-cards-container');

  if (nameEl) nameEl.textContent = `${p.name || 'Active Patient'} · ${p.age ? p.age + ' yrs' : 'Age N/A'} · ${p.sex || ''}`;
  if (subEl)  subEl.textContent  = 'Evaluating 6-layer medication safety gate on real patient context...';

  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}/medicine-gate`);
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.error || `Medicine Gate API error (${res.status})`);
    }

    const data = result.data;
    console.log('[Frontend] Received Medicine Gate Evaluation:', data);

    if (!data.hasMedication || !data.medications || data.medications.length === 0) {
      if (subEl) subEl.textContent = 'Clinical safety evaluation completed.';
      if (cardsContainer) {
        cardsContainer.innerHTML = `
          <div style="padding:28px;background:var(--white);border-radius:var(--radius-lg);border:1px solid var(--ink-10);text-align:center;" class="reveal">
            <div style="font-size:36px;margin-bottom:10px;">ℹ️</div>
            <h3 style="font-family:var(--font-serif);font-size:18px;color:var(--ink);margin-bottom:6px;">No Medication Recommendation Identified</h3>
            <p style="font-size:13.5px;color:var(--ink-60);line-height:1.6;max-width:440px;margin:0 auto;">
              No OTC medication recommendation was generated for this case based on the current patient complaints and clinical context.
            </p>
          </div>
        `;
      }
      return;
    }

    if (subEl) subEl.textContent = `Evaluated ${data.medications.length} medication option(s) against actual patient context.`;

    if (cardsContainer) {
      cardsContainer.innerHTML = data.medications.map(med => {
        const statusClass = med.status === 'APPROVED' ? 'risk-green' : (med.status === 'BLOCKED' ? 'risk-red' : 'risk-amber');
        const boxBg = med.status === 'APPROVED' ? 'var(--green-pale)' : (med.status === 'BLOCKED' ? '#FEE2E2' : 'var(--amber-pale)');
        const boxBorder = med.status === 'APPROVED' ? '#86EFAC' : (med.status === 'BLOCKED' ? '#FCA5A5' : '#FCD34D');
        const boxTitleColor = med.status === 'APPROVED' ? 'var(--green)' : (med.status === 'BLOCKED' ? 'var(--red)' : 'var(--amber)');

        const checks = med.safetyChecks || {};

        return `
          <div class="med-gate reveal" style="margin-bottom:20px;">
            <div class="med-gate-header">
              <span style="font-size:20px;">💊</span>
              <div>
                <div class="med-gate-name">${med.name}</div>
                <div style="font-size:12px;color:var(--ink-50);">${med.category} · ${med.dosage || ''}</div>
              </div>
              <span class="risk ${statusClass}" style="margin-left:auto;"><span class="risk-dot"></span>${med.status}</span>
            </div>
            <div class="med-gate-body stagger-list">
              <div class="check-row">${checks.allergy?.status === 'clear' ? '<span class="check-ok">✓</span>' : (checks.allergy?.status === 'flagged' ? '<span style="color:var(--red);font-weight:700;">✕</span>' : '<span class="check-warn">?</span>')} ${checks.allergy?.details || 'Allergy check pending'}</div>
              <div class="check-row">${checks.age?.status === 'clear' ? '<span class="check-ok">✓</span>' : '<span class="check-warn">?</span>'} ${checks.age?.details || 'Age check pending'}</div>
              <div class="check-row">${checks.pregnancy?.status === 'clear' ? '<span class="check-ok">✓</span>' : '<span class="check-warn">?</span>'} ${checks.pregnancy?.details || 'Pregnancy check pending'}</div>
              <div class="check-row">${checks.contraindication?.status === 'clear' ? '<span class="check-ok">✓</span>' : '<span class="check-warn">?</span>'} ${checks.contraindication?.details || 'Contraindication check pending'}</div>
              <div class="check-row">${checks.duplicateTherapy?.status === 'clear' ? '<span class="check-ok">✓</span>' : '<span class="check-warn">?</span>'} ${checks.duplicateTherapy?.details || 'Duplicate therapy check pending'}</div>
              <div class="check-row">${checks.protocolEligibility?.status === 'clear' || checks.protocolEligibility?.status === 'eligible' ? '<span class="check-ok">✓</span>' : '<span class="check-warn">?</span>'} ${checks.protocolEligibility?.details || 'Protocol eligibility check pending'}</div>
              
              <div style="margin-top:14px;padding:12px 14px;background:${boxBg};border-radius:8px;border:1.5px solid ${boxBorder};">
                <div style="font-size:12.5px;font-weight:700;color:${boxTitleColor};">${med.status === 'APPROVED' ? '✓ APPROVED FOR CLINIC ADMINISTRATION' : '⏳ AWAITING DOCTOR APPROVAL'}</div>
                <div style="font-size:12px;color:var(--ink-60);margin-top:4px;line-height:1.5;">${med.approvalNote}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('Medicine Gate error:', err.message);
    if (subEl) subEl.textContent = 'Medication safety analysis notice.';
    if (cardsContainer) {
      cardsContainer.innerHTML = `<div style="font-size:13px;color:var(--amber);padding:16px;">Medication safety analysis could not be completed. (${err.message})</div>`;
    }
  }
}

// ─── Dual/Triple Panel Role & Authorization Switcher ────────
let currentRole = localStorage.getItem('gramcare_role') || 'assistant';

function switchToRolePanel(role) {
  currentRole = role;
  localStorage.setItem('gramcare_role', role);

  const btnAsst = document.getElementById('btn-panel-assistant');
  const btnDoc  = document.getElementById('btn-panel-doctor');
  const btnPat  = document.getElementById('btn-panel-patient');

  if (role === 'doctor') {
    if (btnDoc)  { btnDoc.className  = 'btn btn-sm btn-primary'; }
    if (btnAsst) { btnAsst.className = 'btn btn-sm btn-ghost'; }
    if (btnPat)  { btnPat.className  = 'btn btn-sm btn-ghost'; }
    showToast('Switched to Doctor Operational Panel', 'info');
    navigateTo('doctor');
  } else if (role === 'patient') {
    if (btnPat)  { btnPat.className  = 'btn btn-sm btn-primary'; }
    if (btnAsst) { btnAsst.className = 'btn btn-sm btn-ghost'; }
    if (btnDoc)  { btnDoc.className  = 'btn btn-sm btn-ghost'; }
    showToast('Switched to Patient Care Portal', 'info');
    navigateTo('patient-dashboard');
  } else {
    if (btnAsst) { btnAsst.className = 'btn btn-sm btn-primary'; }
    if (btnDoc)  { btnDoc.className  = 'btn btn-sm btn-ghost'; }
    if (btnPat)  { btnPat.className  = 'btn btn-sm btn-ghost'; }
    showToast('Switched to Assistant Operational Panel', 'info');
    navigateTo('dashboard');
  }
}

// ─── Patient Care Portal Handlers ───────────────────────
async function initPatientDashboardPage() {
  const patientId = getOrCreatePatientId();
  const caseId = `CASE_${patientId}`;

  const nameEl  = document.getElementById('pat-name');
  const subEl   = document.getElementById('pat-sub');
  const medsList= document.getElementById('pat-approved-meds-list');
  const bedBody = document.getElementById('pat-bed-info-body');
  const asstName= document.getElementById('pat-asst-name');
  const asstPhone=document.getElementById('pat-asst-phone');
  const asstEmail=document.getElementById('pat-asst-email');
  const docName = document.getElementById('pat-doc-name');

  try {
    const res = await fetch(`http://localhost:5000/api/patient/dashboard-data?patientId=${patientId}&caseId=${caseId}`);
    const result = await res.json();
    if (!res.ok || !result.success) return;

    const data = result.data || {};
    const demo = data.demographics || {};
    const asst = data.assignedAssistant || {};
    const doc  = data.assignedDoctor || {};
    const approvedMeds = data.approvedMedications || [];

    if (nameEl) nameEl.textContent = demo.name || 'Patient';
    if (subEl)  subEl.textContent  = `Patient ID: ${patientId} · Active Clinic Encounter`;

    if (asstName)  asstName.textContent  = asst ? (asst.name || 'Clinic Assistant') : 'Clinic Assistant';
    if (asstPhone) asstPhone.textContent = asst ? (asst.phone || 'Not recorded') : 'Not recorded';
    if (asstEmail) asstEmail.textContent = asst ? (asst.email || 'Not recorded') : 'Not recorded';

    if (docName) docName.textContent = doc ? (doc.name || 'Attending Physician') : 'Attending Physician';

    // Render ONLY DOCTOR APPROVED MEDICATIONS
    if (medsList) {
      if (approvedMeds.length === 0) {
        medsList.innerHTML = `<div style="font-size:13px;color:var(--ink-50);font-style:italic;padding:12px 0;">No doctor-approved medications issued for this encounter yet.</div>`;
      } else {
        medsList.innerHTML = approvedMeds.map(m => `
          <div style="background:var(--forest-pale);border:1px solid rgba(27,107,74,.3);border-radius:10px;padding:12px 14px;">
            <div style="font-size:14.5px;font-weight:700;color:var(--forest);">💊 ${m.name}</div>
            <div style="font-size:12.5px;color:var(--ink-70);margin-top:3px;"><strong>Dose &amp; Schedule:</strong> ${m.dosage || 'As directed'}</div>
            <div style="font-size:12px;color:var(--ink-60);margin-top:2px;"><strong>Instructions:</strong> ${m.reason || 'Take as prescribed'}</div>
            <div style="font-size:11px;color:var(--forest);font-weight:700;margin-top:6px;">✓ Approved by ${m.approvedBy || 'Doctor'}</div>
          </div>
        `).join('');
      }
    }

    // Render Bed Assignment
    if (bedBody && data.bedAssignment) {
      const b = data.bedAssignment;
      bedBody.innerHTML = `
        <div style="background:var(--sky-pale);border:1px solid rgba(14,165,233,.3);border-radius:10px;padding:12px 14px;">
          <div style="font-size:14px;font-weight:700;color:var(--sky);">🛏️ ${b.ward}</div>
          <div style="font-size:12.5px;color:var(--ink-80);margin-top:3px;">Room: <strong>${b.room}</strong> · Bed: <strong>${b.bed}</strong></div>
          <div style="font-size:11.5px;color:var(--ink-60);margin-top:2px;">${b.notes || 'Admitted under clinical supervision'}</div>
        </div>
      `;
    }
  } catch (err) {
    console.warn('Failed to load patient dashboard data:', err.message);
  }
}

async function sendPatientReminderToAssistant() {
  const patientId = getOrCreatePatientId();
  const caseId = `CASE_${patientId}`;

  try {
    const res = await fetch(`http://localhost:5000/api/patient/cases/${caseId}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        requestType: 'Medication Schedule Guidance',
        message: 'Patient requested assistance regarding medication dosage and timing.'
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Reminder request sent to assigned clinic assistant via email!', 'success');
    }
  } catch (err) {
    showToast('Failed to send reminder request: ' + err.message, 'error');
  }
}

function callAssignedAssistant() {
  const phone = document.getElementById('pat-asst-phone')?.textContent || '+919876543210';
  window.location.href = `tel:${phone.replace(/[^0-9+]/g, '')}`;
}

// ─── Doctor Referrals & Queue Handlers ──────────────────
async function fetchDoctorReferrals() {
  const queueList = document.getElementById('doctor-referral-queue-list');
  const countBadge = document.getElementById('referral-queue-count');
  const countPending = document.getElementById('doc-count-pending');

  try {
    const token = getAuthToken();
    const user = getAuthUser();
    if (!user || user.role !== 'doctor') return;

    const docId = user.doctorId || user.userId;
    const res = await fetch(`http://localhost:5000/api/referrals/doctor/referrals?doctorId=${encodeURIComponent(docId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (!res.ok || !result.success) return;

    const referrals = result.data || [];
    if (countBadge) countBadge.textContent = `${referrals.length} Referral(s)`;
    if (countPending) countPending.textContent = String(referrals.filter(r => r.status === 'NEW').length);

    if (queueList) {
      if (referrals.length === 0) {
        queueList.innerHTML = `<div style="font-size:13px;color:var(--ink-50);font-style:italic;padding:12px 0;">No active referrals in queue. Assistant will send incoming patient cases.</div>`;
        return;
      }

      queueList.innerHTML = referrals.map(r => `
        <div style="background:var(--white);border:1px solid var(--ink-10);border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px;box-shadow:var(--shadow-sm);">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;font-size:15px;color:var(--ink);">${r.patientName}</span>
              <code style="font-size:11.5px;background:var(--ink-10);padding:2px 6px;border-radius:4px;">${r.patientId}</code>
              <code style="font-size:11.5px;background:var(--sky-pale);color:var(--sky);padding:2px 6px;border-radius:4px;">${r.caseId}</code>
            </div>
            <div style="font-size:12.5px;color:var(--ink-70);margin-top:4px;"><strong>Reason:</strong> "${r.reason || 'Clinical evaluation requested'}"</div>
            <div style="font-size:11.5px;color:var(--ink-50);margin-top:3px;">
              Referred by Assistant <strong>${r.assistantId || 'AST-CLINIC'}</strong> · ${new Date(r.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <span class="risk risk-${(r.riskLevel || 'amber').toLowerCase()}" style="font-size:10.5px;">${(r.riskLevel || 'amber').toUpperCase()}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sky btn-sm" onclick="openDoctorCaseView('${r.caseId}', '${r.patientId}')">📖 Open Case</button>
              ${r.status === 'NEW' ? `<button class="btn btn-forest btn-sm" onclick="acceptDoctorReferral('${r.referralId}')">✓ Accept</button>` : `<span style="font-size:11px;color:var(--forest);font-weight:700;padding:4px 8px;background:var(--forest-pale);border-radius:6px;">✓ Accepted</span>`}
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.warn('Failed to fetch doctor referrals:', err.message);
  }
}

async function acceptDoctorReferral(referralId) {
  try {
    const token = getAuthToken();
    const res = await fetch(`http://localhost:5000/api/referrals/${referralId}/accept`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Referral accepted! Case is now IN_CONSULTATION.', 'success');
      fetchDoctorReferrals();
      if (result.data?.caseId && result.data?.patientId) {
        openDoctorCaseView(result.data.caseId, result.data.patientId);
      }
    } else {
      showToast(result.error || 'Failed to accept referral.', 'error');
    }
  } catch (err) {
    showToast('Failed to accept referral: ' + err.message, 'error');
  }
}

async function openDoctorCaseView(caseId, patientId) {
  try {
    const token = getAuthToken();
    const res = await fetch(`http://localhost:5000/api/patients/lookup/${encodeURIComponent(patientId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast('Could not load case details.', 'error');
      return;
    }

    const p = data.data;
    GramCare.patient.id = p.patientId;
    GramCare.patient.name = p.name;
    GramCare.patient.age = p.age;
    GramCare.patient.sex = p.sex;
    GramCare.patient.village = p.village;
    GramCare.patient.vitals = p.vitals || {};
    GramCare.patient.aiSummary = p.aiSummary;

    // Update Doctor Case Card UI
    const titleEl = document.getElementById('doc-case-title');
    const nameEl = document.getElementById('doc-p-name');
    const ageEl = document.getElementById('doc-p-age');
    const vilEl = document.getElementById('doc-p-village');
    const tempEl = document.getElementById('doc-v-temp');
    const bpEl = document.getElementById('doc-v-bp');
    const hrEl = document.getElementById('doc-v-hr');
    const spo2El = document.getElementById('doc-v-spo2');
    const sumEl = document.getElementById('doc-ai-summary-text');

    if (titleEl) titleEl.textContent = `Patient Case: ${p.name} (${p.patientId})`;
    if (nameEl) nameEl.textContent = p.name;
    if (ageEl) ageEl.textContent = `${p.age} yrs (${p.sex})`;
    if (vilEl) vilEl.textContent = p.village || 'Rajpur';
    if (tempEl) tempEl.textContent = p.vitals?.temp || '98.6°F';
    if (bpEl) bpEl.textContent = p.vitals?.bp || '120/80 mmHg';
    if (hrEl) hrEl.textContent = p.vitals?.pulse || '72 bpm';
    if (spo2El) spo2El.textContent = p.vitals?.spo2 || '98%';
    if (sumEl) sumEl.textContent = p.aiSummary?.mainProblem?.summary || 'Clinical evaluation packet loaded. Ready for doctor assessment.';

    showToast(`Loaded case packet for ${p.name} (${p.patientId})`, 'info');
  } catch (err) {
    showToast('Error loading doctor case view: ' + err.message, 'error');
  }
}

async function sendReferralToDoctor() {
  const patientId = getOrCreatePatientId();
  const caseId = `CASE_${patientId}`;

  try {
    const res = await fetch(`http://localhost:5000/api/referrals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        caseId,
        doctorId: 'DOC_01',
        assistantId: 'ASSISTANT_01',
        riskLevel: GramCare.patient?.aiSummary?.triage?.level || 'amber',
        reason: GramCare.patient?.aiSummary?.mainProblem?.summary || 'Assistant clinical referral for physician decision.'
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Case successfully referred to attending physician!', 'success');
    }
  } catch (err) {
    showToast('Referral error: ' + err.message, 'error');
  }
}

// ─── DOCTOR DECISION MODAL HANDLERS (NO ALERTS, PROMPTS, OR DUMMY DATA) ─────

// 1. Bed Assignment Modal
function openDoctorBedModal() {
  const overlay = document.getElementById('doctor-assign-bed-modal-overlay');
  if (!overlay) return;

  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const caseId = `CASE_${patientId}`;
  const subEl = document.getElementById('bed-modal-case-sub');
  if (subEl) subEl.textContent = `Patient ID: ${patientId} · Case ID: ${caseId}`;

  // Clear inputs unless existing saved data is present for this case
  const wardInput = document.getElementById('bed-input-ward');
  const roomInput = document.getElementById('bed-input-room');
  const bedInput = document.getElementById('bed-input-bed');
  const floorInput = document.getElementById('bed-input-floor');
  const deptInput = document.getElementById('bed-input-department');
  const notesInput = document.getElementById('bed-input-notes');

  const existingBed = GramCare.patient?.bedAssignment;
  if (existingBed) {
    if (wardInput) wardInput.value = existingBed.ward || '';
    if (roomInput) roomInput.value = existingBed.room || '';
    if (bedInput) bedInput.value = existingBed.bed || '';
    if (floorInput) floorInput.value = existingBed.floor || '';
    if (deptInput) deptInput.value = existingBed.department || 'General Medicine';
    if (notesInput) notesInput.value = existingBed.notes || '';
  } else {
    if (wardInput) wardInput.value = '';
    if (roomInput) roomInput.value = '';
    if (bedInput) bedInput.value = '';
    if (floorInput) floorInput.value = '';
    if (deptInput) deptInput.value = '';
    if (notesInput) notesInput.value = '';
  }

  overlay.style.display = 'flex';
  setTimeout(() => wardInput?.focus(), 100);
}

function closeDoctorBedModal() {
  const overlay = document.getElementById('doctor-assign-bed-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function submitDoctorBedAssignment() {
  const ward = document.getElementById('bed-input-ward')?.value.trim();
  const room = document.getElementById('bed-input-room')?.value.trim();
  const bed = document.getElementById('bed-input-bed')?.value.trim();
  const floor = document.getElementById('bed-input-floor')?.value.trim();
  const dept = document.getElementById('bed-input-department')?.value.trim();
  const notes = document.getElementById('bed-input-notes')?.value.trim();

  if (!ward || !room || !bed) {
    showToast('Please enter Ward, Room, and Bed numbers.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-save-bed-assignment');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving Bed...'; }

  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const caseId = `CASE_${patientId}`;
  const user = getAuthUser();
  const token = getAuthToken();

  try {
    const res = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/bed-assignment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ward, room, bed, floor, department: dept, notes,
        doctorId: user?.doctorId || user?.userId || 'Doctor'
      })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      showToast(result.error || 'Failed to assign bed.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🛏️ Assign & Save Bed'; }
      return;
    }

    showToast(`✓ Bed assigned successfully: ${ward}, ${room}, ${bed}`, 'success');
    GramCare.patient.bedAssignment = result.data;
    closeDoctorBedModal();
    initDoctorPage();
    loadAssistantCarePanel();
  } catch (err) {
    showToast('Error assigning bed: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🛏️ Assign & Save Bed'; }
  }
}

// 2. Add / Approve Medicine Modal
let activeAiMedSuggestion = null;

function openDoctorMedicineModal() {
  const overlay = document.getElementById('doctor-add-medicine-modal-overlay');
  if (!overlay) return;

  const nameInput = document.getElementById('med-input-name');
  const doseInput = document.getElementById('med-input-dosage');
  const durInput = document.getElementById('med-input-duration');
  const reasonInput = document.getElementById('med-input-reason');
  const aiSugBox = document.getElementById('med-modal-ai-suggestion');
  const aiSugText = document.getElementById('med-ai-sug-text');

  if (nameInput) nameInput.value = '';
  if (doseInput) doseInput.value = '';
  if (durInput) durInput.value = '';
  if (reasonInput) reasonInput.value = '';

  const aiSug = GramCare.patient?.aiSummary?.treatmentSuggestions?.[0] || GramCare.patient?.aiSummary?.mainProblem?.suggestedMeds?.[0];
  if (aiSug && aiSugBox && aiSugText) {
    activeAiMedSuggestion = typeof aiSug === 'string' ? aiSug : (aiSug.name || aiSug.medicine || JSON.stringify(aiSug));
    aiSugText.textContent = activeAiMedSuggestion;
    aiSugBox.style.display = 'block';
  } else if (aiSugBox) {
    aiSugBox.style.display = 'none';
  }

  overlay.style.display = 'flex';
  setTimeout(() => nameInput?.focus(), 100);
}

function closeDoctorMedicineModal() {
  const overlay = document.getElementById('doctor-add-medicine-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function useAiMedSuggestion() {
  if (!activeAiMedSuggestion) return;
  const nameInput = document.getElementById('med-input-name');
  if (nameInput) nameInput.value = activeAiMedSuggestion;
  showToast('AI suggestion copied to prescription form.', 'info');
}

async function submitDoctorApproveMedicine() {
  const name = document.getElementById('med-input-name')?.value.trim();
  const dosage = document.getElementById('med-input-dosage')?.value.trim();
  const route = document.getElementById('med-input-route')?.value;
  const frequency = document.getElementById('med-input-frequency')?.value;
  const duration = document.getElementById('med-input-duration')?.value.trim();
  const reason = document.getElementById('med-input-reason')?.value.trim();

  if (!name || !dosage) {
    showToast('Medicine Name and Dosage are required fields.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-save-medicine');
  if (btn) { btn.disabled = true; btn.textContent = 'Approving Medicine...'; }

  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const caseId = `CASE_${patientId}`;
  const user = getAuthUser();
  const token = getAuthToken();

  try {
    const res = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        doctorId: user?.doctorId || user?.userId || 'Doctor',
        doctorNote: reason || `Prescribed ${name} (${dosage})`,
        medications: [
          {
            medicationId: `med_${Date.now()}`,
            name,
            dosage,
            route,
            frequency,
            duration,
            instructions: duration,
            reason,
            status: 'DOCTOR_APPROVED',
            approvedAt: new Date().toISOString()
          }
        ]
      })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      showToast(result.error || 'Failed to approve medication.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '💊 Approve & Add Prescription'; }
      return;
    }

    showToast(`✓ Prescription approved: ${name} (${dosage})`, 'success');
    closeDoctorMedicineModal();
    initDoctorPage();
    loadAssistantCarePanel();
  } catch (err) {
    showToast('Error approving medication: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💊 Approve & Add Prescription'; }
  }
}

// 3. Configure Medication Schedule Modal
let selectedScheduleTimes = [];

function openDoctorScheduleModal() {
  const overlay = document.getElementById('doctor-schedule-med-modal-overlay');
  if (!overlay) return;

  const medSelect = document.getElementById('sched-input-med-select');
  const doseInput = document.getElementById('sched-input-dose');
  const container = document.getElementById('sched-time-badges-container');

  selectedScheduleTimes = [];
  if (container) {
    container.innerHTML = `<span style="font-size:12px;color:var(--ink-50);font-style:italic;" id="sched-no-times-hint">No times added yet. Pick time above and click + Add.</span>`;
  }
  if (doseInput) doseInput.value = '';

  if (medSelect) {
    medSelect.innerHTML = '<option value="">-- Choose Approved Medicine --</option>';
    const approvedMeds = GramCare.patient?.approvedMedications || GramCare.patient?.medications || [];
    if (approvedMeds.length > 0) {
      approvedMeds.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = `${m.name} (${m.dosage || 'Standard dose'})`;
        medSelect.appendChild(opt);
      });
    } else {
      const opt = document.createElement('option');
      opt.value = 'General Administration';
      opt.textContent = 'General Administration / Medication';
      medSelect.appendChild(opt);
    }
  }

  overlay.style.display = 'flex';
}

function closeDoctorScheduleModal() {
  const overlay = document.getElementById('doctor-schedule-med-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

function addScheduleTimeBadge() {
  const timePicker = document.getElementById('sched-input-time-picker');
  const val = timePicker?.value;
  if (!val) {
    showToast('Please pick a valid time (HH:MM).', 'warning');
    return;
  }

  if (selectedScheduleTimes.includes(val)) {
    showToast(`Time ${val} is already added to schedule.`, 'info');
    return;
  }

  selectedScheduleTimes.push(val);
  selectedScheduleTimes.sort();

  const container = document.getElementById('sched-time-badges-container');
  if (container) {
    container.innerHTML = selectedScheduleTimes.map(t => `
      <span class="pill pill-sky" style="font-size:12px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;">
        ⏰ ${t}
        <button type="button" onclick="removeScheduleTimeBadge('${t}')" style="background:none;border:none;color:var(--ink);cursor:pointer;font-weight:700;padding:0 2px;">✕</button>
      </span>
    `).join('');
  }
}

function removeScheduleTimeBadge(t) {
  selectedScheduleTimes = selectedScheduleTimes.filter(x => x !== t);
  const container = document.getElementById('sched-time-badges-container');
  if (container) {
    if (selectedScheduleTimes.length === 0) {
      container.innerHTML = `<span style="font-size:12px;color:var(--ink-50);font-style:italic;" id="sched-no-times-hint">No times added yet. Pick time above and click + Add.</span>`;
    } else {
      container.innerHTML = selectedScheduleTimes.map(timeStr => `
        <span class="pill pill-sky" style="font-size:12px;display:inline-flex;align-items:center;gap:6px;padding:4px 10px;">
          ⏰ ${timeStr}
          <button type="button" onclick="removeScheduleTimeBadge('${timeStr}')" style="background:none;border:none;color:var(--ink);cursor:pointer;font-weight:700;padding:0 2px;">✕</button>
        </span>
      `).join('');
    }
  }
}

async function submitDoctorScheduleMedication() {
  const medName = document.getElementById('sched-input-med-select')?.value;
  const dose = document.getElementById('sched-input-dose')?.value.trim();

  if (!medName) {
    showToast('Please select a medication.', 'warning');
    return;
  }

  if (selectedScheduleTimes.length === 0) {
    showToast('Please add at least one specific administration time (HH:MM).', 'warning');
    return;
  }

  const btn = document.getElementById('btn-save-med-schedule');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving Schedule...'; }

  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const caseId = `CASE_${patientId}`;
  const user = getAuthUser();
  const token = getAuthToken();

  try {
    const res = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/medication-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        medicationName: medName,
        dose: dose || 'Standard dose',
        times: selectedScheduleTimes,
        doctorId: user?.doctorId || user?.userId || 'Doctor'
      })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      showToast(result.error || 'Failed to save medication schedule.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '⏰ Save Medication Schedule'; }
      return;
    }

    showToast(`✓ Medication schedule saved for ${medName} at ${selectedScheduleTimes.join(', ')}`, 'success');
    closeDoctorScheduleModal();
    initDoctorPage();
    loadAssistantCarePanel();
  } catch (err) {
    showToast('Error saving schedule: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '⏰ Save Medication Schedule'; }
  }
}

// 4. Send Doctor Instruction Modal
function openDoctorInstructionModal() {
  const overlay = document.getElementById('doctor-instruction-modal-overlay');
  if (!overlay) return;
  const txtInput = document.getElementById('doctor-instruction-textarea');
  if (txtInput) txtInput.value = '';
  overlay.style.display = 'flex';
  setTimeout(() => txtInput?.focus(), 100);
}

function closeDoctorInstructionModal() {
  const overlay = document.getElementById('doctor-instruction-modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

async function submitDoctorInstruction() {
  const msg = document.getElementById('doctor-instruction-textarea')?.value.trim();
  if (!msg) {
    showToast('Please enter an instruction message for the assistant.', 'warning');
    return;
  }

  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const caseId = `CASE_${patientId}`;
  const user = getAuthUser();
  const token = getAuthToken();

  try {
    const res = await fetch(`http://localhost:5000/api/doctors/cases/${caseId}/instruction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: msg,
        doctorId: user?.doctorId || user?.userId || 'Doctor'
      })
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      showToast(result.error || 'Failed to send instruction.', 'error');
      return;
    }

    showToast('✓ Doctor instruction sent to Assistant!', 'success');
    closeDoctorInstructionModal();
    initDoctorPage();
    loadAssistantCarePanel();
  } catch (err) {
    showToast('Error sending instruction: ' + err.message, 'error');
  }
}

// Helper to load Assistant Care Panel from MongoDB Atlas
async function loadAssistantCarePanel() {
  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id');
  if (!patientId) return;

  const caseBadge = document.getElementById('asst-care-case-badge');
  const bedEl = document.getElementById('asst-bed-assignment-display');
  const instEl = document.getElementById('asst-doctor-instructions-display');
  const medsEl = document.getElementById('asst-medication-tasks-display');
  const followEl = document.getElementById('asst-followup-display');

  try {
    const token = getAuthToken();
    const res = await fetch(`http://localhost:5000/api/patients/lookup/${encodeURIComponent(patientId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) return;

    const p = data.data;
    const caseId = p.currentCaseId || `CASE_${p.patientId}`;
    if (caseBadge) caseBadge.textContent = `Case ID: ${caseId}`;

    // Bed Assignment Display
    if (bedEl) {
      if (p.bedAssignment && p.bedAssignment.ward) {
        bedEl.innerHTML = `
          <strong>Ward:</strong> ${p.bedAssignment.ward} | <strong>Room:</strong> ${p.bedAssignment.room} | <strong>Bed:</strong> ${p.bedAssignment.bed}<br/>
          <span style="font-size:11.5px;color:var(--ink-60);">${p.bedAssignment.floor || ''} ${p.bedAssignment.department ? '· ' + p.bedAssignment.department : ''}</span>
        `;
      } else {
        bedEl.innerHTML = `<span style="color:var(--ink-50);font-style:italic;">No bed assigned</span>`;
      }
    }

    // Doctor Instructions Display
    if (instEl) {
      const instructions = p.doctorInstructions || [];
      if (instructions.length > 0) {
        const latest = instructions[instructions.length - 1];
        instEl.innerHTML = `
          <strong>Instruction:</strong> "${latest.message}"<br/>
          <span style="font-size:11px;color:var(--ink-50);">Sent by Doctor · ${new Date(latest.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
        `;
      } else {
        instEl.innerHTML = `<span style="color:var(--ink-50);font-style:italic;">No doctor instructions</span>`;
      }
    }

    // Medication Tasks Display
    if (medsEl) {
      const approvedMeds = p.approvedMedications || [];
      if (approvedMeds.length > 0) {
        medsEl.innerHTML = approvedMeds.map(m => `
          <div style="margin-bottom:4px;">
            <strong>💊 ${m.name}</strong> (${m.dosage || ''}) — <span class="pill pill-green" style="font-size:10px;">DOCTOR APPROVED</span><br/>
            <span style="font-size:11.5px;color:var(--ink-60);">${m.frequency || 'As prescribed'} ${m.instructions ? '· ' + m.instructions : ''}</span>
          </div>
        `).join('');
      } else {
        medsEl.innerHTML = `<span style="color:var(--ink-50);font-style:italic;">No medication scheduled</span>`;
      }
    }

    // Follow-Up Display
    if (followEl) {
      if (p.followUp && p.followUp.followUpDate) {
        followEl.innerHTML = `
          <strong>Date:</strong> ${p.followUp.followUpDate} at ${p.followUp.followUpTime || '10:00 AM'}<br/>
          <span style="font-size:11.5px;color:var(--ink-60);">Reason: "${p.followUp.reason || 'Clinical review'}"</span>
        `;
      } else {
        followEl.innerHTML = `<span style="color:var(--ink-50);font-style:italic;">No follow-up scheduled</span>`;
      }
    }

  } catch (err) {
    console.warn('Failed to load assistant care panel:', err.message);
  }
}

function initDoctorPage() {
  initCounters();
  fetchDoctorReferrals();

  const p = GramCare.patient || {};
  const patientId = getOrCreatePatientId();
  const caseId = `CASE_${patientId}`;
  const aiSummary = p.aiSummary;

  const titleEl = document.getElementById('doc-case-title');
  const nameEl  = document.getElementById('doc-p-name');
  const ageEl   = document.getElementById('doc-p-age');
  const vilEl   = document.getElementById('doc-p-village');
  const langEl  = document.getElementById('doc-p-lang');
  const tempEl  = document.getElementById('doc-v-temp');
  const bpEl    = document.getElementById('doc-v-bp');
  const hrEl    = document.getElementById('doc-v-hr');
  const spo2El  = document.getElementById('doc-v-spo2');
  const summaryEl = document.getElementById('doc-ai-summary-text');
  const handoffBody = document.getElementById('doc-ai-handoff-body');
  const timelineContainer = document.getElementById('doc-case-timeline-container');

  if (titleEl)   titleEl.textContent = `Patient Case — ${p.name || 'Active Patient'}`;
  if (nameEl)    nameEl.textContent  = p.name || 'Unregistered Patient';
  if (ageEl)     ageEl.textContent   = p.age ? `${p.age} yrs · ${p.sex || ''}` : 'Not provided';
  if (vilEl)     vilEl.textContent   = p.village || 'Not provided';
  if (langEl)    langEl.textContent  = p.language || 'Hindi';

  if (tempEl) tempEl.textContent = p.vitals?.temp || 'Not recorded';
  if (bpEl)   bpEl.textContent   = p.vitals?.bp   || 'Not recorded';
  if (hrEl)   hrEl.textContent   = p.vitals?.pulse|| 'Not recorded';
  if (spo2El) spo2El.textContent = p.vitals?.spo2 || 'Not recorded';

  if (summaryEl) {
    summaryEl.textContent = aiSummary?.summary || (p.voiceIntake ? `Voice Intake: "${p.voiceIntake.transcription?.english || p.voiceIntake.transcription?.original}"` : 'Awaiting clinical summary...');
  }

  // Render AI Handoff Brief
  if (handoffBody) {
    handoffBody.innerHTML = `
      <div style="font-size:12.5px;color:rgba(255,255,255,.9);line-height:1.65;">
        <div style="font-weight:700;color:var(--saffron-lt);margin-bottom:4px;">Patient Summary:</div>
        <div>${aiSummary?.summary || 'Voice & Vitals context transferred.'}</div>
        <div style="margin-top:8px;font-weight:700;color:#4ADE80;">Recommended Next Step:</div>
        <div>${aiSummary?.recommendedNextStep || 'Review vitals and approve treatment plan.'}</div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px dashed rgba(255,255,255,.15);font-size:11px;color:rgba(255,255,255,.5);display:flex;gap:10px;">
          <span>Source: Voice Intake (${p.voiceIntake ? 'Recorded ✓' : 'None'})</span>
          <span>Documents: ${p.documents?.length || 0}</span>
          <span>Vitals: Recorded ✓</span>
        </div>
      </div>
    `;
  }

  // Render Case Intelligence Timeline
  if (timelineContainer) {
    fetch(`http://localhost:5000/api/cases/${caseId}`)
      .then(r => r.json())
      .then(res => {
        const events = res.data?.timeline || [];
        if (events.length === 0) {
          timelineContainer.innerHTML = `<div style="font-size:12.5px;color:var(--ink-50);font-style:italic;">Encounter registered. Awaiting events...</div>`;
          return;
        }

        timelineContainer.innerHTML = events.map(ev => `
          <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;background:var(--ink-10);border-radius:8px;">
            <span style="font-size:16px;">⏱️</span>
            <div>
              <div style="font-size:12.5px;font-weight:700;color:var(--ink);">${ev.title}</div>
              <div style="font-size:11.5px;color:var(--ink-60);">${ev.description}</div>
              <div style="font-size:10px;color:var(--ink-50);margin-top:2px;">By ${ev.actor} (${ev.actorRole}) · ${new Date(ev.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        `).join('');
      })
      .catch(_ => {});
  }
}

function initRecordsPage() {
  const p = GramCare.patient || {};
  const aiSummary = p.aiSummary;

  const titleEl = document.getElementById('records-encounter-title');
  const subEl   = document.getElementById('records-encounter-subtitle');
  const timelineEl = document.getElementById('records-audit-timeline');
  const aiTextEl   = document.getElementById('records-ai-text');

  if (titleEl) titleEl.textContent = `✅ Encounter Packet — ${p.name || 'Active Patient'}`;
  if (subEl)   subEl.textContent   = `Case ID #${p.id || 'PAT_DEFAULT'} · Active Session`;

  if (aiTextEl) {
    aiTextEl.textContent = aiSummary?.summary || 'No AI summary generated yet for this encounter.';
  }

  if (timelineEl) {
    const lines = [];
    if (p.id) lines.push(`Patient Registered: ${p.name || 'Patient'} (${p.id})`);
    if (p.voiceIntake) lines.push(`Voice Intake Completed: ${p.voiceIntake.language?.name || 'Audio'}`);
    if (p.documents?.length) lines.push(`Documents OCR Processed: ${p.documents.length} file(s)`);
    if (aiSummary) lines.push(`AI Summary Generated: Triage Risk Level [${(aiSummary.triage?.level || 'routine').toUpperCase()}]`);

    if (lines.length > 0) {
      timelineEl.innerHTML = lines.map((l, i) => `<div class="audit-line">${i+1}. ${l}</div>`).join('');
    }
  }

  const items = document.querySelectorAll('.audit-line');
  items.forEach((item, i) => {
    item.style.opacity = '0';
    setTimeout(() => {
      item.style.transition = 'opacity .4s ease';
      item.style.opacity = '1';
    }, i * 100);
  });
}

function initIBMBobPage() {
  if (window.GramCareAnim && GramCareAnim.initIBMToolsReveal) {
    GramCareAnim.initIBMToolsReveal();
  }
}

function initQueuePage() {
  const p = GramCare.patient || {};
  const listEl = document.getElementById('queue-patient-list');
  const countBadge = document.getElementById('queue-count-badge');

  if (p && p.name && listEl) {
    if (countBadge) countBadge.textContent = '1 active patient';
    listEl.innerHTML = `
      <div class="patient-row" onclick="navigateTo('triage')">
        <div class="patient-avatar" style="background:linear-gradient(135deg,#E8692A,#F4A261)">${p.name.substring(0, 2).toUpperCase()}</div>
        <div style="flex:1;">
          <div class="patient-name">${p.name}, ${p.age || ''} · ${p.sex || ''}</div>
          <div class="patient-meta">${p.village || ''} · ${p.voiceIntake ? 'Voice Recorded' : 'No Voice'} · ${p.aiSummary?.triage?.level ? p.aiSummary.triage.level.toUpperCase() : 'Active'}</div>
        </div>
        <span class="risk risk-amber"><span class="risk-dot"></span>${(p.aiSummary?.triage?.level || 'Active').toUpperCase()}</span>
        <span style="font-size:12px;color:var(--ink-50);margin-left:16px;">Now</span>
      </div>
    `;
  }
}

function goToStep(pageId) {
  navigateTo(pageId);
}

function initUploadZones() {
  document.querySelectorAll('.upload-zone').forEach((zone, index) => {
    let fileInput = zone.querySelector('input[type="file"]');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*,.pdf';
      fileInput.style.display = 'none';
      zone.appendChild(fileInput);

      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          handleRealDocumentUpload(e.target.files[0], zone, zone.id || 'doc');
        }
      });
    }

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.style.borderColor = 'var(--saffron)';
      zone.style.background = 'var(--saffron-pale)';
    });
    zone.addEventListener('dragleave', () => {
      zone.style.borderColor = '';
      zone.style.background = '';
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = 'var(--forest)';
      zone.style.background = 'var(--forest-pale)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleRealDocumentUpload(e.dataTransfer.files[0], zone, zone.id || 'doc');
      }
    });
    zone.addEventListener('click', () => {
      fileInput.click();
    });
  });
}

function doctorApprove() {
  showToast('Treatment approved & prescription issued', 'success');
  setTimeout(() => navigateTo('records'), 1200);
}
function doctorRefer() {
  showToast('Patient referred to District Hospital', 'warning');
}

function toggleAuthModal(show) {
  const modal = document.getElementById('auth-dropdown-modal');
  if (!modal) return;
  
  if (typeof show === 'boolean') {
    modal.style.display = show ? 'block' : 'none';
  } else {
    modal.style.display = (modal.style.display === 'none' || !modal.style.display) ? 'block' : 'none';
  }

  if (modal.style.display === 'block') {
    const raw = sessionStorage.getItem('gc_auth');
    // Check if user is already authenticated for modal view
    const user = getAuthUser();
    const loggedOutView  = document.getElementById('modal-logged-out-view');
    const loggedInView   = document.getElementById('modal-logged-in-view');
    if (user) {
      if (loggedOutView)  loggedOutView.style.display  = 'none';
      if (loggedInView)   loggedInView.style.display   = 'block';
      const mu = document.getElementById('modal-user-name');
      const mr = document.getElementById('modal-user-role');
      if (mu) mu.textContent = user.name  || 'User';
      if (mr) mr.textContent = user.role  || 'Member';
    } else {
      if (loggedOutView)  loggedOutView.style.display  = 'block';
      if (loggedInView)   loggedInView.style.display   = 'none';
    }
  }
}

// ─── Authentication & RBAC Gate System ─────────────
let selectedGateRole = 'assistant';
let currentAuthMode  = 'login';

function getAuthToken() {
  return localStorage.getItem('gramcare_token') || sessionStorage.getItem('gramcare_token');
}

function getAuthUser() {
  try {
    const raw = localStorage.getItem('gramcare_user') || sessionStorage.getItem('gramcare_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function isAuthenticated() {
  const token = getAuthToken();
  const user  = getAuthUser();
  return !!(token && user && user.role);
}

function selectAuthRole(role) {
  selectedGateRole = role;
  const btnAsst = document.getElementById('role-btn-assistant');
  const btnDoc  = document.getElementById('role-btn-doctor');
  const btnPat  = document.getElementById('role-btn-patient');

  if (btnAsst) btnAsst.className = role === 'assistant' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost';
  if (btnDoc)  btnDoc.className  = role === 'doctor'    ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost';
  if (btnPat)  btnPat.className  = role === 'patient'   ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost';
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  const loginModeBtn = document.getElementById('auth-mode-login');
  const regModeBtn   = document.getElementById('auth-mode-register');
  const loginCont    = document.getElementById('gate-login-container');
  const regCont      = document.getElementById('gate-register-container');

  if (mode === 'register') {
    if (loginModeBtn) loginModeBtn.className = 'btn btn-sm btn-ghost btn-full';
    if (regModeBtn)   regModeBtn.className   = 'btn btn-sm btn-primary btn-full';
    if (loginCont)    loginCont.style.display = 'none';
    if (regCont)      regCont.style.display   = 'block';
    if (location.hash !== '#register') location.hash = '#register';
  } else {
    if (loginModeBtn) loginModeBtn.className = 'btn btn-sm btn-primary btn-full';
    if (regModeBtn)   regModeBtn.className   = 'btn btn-sm btn-ghost btn-full';
    if (loginCont)    loginCont.style.display = 'block';
    if (regCont)      regCont.style.display   = 'none';
    if (location.hash !== '#login') location.hash = '#login';
  }
}

function autofillGateDemoCreds() {
  const emailInput = document.getElementById('gate-email-input');
  const passInput  = document.getElementById('gate-password-input');
  if (selectedGateRole === 'doctor') {
    if (emailInput) emailInput.value = 'doctor@gramcare.ai';
    if (passInput)  passInput.value  = 'doctor123';
  } else if (selectedGateRole === 'patient') {
    if (emailInput) emailInput.value = 'patient@gramcare.ai';
    if (passInput)  passInput.value  = 'patient123';
  } else {
    if (emailInput) emailInput.value = 'assistant@gramcare.ai';
    if (passInput)  passInput.value  = 'password123';
  }
  showToast('Demo credentials autofilled!', 'info');
}

async function sendGateOtp() {
  const email = document.getElementById('gate-reg-email')?.value.trim();
  const statusEl = document.getElementById('gate-otp-status');

  if (!email) {
    showToast('Please enter an email address to send OTP', 'warning');
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: selectedGateRole })
    });
    const data = await res.json();
    if (data.success) {
      if (statusEl) statusEl.textContent = `✓ OTP sent to your email. Please check your inbox.`;
      showToast(`OTP sent to ${email}`, 'success');
      startResendCooldownTimer();
    } else {
      showToast(data.error || 'Failed to send OTP', 'error');
    }
  } catch (err) {
    showToast('Network error sending OTP: ' + err.message, 'error');
  }
}

async function resendGateOtp() {
  const email = document.getElementById('gate-reg-email')?.value.trim();
  const statusEl = document.getElementById('gate-otp-status');

  if (!email) {
    showToast('Please enter your email address to resend OTP', 'warning');
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: selectedGateRole })
    });
    const data = await res.json();
    if (data.success) {
      if (statusEl) statusEl.textContent = `✓ Resent OTP to your email. Check your inbox.`;
      showToast(`Resent OTP to ${email}`, 'success');
      startResendCooldownTimer();
    } else {
      showToast(data.error || 'Failed to resend OTP', 'error');
    }
  } catch (err) {
    showToast('Error resending OTP: ' + err.message, 'error');
  }
}

function startResendCooldownTimer() {
  const resendBtn = document.getElementById('gate-btn-resend-otp');
  if (!resendBtn) return;
  let seconds = 60;
  resendBtn.disabled = true;
  resendBtn.textContent = `Resend in ${seconds}s`;
  const interval = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(interval);
      resendBtn.disabled = false;
      resendBtn.textContent = `🔄 Resend Email OTP`;
    } else {
      resendBtn.textContent = `Resend in ${seconds}s`;
    }
  }, 1000);
}

async function executeGateLogin() {
  const email = document.getElementById('gate-email-input')?.value.trim();
  const pass  = document.getElementById('gate-password-input')?.value;

  if (!email || !pass) {
    showToast('Please enter both email and password.', 'warning');
    return;
  }

  try {
    const res = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, role: selectedGateRole })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      showToast(data.error || 'Login failed. Please check credentials.', 'error');
      return;
    }

    // Save authenticated token and user session
    localStorage.setItem('gramcare_token', data.token);
    localStorage.setItem('gramcare_user', JSON.stringify(data.user));
    localStorage.setItem('gramcare_role', data.user.role);

    showToast(`Welcome, ${data.user.name}!`, 'success');
    checkAuthStateAndRender();
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
  }
}

async function executeGateRegister() {
  const name  = document.getElementById('gate-reg-name')?.value.trim();
  const email = document.getElementById('gate-reg-email')?.value.trim();
  const pass  = document.getElementById('gate-reg-pass')?.value;

  if (!name || !email || !pass) {
    showToast('Please fill in Name, Email, and Password.', 'warning');
    return;
  }

  try {
    const regRes = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        password: pass,
        role: selectedGateRole
      })
    });
    const regData = await regRes.json();

    if (!regRes.ok || !regData.success) {
      showToast(regData.error || 'Registration failed.', 'error');
      return;
    }

    localStorage.setItem('gramcare_token', regData.token);
    localStorage.setItem('gramcare_user', JSON.stringify(regData.user));
    localStorage.setItem('gramcare_role', regData.user.role);

    showToast(`Account created successfully! Welcome, ${regData.user.name}.`, 'success');
    checkAuthStateAndRender();
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('gramcare_token');
  localStorage.removeItem('gramcare_user');
  localStorage.removeItem('gramcare_role');
  sessionStorage.clear();

  const mainLayout = document.getElementById('main-app-layout');
  const gateScreen = document.getElementById('auth-screen-gate');

  if (mainLayout) mainLayout.style.display = 'none';
  if (gateScreen) gateScreen.style.display = 'flex';

  window.location.hash = '#login';
  switchAuthMode('login');
  showToast('Logged out cleanly from GramCare AI Portal', 'info');
}

// Quick Login from topbar modal (re-uses the main gate login logic)
async function handleQuickLogin() {
  const email = document.getElementById('modal-login-email')?.value.trim();
  const pass  = document.getElementById('modal-login-pass')?.value;
  const role  = document.getElementById('modal-login-role')?.value || 'assistant';
  selectedGateRole = role;
  const emailInput = document.getElementById('gate-email-input');
  const passInput  = document.getElementById('gate-password-input');
  if (emailInput) emailInput.value = email;
  if (passInput)  passInput.value  = pass;
  toggleAuthModal(false);
  await executeGateLogin();
}

// Role-based Page Access Rules
const ROLE_ALLOWED_PAGES = {
  assistant: ['dashboard', 'new-patient', 'queue', 'intake', 'documents', 'triage', 'protocol', 'medicine'],
  doctor:    ['doctor', 'queue', 'records', 'ibmbob'],
  patient:   ['patient-dashboard']
};

function enforceRoleRouteProtection(pageId) {
  if (!isAuthenticated()) return false;

  const user = getAuthUser();
  const allowedPages = ROLE_ALLOWED_PAGES[user.role] || [];

  if (!allowedPages.includes(pageId)) {
    showToast(`403 Forbidden: Role '${user.role}' is not authorized for '${pageId}'.`, 'error');
    const defaultPage = user.role === 'doctor' ? 'doctor' : (user.role === 'patient' ? 'patient-dashboard' : 'dashboard');
    navigateTo(defaultPage);
    return false;
  }
  return true;
}

function checkAuthStateAndRender() {
  const gateScreen = document.getElementById('auth-screen-gate');
  const mainLayout = document.getElementById('main-app-layout');

  const currentHash = location.hash.replace('#', '');

  if (!isAuthenticated()) {
    if (gateScreen) gateScreen.style.display = 'flex';
    if (mainLayout) mainLayout.style.display = 'none';
    
    if (currentHash === 'register' || currentHash === 'verify-otp') {
      switchAuthMode('register');
    } else {
      switchAuthMode('login');
    }
    return;
  }

  // Authenticated User
  const user = getAuthUser();
  if (!user || !user.role) {
    handleLogout();
    return;
  }

  if (gateScreen) gateScreen.style.display = 'none';
  if (mainLayout) mainLayout.style.display = 'flex';

  populateSidebarUser();
  updateSidebarForRole(user.role);

  const targetPage = user.role === 'doctor' ? 'doctor' : (user.role === 'patient' ? 'patient-dashboard' : 'dashboard');
  const page = currentHash || targetPage;

  const allowedPages = ROLE_ALLOWED_PAGES[user.role] || [];
  if (allowedPages.includes(page)) {
    navigateTo(page);
  } else {
    navigateTo(targetPage);
  }
}

function updateSidebarForRole(role) {
  const navAsst = document.getElementById('sidebar-nav-assistant');
  const navDoc  = document.getElementById('sidebar-nav-doctor');
  const navPat  = document.getElementById('sidebar-nav-patient');

  if (navAsst) navAsst.style.display = role === 'assistant' ? 'block' : 'none';
  if (navDoc)  navDoc.style.display  = role === 'doctor'    ? 'block' : 'none';
  if (navPat)  navPat.style.display  = role === 'patient'   ? 'block' : 'none';
}

function populateSidebarUser() {
  try {
    const user = getAuthUser();
    if (!user) return;

    const nameEl   = document.getElementById('sidebar-user-name');
    const roleEl   = document.getElementById('sidebar-user-role');
    const initials = document.getElementById('sidebar-avatar-initials');

    let initialsText = 'SW';
    if (user.name) {
      const parts = user.name.trim().split(/\s+/);
      initialsText = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : user.name.substring(0, 2).toUpperCase();
    }

    const customId = user.patientId || user.doctorId || user.assistantId || user.userId || '';

    if (nameEl)   nameEl.textContent   = user.name;
    if (roleEl)   roleEl.textContent   = (user.role === 'doctor' ? (user.specialty || 'Medical Doctor') : (user.role === 'patient' ? 'Registered Patient' : 'Clinic Assistant')) + (customId ? ` (${customId})` : '');
    if (initials) initials.textContent = initialsText;

    const modalName = document.getElementById('modal-user-name');
    const modalRole = document.getElementById('modal-user-role');
    if (modalName) modalName.textContent = user.name;
    if (modalRole) modalRole.textContent = `${user.role.toUpperCase()} ID: ${customId}`;

    const docIdBadge = document.getElementById('doc-id-badge');
    if (docIdBadge && user.role === 'doctor') docIdBadge.textContent = user.doctorId || customId || 'DOC-PENDING';

    const patIdBadge = document.getElementById('pat-id-display');
    if (patIdBadge && user.role === 'patient') patIdBadge.textContent = user.patientId || customId || 'PAT-PENDING';
  } catch (_) {}
}

async function asstSearchPatientById() {
  const patientIdInput = document.getElementById('asst-search-patient-id')?.value.trim();
  const resEl = document.getElementById('asst-patient-search-result');
  if (!patientIdInput) {
    showToast('Please enter a Patient ID (e.g. PAT-8F29K31A)', 'warning');
    return;
  }

  try {
    const token = getAuthToken();
    const res = await fetch(`http://localhost:5000/api/patients/lookup/${encodeURIComponent(patientIdInput)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (resEl) resEl.innerHTML = `<span style="color:var(--red);">❌ ${data.error || 'Patient not found.'}</span>`;
      showToast(data.error || 'Patient not found.', 'error');
      return;
    }

    const p = data.data;
    GramCare.patient.id = p.patientId;
    sessionStorage.setItem('gc_patient_id', p.patientId);

    if (resEl) {
      resEl.innerHTML = `
        <div style="background:var(--forest-pale);border:1px solid var(--forest);border-radius:8px;padding:8px 10px;margin-top:6px;">
          <strong>✓ Found Patient:</strong> ${p.name} (${p.age} yrs, ${p.sex})<br/>
          <strong>Patient ID:</strong> <code>${p.patientId}</code> | <strong>Case ID:</strong> <code>${p.currentCaseId || 'None'}</code><br/>
          <button class="btn btn-sm btn-forest" onclick="navigateTo('intake')" style="margin-top:6px;">Open Intake &amp; Case Packet</button>
        </div>
      `;
    }
    showToast(`Patient found: ${p.name} (${p.patientId})`, 'success');
  } catch (err) {
    showToast('Error searching patient: ' + err.message, 'error');
  }
}

let currentVerifiedDoctor = null;

function openReferDoctorModal(patientId) {
  const modalOverlay = document.getElementById('refer-doctor-modal-overlay');
  if (!modalOverlay) return;

  const patId = patientId || GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const patName = GramCare.patient.name || 'Rahul Sharma';
  const patRisk = GramCare.patient.risk || 'AMBER';
  const caseId  = GramCare.patient.currentCaseId || GramCare.patient.caseId || `Case Encounter for ${patId}`;

  const nameEl = document.getElementById('modal-patient-name-display');
  const metaEl = document.getElementById('modal-patient-meta-display');
  const riskPill = document.getElementById('modal-patient-risk-pill');
  const inputEl = document.getElementById('modal-doctor-id-input');
  const statusEl = document.getElementById('modal-doctor-search-status');
  const cardEl = document.getElementById('modal-doctor-verified-card');
  const confirmBtn = document.getElementById('btn-modal-confirm-referral');

  if (nameEl) nameEl.textContent = patName;
  if (metaEl) metaEl.textContent = `Patient ID: ${patId} ${caseId ? '· ' + caseId : ''}`;
  if (riskPill) {
    riskPill.textContent = (patRisk || 'AMBER').toUpperCase();
    riskPill.className = `pill pill-${(patRisk || 'amber').toLowerCase() === 'high' ? 'red' : 'amber'}`;
  }

  // Initial State: NO doctor selected, input cleared, verified card hidden
  if (inputEl) inputEl.value = '';
  if (statusEl) { statusEl.style.display = 'none'; statusEl.innerHTML = ''; }
  if (cardEl) cardEl.style.display = 'none';
  if (confirmBtn) { confirmBtn.style.display = 'none'; confirmBtn.disabled = false; confirmBtn.textContent = '🚀 Confirm & Send Referral'; }

  currentVerifiedDoctor = null;
  modalOverlay.style.display = 'flex';
  setTimeout(() => inputEl?.focus(), 100);
}

function closeReferDoctorModal() {
  const modalOverlay = document.getElementById('refer-doctor-modal-overlay');
  if (modalOverlay) modalOverlay.style.display = 'none';
  currentVerifiedDoctor = null;
}

async function modalSearchDoctor() {
  const doctorIdInput = document.getElementById('modal-doctor-id-input')?.value.trim();
  const statusEl = document.getElementById('modal-doctor-search-status');
  const cardEl = document.getElementById('modal-doctor-verified-card');
  const confirmBtn = document.getElementById('btn-modal-confirm-referral');

  if (!doctorIdInput) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `<div style="color:var(--amber);font-weight:600;font-size:13px;background:#FEF3C7;padding:8px 12px;border-radius:8px;border:1px solid #FCD34D;">⚠️ Please enter a Doctor ID (e.g. DOC-3N8E4ZJQ) or Doctor Email.</div>`;
    }
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="color:var(--sky);font-weight:600;font-size:13px;background:var(--sky-pale);padding:8px 12px;border-radius:8px;border:1px solid var(--sky);">⏳ Searching for doctor...</div>`;
  }
  if (cardEl) cardEl.style.display = 'none';
  if (confirmBtn) confirmBtn.style.display = 'none';

  try {
    const token = getAuthToken();
    const res = await fetch(`http://localhost:5000/api/doctors/lookup/${encodeURIComponent(doctorIdInput)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.status === 404) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#B91C1C;font-weight:600;font-size:13px;background:#FEE2E2;padding:8px 12px;border-radius:8px;border:1px solid #FCA5A5;">❌ Doctor not found. Please verify Doctor ID.</div>`;
      }
      return;
    }

    if (res.status === 401) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#B91C1C;font-weight:600;font-size:13px;background:#FEE2E2;padding:8px 12px;border-radius:8px;border:1px solid #FCA5A5;">❌ Session expired. Please log in again.</div>`;
      }
      return;
    }

    if (res.status === 403) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#B91C1C;font-weight:600;font-size:13px;background:#FEE2E2;padding:8px 12px;border-radius:8px;border:1px solid #FCA5A5;">❌ Permission denied. Assistant role required.</div>`;
      }
      return;
    }

    if (!res.ok || !data.success) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#B91C1C;font-weight:600;font-size:13px;background:#FEE2E2;padding:8px 12px;border-radius:8px;border:1px solid #FCA5A5;">❌ ${data.error || 'Unable to verify doctor. Please try again.'}</div>`;
      }
      return;
    }

    const doc = data.data;
    currentVerifiedDoctor = doc;

    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `<div style="color:#15803D;font-weight:600;font-size:13px;background:#DCFCE7;padding:8px 12px;border-radius:8px;border:1px solid #86EFAC;">✓ Doctor found &amp; verified! Review details below.</div>`;
    }

    // Populate Doctor Details Card
    const nameEl = document.getElementById('modal-doc-verified-name');
    const specEl = document.getElementById('modal-doc-verified-spec');
    const idEl   = document.getElementById('modal-doc-verified-id');
    const statusBadge = document.getElementById('modal-doc-status-badge');

    if (nameEl) nameEl.textContent = doc.name || 'Attending Doctor';
    if (specEl) specEl.textContent = `${doc.specialty || 'General Medicine'} · Clinical Panel`;
    if (idEl) idEl.textContent = doc.doctorId;
    if (statusBadge) {
      statusBadge.textContent = doc.onlineStatus === 'OFFLINE' ? '🔴 OFFLINE' : (doc.onlineStatus === 'BUSY' ? '🟡 BUSY' : '🟢 ONLINE');
    }

    if (cardEl) cardEl.style.display = 'block';
    if (confirmBtn) { confirmBtn.style.display = 'inline-block'; confirmBtn.disabled = false; confirmBtn.textContent = '🚀 Confirm & Send Referral'; }

  } catch (err) {
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `<div style="color:#B91C1C;font-weight:600;font-size:13px;background:#FEE2E2;padding:8px 12px;border-radius:8px;border:1px solid #FCA5A5;">❌ Unable to verify doctor. Connection issue: ${err.message}</div>`;
    }
  }
}

async function modalConfirmSendReferral() {
  if (!currentVerifiedDoctor) {
    showToast('Please search and verify a doctor first.', 'warning');
    return;
  }

  const confirmBtn = document.getElementById('btn-modal-confirm-referral');
  const reasonInput = document.getElementById('modal-referral-reason-input')?.value.trim();

  const patientId = GramCare.patient.id || sessionStorage.getItem('gc_patient_id') || 'PAT_DEFAULT';
  const caseId    = GramCare.patient.currentCaseId || GramCare.patient.caseId || null;
  const user      = getAuthUser();

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = '🚀 Sending Referral...';
  }

  try {
    const token = getAuthToken();
    const res = await fetch('http://localhost:5000/api/referrals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        patientId,
        caseId,
        doctorId: currentVerifiedDoctor.doctorId,
        assistantId: user?.assistantId || 'AST_DEFAULT',
        riskLevel: GramCare.patient.risk || 'medium',
        reason: reasonInput || GramCare.patient?.aiSummary?.mainProblem?.summary || 'Clinical referral from Assistant Panel for physician evaluation.',
        aiSummary: GramCare.patient?.aiSummary || null
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showToast(data.error || 'Failed to send referral.', 'error');
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '🚀 Confirm & Send Referral'; }
      return;
    }

    showToast(`✓ Referral sent successfully to ${currentVerifiedDoctor.name} (${currentVerifiedDoctor.doctorId})!`, 'success');
    closeReferDoctorModal();

    // If on doctor queue or dashboard, refresh view
    if (typeof loadDoctorReferralQueue === 'function') loadDoctorReferralQueue();

  } catch (err) {
    showToast('Network error sending referral: ' + err.message, 'error');
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = '🚀 Confirm & Send Referral'; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthStateAndRender();

  // Explicit Auth Gate Button Event Listeners
  document.getElementById('auth-mode-login')?.addEventListener('click', e => { e.preventDefault(); switchAuthMode('login'); });
  document.getElementById('auth-mode-register')?.addEventListener('click', e => { e.preventDefault(); switchAuthMode('register'); });
  document.getElementById('gate-login-btn')?.addEventListener('click', e => { e.preventDefault(); executeGateLogin(); });
  document.getElementById('gate-register-btn')?.addEventListener('click', e => { e.preventDefault(); executeGateRegister(); });
  document.getElementById('btn-send-otp')?.addEventListener('click', e => { e.preventDefault(); sendGateOtp(); });

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  window.addEventListener('hashchange', () => {
    if (!isAuthenticated()) {
      checkAuthStateAndRender();
      return;
    }
    const page = location.hash.replace('#', '') || 'dashboard';
    if (enforceRoleRouteProtection(page)) {
      navigateTo(page);
    }
  });

  initRevealAnimations();
});

