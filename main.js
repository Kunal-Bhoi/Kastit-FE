// ─── Site settings ──────────────────────────────────────────────────────────
// Where early-access requests and the footer "Contact" link go.
// CHANGE THIS before going live.
const CONTACT_EMAIL = 'hello@example.com';

document.documentElement.classList.add('js');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ─── Navigation ─────────────────────────────────────────────────────────────
const nav = $('[data-nav]');
const toggle = $('[data-nav-toggle]');
const links = $('#nav-links');

const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

const setMenu = (open) => {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
  links.classList.toggle('is-open', open);
  nav.classList.toggle('is-open', open);
};
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

// ─── Scroll reveal (staggered within each group) ────────────────────────────
const revealItems = $$('[data-reveal]');
const groups = new Map();
revealItems.forEach((el) => {
  const parent = el.parentElement;
  const i = groups.get(parent) ?? 0;
  groups.set(parent, i + 1);
  el.style.setProperty('--d', `${Math.min(i, 8) * 0.07}s`);
});

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  revealItems.forEach((el) => io.observe(el));
}

// ─── Count-up numbers ───────────────────────────────────────────────────────
const counters = $$('[data-count]');
if (!reducedMotion && 'IntersectionObserver' in window) {
  const co = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      co.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.count);
      const start = performance.now();
      const dur = 1400;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => co.observe(el));
}

// ─── Pointer light on cards ─────────────────────────────────────────────────
$$('.card').forEach((card) => {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
});

// ─── Hero: the brief types itself and the ring follows ─────────────────────
const CUTS = { round: 'Round', oval: 'Oval', princess: 'Princess', emerald: 'Emerald' };
const METALS = { yellow18: '18K yellow gold', rose18: '18K rose gold', platinum: '950 platinum', gold22: '22K gold' };

const SEQUENCE = [
  { cut: 'round', metal: 'yellow18', size: 14, brief: 'A round solitaire, about 1 carat, in 18K yellow gold. Comfort fit, size 14.' },
  { cut: 'oval', metal: 'rose18', size: 12, brief: 'Oval centre stone on a slim 18K rose gold band, size 12.' },
  { cut: 'emerald', metal: 'platinum', size: 16, brief: 'Emerald cut solitaire in 950 platinum, size 16.' },
  { cut: 'princess', metal: 'gold22', size: 13, brief: 'Princess cut stone, 22K gold, comfort fit, size 13.' },
];

const textEl = $('[data-brief-text]');
const statusEl = $('[data-brief-status]');
const chipsEl = $('[data-brief-chips]');
const stage = $('[data-stage]');

const state = { cut: 'round', metal: 'yellow18' };
let seqIndex = 0;
let autoplay = !reducedMotion;
let runId = 0;
let heroVisible = true;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function setStatus(text, done = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-done', done);
}

function renderChips(item) {
  chipsEl.innerHTML = '';
  const chips = [
    ['Style', 'Solitaire'],
    ['Cut', CUTS[item.cut]],
    ['Metal', METALS[item.metal].replace(' gold', '')],
    ['Size', String(item.size)],
  ];
  chips.forEach(([k, v], i) => {
    const li = document.createElement('li');
    li.style.animationDelay = `${i * 0.09}s`;
    li.innerHTML = `<small>${k}</small>${v}`;
    chipsEl.appendChild(li);
  });
}

function syncControls() {
  $$('[data-control]').forEach((group) => {
    const key = group.dataset.control;
    $$('button', group).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.value === state[key])));
  });
}

function applyRing(item) {
  state.cut = item.cut;
  state.metal = item.metal;
  syncControls();
  window.dispatchEvent(new CustomEvent('kanvas:ring', { detail: { ...state } }));
}

