/* ═══════════════════════════════════════════════════
   GramCare AI — App Logic & Navigation
   app.js
════════════════════════════════════════════════════ */

// ─── State ────────────────────────────────────────
const GramCare = {
  currentPage: null,
  patient: {
    name: 'Ramesh Kumar',
    age: 44,
    sex: 'Male',
    language: 'Hindi',
    village: 'Rajpur',
    complaints: ['Fever · 2 days', 'Weakness · 2 days', 'Hand Injury · 1 day'],
    vitals: { temp: '101.4°F', bp: '138/88', pulse: '92 bpm', spo2: '97%' },
    history: ['Hypertension', 'Amlodipine 5mg OD'],
    risk: 'AMBER',
  },
};

// ─── Page Navigation ──────────────────────────────
function navigateTo(pageId) {
  if (GramCare.currentPage === pageId) return;
  GramCare.currentPage = pageId;

  // Show page loader bar
  showPageLoader();

  // Load the page fragment
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

      // Execute scripts embedded in the loaded HTML fragment
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

      // Check if fallback template exists
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

// Helper to execute script tags inserted via innerHTML
function executeFragmentScripts(container) {
  const scripts = container.querySelectorAll('script');
  scripts.forEach(oldScript => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

// ─── Sidebar Active State ──────────────────────────
function updateSidebar(pageId) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageId) item.classList.add('active');
  });
}

// ─── Topbar Title ──────────────────────────────────
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
};
function updateTopbar(pageId) {
  const el = document.getElementById('topbar-title');
  const sub = document.getElementById('topbar-sub');
  const t = PAGE_TITLES[pageId] || [pageId, ''];
  if (el)  el.textContent  = t[0];
  if (sub) sub.textContent = t[1];
}

// ─── Page Loader ───────────────────────────────────
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

// ─── Toast ─────────────────────────────────────────
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

// ─── Counter Animations ────────────────────────────
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

// ─── Scroll Reveal ────────────────────────────────
function initRevealAnimations() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); } });
  }, { threshold: 0.12 });
  els.forEach(el => observer.observe(el));
}

// ─── Per-Page Scripts ──────────────────────────────
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

// ─── Dashboard ─────────────────────────────────────
function initDashboard() {
  if (window.GramCareAnim) {
    GramCareAnim.animateProgressBars();
    GramCareAnim.initActivityFeed();
    GramCareAnim.initHeroParticles();
  }
}

// ─── New Patient Page ──────────────────────────────
function initNewPatientPage() {
  initUploadZones();
}

// ─── Voice Intake ──────────────────────────────────
let _recording = false;
let _recInterval = null;

function initIntakePage() {
  const btn = document.getElementById('voice-btn');
  if (btn) btn.addEventListener('click', toggleRecording);
}

function toggleRecording() {
  _recording = !_recording;
  const btn     = document.getElementById('voice-btn');
  const status  = document.getElementById('voice-status');
  const wf      = document.getElementById('waveform');
  const trans   = document.getElementById('transcript-live');

  if (_recording) {
    btn?.classList.add('recording');
    btn && (btn.textContent = '⏹');
    if (status) status.textContent = '🔴 Recording — speak clearly';
    wf?.classList.add('active');

    // Simulate typewriter transcript
    const sample = '"Patient ko do din se bukhar aur weakness hai, haath par choti si injury bhi hai. BP ki dawai le rahe hain..."';
    let i = 0;
    if (trans) trans.textContent = '';
    _recInterval = setInterval(() => {
      if (!_recording) { clearInterval(_recInterval); return; }
      if (trans && i <= sample.length) { trans.textContent = sample.substring(0, i++); }
    }, 40);
  } else {
    btn?.classList.remove('recording');
    btn && (btn.textContent = '🎙');
    if (status) status.textContent = '⚙ AI is processing transcript…';
    wf?.classList.remove('active');
    clearInterval(_recInterval);

    setTimeout(() => {
      if (status) status.textContent = '✓ Intake complete — 3 complaints extracted';
      showToast('Intake complete — AI extracted 3 complaints', 'success');
      highlightExtracted();
    }, 1800);
  }
}

function highlightExtracted() {
  document.querySelectorAll('.extracted-item').forEach((el, i) => {
    setTimeout(() => el.classList.add('flash'), i * 120);
  });
}

// ─── Documents Page ────────────────────────────────
function initDocumentsPage() {
  initUploadZones();
}

// ─── Triage Page ───────────────────────────────────
function initTriagePage() {
  if (window.GramCareAnim && GramCareAnim.animateTriageCircle) {
    GramCareAnim.animateTriageCircle();
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

// ─── Protocol Page ─────────────────────────────────
function initProtocolPage() {
  // Protocol page specific animations if needed
}

// ─── Medicine Page ─────────────────────────────────
function initMedicinePage() {
  if (window.GramCareAnim && GramCareAnim.initVitalsPulse) {
    GramCareAnim.initVitalsPulse();
  }
}

// ─── Doctor Page ───────────────────────────────────
function initDoctorPage() {
  initCounters();
}

// ─── Records Page ──────────────────────────────────
function initRecordsPage() {
  // Draw audit timeline lines
  const items = document.querySelectorAll('.audit-line');
  items.forEach((item, i) => {
    item.style.opacity = '0';
    setTimeout(() => {
      item.style.transition = 'opacity .4s ease';
      item.style.opacity = '1';
    }, i * 100);
  });
}

// ─── IBM Bob Page ──────────────────────────────────
function initIBMBobPage() {
  if (window.GramCareAnim && GramCareAnim.initIBMToolsReveal) {
    GramCareAnim.initIBMToolsReveal();
  }
}

// ─── Queue Page ────────────────────────────────────
function initQueuePage() {
  // Queue filter handlers
  document.querySelectorAll('.risk-gray, .risk-green, .risk-amber, .risk-red').forEach(badge => {
    badge.addEventListener('click', () => {
      const text = badge.textContent.trim();
      showToast(`Filtered queue: ${text}`, 'info');
    });
  });
}

// ─── Workflow Nav Step Click ───────────────────────
function goToStep(pageId) {
  navigateTo(pageId);
}

// ─── Document Upload Drag & Drop ──────────────────
function initUploadZones() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
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
      const icon = zone.querySelector('.upload-icon');
      const title = zone.querySelector('.upload-title');
      if (icon) icon.textContent = '✓';
      if (title) title.textContent = 'File received — processing OCR…';
      showToast('Document uploaded — running OCR', 'success');
      setTimeout(() => {
        zone.style.borderColor = 'var(--forest)';
        if (title) title.textContent = '✓ OCR complete';
      }, 2000);
    });
    zone.addEventListener('click', () => {
      showToast('Camera / file picker activated', 'info');
    });
  });
}

// ─── Doctor Approve / Modify ───────────────────────
function doctorApprove() {
  showToast('Treatment approved & prescription issued', 'success');
  setTimeout(() => navigateTo('records'), 1200);
}
function doctorRefer() {
  showToast('Patient referred to District Hospital', 'warning');
}

// ─── Bootstrap on DOMContentLoaded ────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set initial page from URL hash or default
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // Register sidebar nav clicks
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Update hash on navigate
  window.addEventListener('hashchange', () => {
    const p = location.hash.replace('#', '') || 'dashboard';
    navigateTo(p);
  });

  initRevealAnimations();
});
