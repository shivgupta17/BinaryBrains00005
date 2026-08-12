/* ═══════════════════════════════════════════════════
   GramCare AI — Animation Triggers & Effects
   animations.js
════════════════════════════════════════════════════ */

// ─── Particle Background ──────────────────────────
function initParticles(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.style.position = 'relative';
  container.style.overflow = 'hidden';

  const colors = ['rgba(232,105,42,.4)', 'rgba(27,107,74,.3)', 'rgba(26,111,168,.3)', 'rgba(244,162,97,.35)'];
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('div');
    dot.className = 'particle';
    const size = Math.random() * 6 + 3;
    const left = Math.random() * 100;
    const delay = Math.random() * 4;
    const dur   = Math.random() * 5 + 5;
    Object.assign(dot.style, {
      width:           `${size}px`,
      height:          `${size}px`,
      left:            `${left}%`,
      bottom:          `-${size}px`,
      background:      colors[Math.floor(Math.random() * colors.length)],
      animationDuration:`${dur}s`,
      animationDelay:  `${delay}s`,
    });
    container.appendChild(dot);
  }
}

// ─── Ripple Effect on Buttons ─────────────────────
function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-primary, .btn-forest, .btn-sky');
    if (!btn) return;
    const ripple = document.createElement('span');
    const rect   = btn.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height) * 2;
    Object.assign(ripple.style, {
      position:     'absolute',
      width:        `${size}px`,
      height:       `${size}px`,
      left:         `${e.clientX - rect.left - size / 2}px`,
      top:          `${e.clientY - rect.top  - size / 2}px`,
      background:   'rgba(255,255,255,.25)',
      borderRadius: '50%',
      transform:    'scale(0)',
      animation:    'ripple .55s ease forwards',
      pointerEvents:'none',
    });
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// ─── Stagger Cards ────────────────────────────────
function staggerCards(selector = '.card, .stat-card', parent = document) {
  const cards = parent.querySelectorAll(selector);
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(16px)';
    setTimeout(() => {
      card.style.transition = 'opacity .45s ease, transform .45s cubic-bezier(.4,0,.2,1)';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 65 + 80);
  });
}

// ─── Progress Bar Animate ─────────────────────────
function animateProgressBars(parent = document) {
  parent.querySelectorAll('.progress-fill[data-width]').forEach(bar => {
    const target = bar.dataset.width;
    bar.style.width = '0';
    setTimeout(() => {
      bar.style.transition = 'width .9s cubic-bezier(.4,0,.2,1)';
      bar.style.width = target;
    }, 300);
  });
}

// ─── Counter Animate (standalone) ─────────────────
function animateCounter(el, target, duration = 1200) {
  const start = Date.now();
  const tick = () => {
    const elapsed = Date.now() - start;
    const p = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target);
    if (p < 1) requestAnimationFrame(tick);
  };
  tick();
}

// ─── Typewriter Text ──────────────────────────────
function typewriterEffect(el, text, speed = 35, onDone) {
  if (!el) return;
  el.textContent = '';
  let i = 0;
  const tick = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) {
      clearInterval(tick);
      if (onDone) onDone();
    }
  }, speed);
  return () => clearInterval(tick); // return canceller
}

// ─── Heartbeat Vitals ──────────────────────────────
function initVitalsPulse() {
  document.querySelectorAll('.vital-card.warning, .vital-card.critical').forEach(card => {
    card.style.animation = 'none';
    setInterval(() => {
      card.style.transform = 'scale(1.025)';
      setTimeout(() => { card.style.transform = 'scale(1)'; }, 200);
    }, 2000);
  });
}

// ─── Triage Circle Spin-In ────────────────────────
function animateTriageCircle() {
  const circle = document.querySelector('.triage-circle');
  if (!circle) return;
  circle.style.transform = 'scale(0) rotate(-180deg)';
  circle.style.transition = 'none';
  setTimeout(() => {
    circle.style.transition = 'transform .65s cubic-bezier(.34,1.56,.64,1)';
    circle.style.transform  = 'scale(1) rotate(0deg)';
  }, 200);
}

// ─── Sidebar Logo Entrance ────────────────────────
function initSidebarEntrance() {
  const logo = document.querySelector('.sidebar-logo');
  if (logo) {
    logo.style.opacity = '0';
    logo.style.transform = 'translateX(-20px)';
    setTimeout(() => {
      logo.style.transition = 'all .5s ease';
      logo.style.opacity = '1';
      logo.style.transform = 'translateX(0)';
    }, 100);
  }
  document.querySelectorAll('.nav-item').forEach((item, i) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-14px)';
    setTimeout(() => {
      item.style.transition = 'all .35s ease';
      item.style.opacity = '1';
      item.style.transform = 'translateX(0)';
    }, 150 + i * 45);
  });
}

// ─── Hero Section Particles ───────────────────────
function initHeroParticles() {
  initParticles('hero-particles');
}

// ─── MCP Tool Reveal ──────────────────────────────
function initIBMToolsReveal() {
  const tools = document.querySelectorAll('.ibm-tool');
  tools.forEach((tool, i) => {
    tool.style.opacity = '0';
    tool.style.transform = 'translateX(-10px)';
    setTimeout(() => {
      tool.style.transition = 'all .35s ease';
      tool.style.opacity = '1';
      tool.style.transform = 'translateX(0)';
    }, 200 + i * 80);
  });
}

// ─── Activity Feed ────────────────────────────────
function initActivityFeed() {
  const items = document.querySelectorAll('.activity-item');
  items.forEach((item, i) => {
    item.style.opacity = '0';
    setTimeout(() => {
      item.style.transition = 'opacity .4s ease';
      item.style.opacity = '1';
    }, i * 110);
  });
}

// ─── Global Init ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initRipple();
  initSidebarEntrance();
});

// Exported hooks for page-specific usage
window.GramCareAnim = {
  staggerCards,
  animateProgressBars,
  animateCounter,
  typewriterEffect,
  initVitalsPulse,
  animateTriageCircle,
  initHeroParticles,
  initIBMToolsReveal,
  initActivityFeed,
  initParticles,
};