async function typeBrief(item, { fast = false } = {}) {
  const id = ++runId;
  setStatus('Reading…');
  chipsEl.innerHTML = '';

  if (reducedMotion) {
    textEl.textContent = item.brief;
  } else {
    // erase the previous brief quickly, then type the new one
    while (textEl.textContent.length && id === runId) {
      textEl.textContent = textEl.textContent.slice(0, -3);
      await wait(8);
    }
    for (let i = 1; i <= item.brief.length && id === runId; i++) {
      textEl.textContent = item.brief.slice(0, i);
      await wait(fast ? 12 : 24 + Math.random() * 30);
    }
  }
  if (id !== runId) return false;

  setStatus('Building…');
  renderChips(item);
  await wait(reducedMotion ? 0 : 450);
  if (id !== runId) return false;
  applyRing(item);
  setStatus('Ready · checks passed', true);
  return true;
}

async function loop() {
  while (autoplay) {
    if (!heroVisible || document.hidden) { await wait(500); continue; }
    const ok = await typeBrief(SEQUENCE[seqIndex]);
    if (!ok || !autoplay) return;
    seqIndex = (seqIndex + 1) % SEQUENCE.length;
    await wait(3600);
  }
}

// a visitor's own choice wins over the autoplay
$$('[data-control]').forEach((group) => {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    autoplay = false;
    const next = { ...state, [group.dataset.control]: btn.dataset.value };
    const cutName = CUTS[next.cut];
    typeBrief({
      ...next,
      size: 14,
      brief: `${cutName} solitaire in ${METALS[next.metal]}, size 14.`,
    }, { fast: true });
  });
});

if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; }, { threshold: 0.05 })
    .observe($('.hero'));
}

// first paint: show the opening brief's chips straight away
renderChips(SEQUENCE[0]);
setStatus('Ready · checks passed', true);
if (autoplay) {
  seqIndex = 1;
  wait(3200).then(loop);
}

// ─── 3D ring: loaded after the page is interactive ─────────────────────────
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

function loadRing() {
  if (!hasWebGL()) { stage.classList.add('no-webgl'); return; }
  import('./ring.js')
    .then(({ initRing }) => initRing($('[data-ring-canvas]'), { ...state }, {
      reducedMotion,
      onReady: () => stage.classList.add('is-live'),
    }))
    .catch((err) => {
      console.warn('3D ring unavailable:', err);
      stage.classList.add('no-webgl');
    });
}

if (document.readyState === 'complete') loadRing();
else window.addEventListener('load', loadRing, { once: true });

// ─── Early-access form → opens the visitor's email app ─────────────────────
// A static site has no server to receive the form. This composes an email
// instead. To collect submissions directly, point the form at a form service
// (Formspree, Tally, Basin…) — see README.
$$('[data-contact]').forEach((a) => { a.href = `mailto:${CONTACT_EMAIL}`; });

const form = $('[data-access-form]');
const formStatus = $('[data-form-status]');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  let firstBad = null;
  ['name', 'company', 'email'].forEach((field) => {
    const input = form.elements[field];
    const ok = input.value.trim() && (field !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim()));
    input.setAttribute('aria-invalid', String(!ok));
    if (!ok && !firstBad) firstBad = input;
  });
  if (firstBad) {
    formStatus.textContent = 'Please add your name, company and a valid email.';
    formStatus.className = 'form__status is-error';
    firstBad.focus();
    return;
  }

  const subject = `Kanvas early access: ${data.get('company')}`;
  const body = [
    `Name: ${data.get('name')}`,
    `Company: ${data.get('company')}`,
    `Email: ${data.get('email')}`,
    `Phone: ${data.get('phone') || '-'}`,
    `Role: ${data.get('role')}`,
    '',
    `${data.get('message') || ''}`,
  ].join('\n');

  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  formStatus.textContent = `Your email app should open with everything filled in. If it doesn’t, write to us at ${CONTACT_EMAIL}.`;
  formStatus.className = 'form__status is-ok';
});

form.addEventListener('input', (e) => {
  if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) e.target.removeAttribute('aria-invalid');
});

// ─── Footer year ────────────────────────────────────────────────────────────
$$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
