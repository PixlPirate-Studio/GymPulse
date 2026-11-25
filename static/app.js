/* GymPulse front end. Plain JavaScript, no build step, no outside libraries. */
(function () {
'use strict';

// ---------- helpers ----------
const $ = (s, r) => (r || document).querySelector(s);
const pad = (n) => (n < 10 ? '0' : '') + n;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const shiftDate = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const clock = (sec) => { sec = Math.max(0, Math.round(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); };
const hms = (sec) => { sec = Math.max(0, Math.floor(sec)); return pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor(sec / 60) % 60) + ':' + pad(sec % 60); };
const mmss = (sec) => Math.floor(sec / 60) + ':' + pad(Math.round(sec) % 60);
const fmtDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const r0 = (n) => Math.round(n);
const ftIn = (inches) => inches ? Math.floor(inches / 12) + "'" + Math.round(inches % 12) + '"' : '';
const ago = (t) => { const s = Date.now() / 1000 - t; if (s < 90) return 'just now'; if (s < 3600) return r0(s / 60) + ' min ago'; if (s < 86400) return r0(s / 3600) + ' hours ago'; if (s < 172800) return 'Yesterday'; return r0(s / 86400) + ' days ago'; };

const P = {
  clock: 'M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z',
  food: 'M3 11h18a9 9 0 01-18 0zM8 4v3M12 3v4M16 4v3',
  progress: 'M3 17l6-6 4 4 8-8M14 7h7v7',
  friends: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  body: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  history: 'M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  check: 'M5 13l4 4L19 7',
  back: 'M15 19l-7-7 7-7',
  next: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  speaker: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  gear: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  barcode: 'M4 5v14M8 5v14M11 5v14M15 5v14M18 5v14M21 5v14',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 118 0v4',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  tick: 'M5 13l4 4L19 7',
  chev: 'M15 19l-7-7 7-7',
  dumb: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11',
  sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
};
const I = (n, extra) => '<svg class="ic ' + (extra || '') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + P[n] + '"/></svg>';
const IF = (d) => '<svg class="ic fill" viewBox="0 0 24 24" aria-hidden="true"><path d="' + d + '"/></svg>';
const PLAY = 'M8 5v14l11-7z', PAUSE = 'M6 4h4v16H6V4zm8 0h4v16h-4V4z';
const HEART = 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6C19 16.5 12 21 12 21z';
const FLAME = 'M12 2c1 4-3 5-3 9a3 3 0 006 0c0-1-.3-1.8-1-2.7 3 1.2 5 4 5 7.2a7 7 0 11-14 0c0-5 4-6.5 7-13.5z';

const S = { me: null, tab: 'today', foodDate: todayStr(), friendView: 'board', histMonth: todayStr().slice(0, 7), profile: null, stats: null, session: null, exercises: [], routine: [], focus: null, plans: [], plan: (function () { try { return localStorage.getItem('gp_plan') || null; } catch (e) { return null; } })(), pushOn: false, recipeFilter: 'all', openMeal: null, tr: { level: 0, minutes: 30 }, pageFn: null, doc: null, offline: false, notes: 0 };
const ext = (n, ...a) => ((window.GPX && window.GPX[n]) ? window.GPX[n](...a) : '');
let timer = null;
try { timer = JSON.parse(localStorage.getItem('gp_timer') || 'null'); } catch (e) { timer = null; }
let tickHandle = null;

const CACHE_PFX = 'gp_c:', OUT_KEY = 'gp_out', DOC_KEY = 'gp_doc';
const noCache = (p) => /\/foods\/|\/photos|\/timer|\/session\/active|\/notifications|\/openapi/.test(p);
function cacheGet(p) { try { return JSON.parse(localStorage.getItem(CACHE_PFX + p)); } catch (e) { return null; } }
function clearCache() { try { Object.keys(localStorage).filter((k) => k.indexOf(CACHE_PFX) === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) {} }
function cachePut(p, d) { try { localStorage.setItem(CACHE_PFX + p, JSON.stringify(d)); } catch (e) { clearCache(); } }
const QUEUEABLE = [/^\/api\/weight$/, /^\/api\/water$/, /^\/api\/measurements$/, /^\/api\/diary$/, /^\/api\/session\/\d+$/];
const outbox = () => { try { return JSON.parse(localStorage.getItem(OUT_KEY) || '[]'); } catch (e) { return []; } };
const outSave = (q) => { try { localStorage.setItem(OUT_KEY, JSON.stringify(q)); } catch (e) {} paintBanner(); };
const uid8 = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

async function api(method, path, body, opts) {
  opts = opts || {};
  const opt = { method, headers: { 'X-GymPulse': '1' }, credentials: 'same-origin' };
  if (opts.key) opt.headers['Idempotency-Key'] = opts.key;
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, opt); } catch (e) {
    S.offline = true; paintBanner();
    if (method === 'GET') { const c = cacheGet(path); if (c) return c; }
    else if (!opts.noqueue && QUEUEABLE.some((r) => r.test(path))) {
      const q = outbox(); q.push({ method, path, body, key: uid8() }); outSave(q);
      toast('Saved on this phone. It will sync when you are back online.');
      return { ok: true, queued: true };
    }
    if (!opts.quiet) toast("Can't reach the server. Check your connection.");
    const err = new Error('offline'); err.offline = true; throw err;
  }
  if (S.offline) { S.offline = false; paintBanner(); flushOutbox(); }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && S.me && !opts.noauth) { S.me = null; boot(); throw new Error('signed out'); }
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong.'); e.userMessage = data.error || 'Something went wrong.'; e.status = res.status; throw e; }
  if (method === 'GET' && !noCache(path)) cachePut(path, data);
  return data;
}
const GET = (p, o) => api('GET', p, undefined, o);
const POST = (p, b, o) => api('POST', p, b || {}, o);
const PUT = (p, b, o) => api('PUT', p, b || {}, o);
const DEL = (p, o) => api('DELETE', p, undefined, o);

let flushing = false;
async function flushOutbox() {
  if (flushing) return; flushing = true;
  try {
    let q = outbox();
    while (q.length) {
      const it = q[0];
      try { await api(it.method, it.path, it.method === 'DELETE' ? undefined : it.body, { key: it.key, noqueue: true, quiet: true }); }
      catch (e) { if (e.offline) break; /* a real error from the server: drop that item */ }
      q = outbox().slice(1); outSave(q);
    }
  } finally { flushing = false; }
  if (!outbox().length && !S.offline && S.tab === 'today' && !S.pageFn) { /* quiet */ }
}
function paintBanner() {
  let b = $('#offbar');
  const n = outbox().length + (S.doc && S.doc.dirty ? 1 : 0);
  document.body.classList.toggle('hasbar', S.offline || n > 0);
  if (!S.offline && !n) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'offbar'; b.className = 'offbar'; document.body.appendChild(b); }
  b.textContent = S.offline ? "You're offline. Everything is saved on this phone" + (n ? ' (' + n + ' waiting to sync).' : '.') : 'Syncing your changes...';
}
window.addEventListener('online', () => { S.offline = false; paintBanner(); flushOutbox(); syncNow(); });
setInterval(() => { if (outbox().length || (S.doc && S.doc.dirty)) { flushOutbox(); syncNow(); } }, 20000);

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
const fail = (e) => { if (e && e.userMessage) toast(e.userMessage); };
const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

function sheet(html) {
  closeSheet();
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'sheet';
  const hasForm = /<input|<textarea|<select/.test(html), own = /data-a="scan-close"/.test(html);
  m.innerHTML = '<div class="sheet">' + html + (own ? '' : '<button class="btn alt block" data-a="close-sheet" style="margin-top:12px">' + (hasForm ? 'Cancel' : 'Close') + '</button>') + '</div>';
  m.addEventListener('click', (e) => { if (e.target === m) closeSheet(); });
  document.body.appendChild(m);
}
function closeSheet() { const m = $('#sheet'); if (m) m.remove(); if (window.GPX && window.GPX.sheetClosed) window.GPX.sheetClosed(); }

// full pages that slide over the tab content (the tab bar stays visible)
function openPage(fn, tabHighlight) {
  S.pageFn = fn;
  if (tabHighlight) highlight(tabHighlight);
  return fn();
}
function setPage(html) {
  let p = $('#page');
  if (!p) { p = document.createElement('div'); p.id = 'page'; document.body.appendChild(p); }
  const keep = p.scrollTop;
  p.innerHTML = '<div class="in">' + html + '</div>';
  p.scrollTop = keep;
}
function closePage() { const p = $('#page'); if (p) p.remove(); S.pageFn = null; highlight(S.tab); }
const rerunPage = () => (S.pageFn ? S.pageFn() : go(S.tab));
const backBtn = () => '<button class="sq" data-a="close-page" aria-label="Back">' + I('back') + '</button>';

function isStandalone() { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
const avClass = (name) => 'a' + ((name.charCodeAt(0) + name.length) % 4);
const avatar = (name) => '<div class="av ' + avClass(name) + '">' + esc(name[0].toUpperCase()) + '</div>';

// ---------- boot / login ----------
async function boot() {
  $('#nav').hidden = true; closePage();
  let me;
  try { me = await GET('/api/me'); } catch (e) { $('#app').innerHTML = '<div class="center login"><p class="muted">Can\'t reach the server.</p><div class="spacer"></div><button class="btn" data-a="reload">Try again</button></div>'; return; }
  const invite = new URLSearchParams(location.search).get('invite');
  if (!me.needs_setup && !me.user && invite && window.GPX && window.GPX.invite) return window.GPX.invite(invite);
  if (me.needs_setup) return renderAuth(true);
  if (!me.user) return renderAuth(false);
  S.me = me.user; S.doc = loadDoc();
  buildNav();
  refreshPushState(); flushOutbox(); pollNotes(); paintBanner();
  if (S.doc && S.doc.dirty) syncSoon();
  go(S.tab);
}
function renderAuth(setup) {
  $('#nav').hidden = true;
  $('#app').innerHTML = '<div class="center login"><div class="logo">' + I('clock') + '</div><h1 class="title" style="font-size:28px">GymPulse</h1>' +
    '<p class="sub" style="font-size:14px;margin-top:6px">' + (setup ? 'Welcome! Create the first account. It will be the admin.' : 'Sign in to start your workout') + '</p>' +
    '<div class="card"><div class="field"><label>Username</label><input id="u" autocapitalize="none" autocomplete="username" autocorrect="off"></div>' +
    '<div class="field"><label>Password' + (setup ? ' (8+ characters)' : '') + '</label><input id="p" type="password" autocomplete="' + (setup ? 'new-password' : 'current-password') + '"></div>' +
    (setup ? '' : '<div class="row between" style="margin-bottom:14px"><label class="check"><input type="checkbox" id="keep" checked> Keep me signed in</label><a href="#" data-a="forgot" style="font-weight:700;font-size:14px;text-decoration:none">Forgot password?</a></div>') +
    '<div class="err" id="e"></div><button class="btn block" data-a="' + (setup ? 'setup' : 'login') + '">' + (setup ? 'Create admin account' : 'Sign in') + '</button></div>' +
    '<div class="foot">' + I('lock') + ' Self-hosted on your server. Your data stays home.</div></div>';
  const enter = (e) => { if (e.key === 'Enter') { const b = $('[data-a=setup],[data-a=login]'); if (b) b.click(); } };
  $('#u').addEventListener('keydown', enter); $('#p').addEventListener('keydown', enter);
}

// ---------- light / dark ----------
function curTheme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  document.body.classList.toggle('light-strip', t === 'light');
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'light' ? '#F4F5F1' : '#090D16';
  try { localStorage.setItem('gp_theme', t); } catch (e) {}
  document.querySelectorAll('.themebtn').forEach((b) => { b.outerHTML = themeBtn(); });
}
const themeBtn = () => '<button class="sq themebtn" data-a="theme" aria-label="' + (curTheme() === 'light' ? 'Switch to dark mode' : 'Switch to light mode') + '">' + I(curTheme() === 'light' ? 'moon' : 'sun') + '</button>';

// ---------- notifications ----------
const bell = () => '<button class="sq bellbtn" data-a="notes" aria-label="Notifications">' + I('bell') + (S.notes ? '<i class="cnt">' + (S.notes > 9 ? '9+' : S.notes) + '</i>' : '') + '</button>';
const tools = () => '<div class="hdr-right">' + themeBtn() + bell() + '</div>';
function paintBell() { document.querySelectorAll('.bellbtn').forEach((b) => { b.outerHTML = bell(); }); }
async function pollNotes() {
  if (!S.me || document.hidden) return;
  try {
    const r = await GET('/api/notifications', { quiet: true });
    S.notes = r.unread;
    let seen = null; try { seen = localStorage.getItem('gp_seen_note'); } catch (e) {}
    if (seen !== null) r.items.filter((n) => n.id > +seen && (n.kind === 'badge' || n.kind === 'nudge' || n.kind === 'challenge')).reverse().forEach((n) => toast(n.text));
    try { localStorage.setItem('gp_seen_note', String(r.items.length ? r.items[0].id : 0)); } catch (e) {}
    paintBell();
  } catch (e) {}
}
setInterval(pollNotes, 60000);

// ---------- navigation ----------
const TABS = [['today', 'clock', 'Today'], ['train', 'dumb', 'Train'], ['food', 'food', 'Food'], ['friends', 'friends', 'Friends'], ['me', 'body', 'Me']];
const ME_SUB = ['progress', 'body', 'history'];
function buildNav() {
  const n = $('#nav');
  n.innerHTML = '<div class="in">' + TABS.map((t) => '<button data-a="tab" data-t="' + t[0] + '" id="nav-' + t[0] + '">' + I(t[1]) + t[2] + '</button>').join('') + '</div>';
  n.hidden = false;
}
function highlight(tab) { TABS.forEach((t) => { const b = $('#nav-' + t[0]); if (b) b.classList.toggle('on', t[0] === tab || (t[0] === 'me' && ME_SUB.indexOf(tab) >= 0)); }); }
function go(tab) {
  const p = $('#page'); if (p) { p.remove(); S.pageFn = null; }
  S.tab = tab; highlight(tab);
  window.scrollTo(0, 0);
  const fn = { today: viewToday, train: viewTrain, food: viewFood, progress: viewProgress, friends: viewFriends, me: viewMe, body: viewBody, history: viewHistory }[tab];
  fn().then(() => ext('after', tab)).catch((e) => { if (e.message !== 'signed out') { $('#app').innerHTML = '<div class="card">Something went wrong loading this page. <button class="btn sm" data-a="reload">Reload</button></div>'; } });
}
function rerenderTrain() { const y = window.scrollY; viewTrain().then(() => window.scrollTo(0, y)).catch(() => {}); }
const setApp = (h) => { $('#app').innerHTML = h; };

// ---------- timers ----------
function saveTimer() { try { if (timer) localStorage.setItem('gp_timer', JSON.stringify(timer)); else localStorage.removeItem('gp_timer'); } catch (e) {} }
function restNote(seconds, label, endAt) {
  if (!(S.profile && S.profile.rest_note)) return null;
  let t = ''; try { t = new Date(endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) {}
  const len = seconds >= 60 ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + ' min' : seconds + ' sec';
  return { title: 'Back at ' + t, body: (label || 'Rest') + ' · ' + len };
}
function startTimer(seconds, label, opts) {
  opts = opts || {};
  timer = { endAt: Date.now() + seconds * 1000, total: seconds, label: label || 'Rest', exId: opts.exId || null, kind: opts.kind || 'rest', paused: false, alerted: false };
  saveTimer();
  POST('/api/timer', { seconds, title: (label || 'Rest') + ' is over', body: opts.kind === 'timed' ? 'Nice work. Tap to log it.' : opts.kind === 'quick' ? 'Your timer is done.' : 'Time to get going again.', start_note: restNote(seconds, label, timer.endAt) }).catch(() => {});
  ensureTick();
  const slot = $('#rest-slot'); if (slot) slot.innerHTML = timerPanel();
}
function stopTimer(cancelServer) {
  timer = null; saveTimer();
  if (cancelServer !== false) DEL('/api/timer').catch(() => {});
  const slot = $('#rest-slot'); if (slot) slot.innerHTML = '';
}
function adjustTimer(delta) {
  if (!timer) return;
  const left = Math.max(0, (timer.paused ? timer.leftMs : timer.endAt - Date.now()) / 1000) + delta;
  const secs = Math.max(5, left);
  if (timer.paused) { timer.leftMs = secs * 1000; saveTimer(); paintTimer(true); return; }
  startTimer(secs, timer.label, { exId: timer.exId, kind: timer.kind });
}
function pauseResume() {
  if (!timer) return;
  if (timer.paused) { timer.endAt = Date.now() + timer.leftMs; timer.paused = false; saveTimer(); POST('/api/timer', { seconds: Math.ceil(timer.leftMs / 1000), title: timer.label + ' is over', body: 'Time to get going again.' }).catch(() => {}); }
  else { timer.leftMs = Math.max(0, timer.endAt - Date.now()); timer.paused = true; saveTimer(); DEL('/api/timer').catch(() => {}); }
  paintTimer(true);
}
function ensureTick() { if (!tickHandle) tickHandle = setInterval(tick, 250); }
function beep() {
  try {
    const A = window.AudioContext || window.webkitAudioContext; const c = new A();
    [0, 0.25, 0.5].forEach((d) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.25, c.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d + 0.2); o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.22); });
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch (e) {}
}
const leftSec = () => (timer.paused ? timer.leftMs : timer.endAt - Date.now()) / 1000;
function timerPanel() {
  if (!timer) return '';
  const left = leftSec(), over = left <= 0 && !timer.paused;
  const label = timer.kind === 'rest' ? 'Rest timer' : esc(timer.label);
  return '<div class="rest' + (over ? ' over' : '') + '" id="rest"><div class="row between"><div><div class="eyebrow">' + label + '</div><div class="time" id="rest-time">' + (over ? 'GO!' : clock(Math.ceil(left))) + '</div></div>' +
    (over ? '' : '<div class="row gap6"><button class="adj" data-a="timer-adj" data-d="-15">-15s</button><button class="adj" data-a="timer-adj" data-d="15">+15s</button><button class="adj" data-a="timer-adj" data-d="60">+1m</button></div>') + '</div>' +
    '<div class="spacer" style="height:10px"></div>' +
    (over ? '<button class="btn block" data-a="timer-reset">Dismiss</button>' :
      '<div class="row gap8"><button class="btn amber" style="flex:1" data-a="timer-pause">' + IF(timer.paused ? PLAY : PAUSE) + (timer.paused ? 'Resume' : 'Pause') + '</button><button class="btn alt" data-a="timer-reset">Reset</button></div>') + '</div>' +
    '<div class="buzz" style="margin-top:12px">' + I('bell') + (S.pushOn ? 'Will buzz your phone and Apple Watch at 0:00' : 'Turn on alerts in Settings to get a buzz at 0:00') + '</div>';
}
function tick() {
  const ct = $('#sess-clock');
  if (ct && S.session) ct.textContent = hms(sessElapsed());
  if (timer) paintTimer(false);
}
function paintTimer(force) {
  const box = $('#rest-slot'); if (!timer || !box) return;
  const left = leftSec(), over = left <= 0 && !timer.paused;
  if (over && !timer.alerted) { timer.alerted = true; saveTimer(); beep(); box.innerHTML = timerPanel(); return; }
  const t = $('#rest-time');
  if (force || !t || over !== !!$('#rest.over')) { box.innerHTML = timerPanel(); return; }
  if (!timer.paused || force) t.textContent = clock(Math.ceil(Math.max(0, left)));
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
if (timer) ensureTick();

// session clock (with pause)
const sessKey = (id) => 'gp_sess_' + id;
function sessState() { try { return JSON.parse(localStorage.getItem(sessKey(S.session.id)) || '{}'); } catch (e) { return {}; } }
function sessSave(st) { try { localStorage.setItem(sessKey(S.session.id), JSON.stringify(st)); } catch (e) {} }
function sessPausedMs() { const st = sessState(); return (st.pausedMs || 0) + (st.pausedAt ? Date.now() - st.pausedAt : 0); }
function sessElapsed() { const st = sessState(); const end = st.pausedAt || Date.now(); return Math.max(0, (end - S.session.started_at * 1000 - (st.pausedMs || 0)) / 1000); }

// ---------- Today ----------
// The workout in progress lives on the phone and is sent to the server in the background.
// That is what lets it keep working with no signal at the gym.
function loadDoc() { try { const d = JSON.parse(localStorage.getItem(DOC_KEY) || 'null'); return d && S.me && d.uid === S.me.id ? d : null; } catch (e) { return null; } }
function persistDoc() { try { if (S.doc) localStorage.setItem(DOC_KEY, JSON.stringify(S.doc)); else localStorage.removeItem(DOC_KEY); } catch (e) {} }
function bindDoc() {
  const d = S.doc;
  if (d && !d.ended_at) { S.session = { id: d.cid, started_at: d.started_at, date: d.date, plan: d.plan }; S.exercises = d.exercises; }
  else { S.session = null; S.exercises = []; }
}
function saveDoc() { if (S.doc) S.doc.dirty = true; persistDoc(); paintBanner(); syncSoon(); }
let syncTimer = null, syncing = false;
function syncSoon() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 700); }
function docPayload() {
  const d = S.doc;
  return { cid: d.cid, session_id: d.session_id, plan: d.plan, date: d.date, started_at: d.started_at, ended_at: d.ended_at || null, paused_sec: d.paused_sec || 0,
    exercises: d.exercises.map((e) => ({ cid: e.cid, id: e.serverId, routine_id: e.routine_id, name: e.name, kind: e.kind, sets_total: e.sets_total, sets_done: e.sets_done, completed: !!e.completed, category: e.category, note: e.note, reps: e.reps, seconds: e.seconds, sets: (e.logs || []).map((l) => ({ set_no: l.set_no, weight_lb: l.weight_lb, reps: l.reps })) })) };
}
async function syncNow() {
  const d = S.doc;
  if (!d || syncing || !d.dirty) return;
  syncing = true; const mark = d.rev = (d.rev || 0) + 1;
  try {
    const r = await POST('/api/sync/workout', docPayload(), { quiet: true, noqueue: true });
    if (r.session && !d.session_id) d.session_id = r.session.id;
    if (d.rev === mark) d.dirty = false;
    if (d.ended_at && !d.dirty) {
      S.doc = null; persistDoc(); paintBanner();
      const x = r.extras || {};
      if (x.prs) toast('New personal best' + (x.prs > 1 ? 's' : '') + '! ' + x.prs + ' record' + (x.prs > 1 ? 's' : ''));
      pollNotes(true);
      if (S.tab === 'today' && !S.pageFn) go('today');
    } else persistDoc();
  } catch (e) { if (!e.offline && e.status === 400) { /* bad data: keep it, don't loop forever */ d.dirty = false; persistDoc(); } }
  finally { syncing = false; paintBanner(); }
}
function docFromServer(act) {
  const s = act.session, d = { uid: S.me.id, cid: s.cid || 's' + s.id, session_id: s.id, plan: s.plan, date: s.date, started_at: s.started_at, nextId: 1, exercises: [] };
  act.exercises.forEach((e) => { d.nextId = Math.max(d.nextId, e.id + 1); d.exercises.push({ id: e.id, serverId: e.id, cid: e.cid || 's' + e.id, routine_id: e.routine_id, name: e.name, kind: e.kind, sets_total: e.sets_total, sets_done: e.sets_done, completed: e.completed, category: e.category, note: e.note, reps: e.reps, seconds: e.seconds, logs: (e.logs || []).map((l) => ({ set_no: l.set_no, weight_lb: l.weight_lb, reps: l.reps })), last: e.last || null, best: 0 }); });
  return d;
}
async function loadToday() {
  if (!S.doc) S.doc = loadDoc();
  const calls = [GET('/api/profile'), GET('/api/routine'), GET('/api/progress?today=' + todayStr())];
  if (!S.doc) calls.push(GET('/api/session/active', { quiet: true }).catch(() => ({ session: null, exercises: [] })));
  const [prof, rt, prog, act] = await Promise.all(calls);
  S.profile = prof.profile; S.stats = prof.stats; S.routine = rt.routine; S.plans = rt.plans; S.prog = prog;
  if (!S.doc && act && act.session) { S.doc = docFromServer(act); persistDoc(); }
  bindDoc();
  if (S.doc && S.doc.dirty) syncSoon();
  if (S.plans.indexOf(S.plan) < 0) setPlan(S.plans[0]);
  await loadGuide();
}
const nrm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let GUIDE = null;
async function loadGuide() { if (GUIDE) return; try { GUIDE = (await GET('/api/exercise-guide', { quiet: true })).cards; } catch (e) {} }
function slugFor(name) {
  const n = nrm(name); if (!n || !GUIDE || !window.GPAnim) return null;
  let c = GUIDE.find((x) => n === nrm(x.name) || (x.aliases || []).some((a) => nrm(a) === n));
  if (!c) c = GUIDE.find((x) => [x.name].concat(x.aliases || []).some((a) => { a = nrm(a); return a.length > 4 && (n.indexOf(a) >= 0 || a.indexOf(n) >= 0); }));
  return c && window.GPAnim.has(c.slug) ? c.slug : null;
}
const thumbFor = (name) => { const sl = slugFor(name); return sl ? window.GPAnim.thumb(sl, { name, animate: false }) : '<div class="athumb"><span class="muted" style="font-size:22px">' + I('dumb') + '</span></div>'; };
const planMin = (list) => Math.round(list.reduce((a, r) => a + (r.kind === 'timed' ? (r.seconds || 300) : (r.sets_total || 3) * (45 + (r.seconds || 75))), 0) / 60);
const docEx = (id) => (S.doc ? S.doc.exercises.find((x) => x.id === +id) : null);
const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);
async function fetchLast() {
  const d = S.doc; if (!d) return;
  await Promise.all(d.exercises.filter((e) => e.kind === 'sets' && !e.last).map(async (e) => {
    try { const r = await GET('/api/exercise-history?name=' + encodeURIComponent(e.name), { quiet: true }); e.last = r.last; e.best = r.best_e1rm || 0; } catch (x) {}
  }));
  persistDoc(); if (S.tab === 'today' && !S.pageFn && S.doc === d && !d.ended_at && !(document.activeElement && document.activeElement.tagName === 'INPUT')) go('today');
}
const exSecs = (e) => ({ secs: e.seconds || (e.kind === 'timed' ? 300 : 75), note: e.note || '', cat: e.category || '' });
const exSub = (e) => e.kind === 'timed' ? mmss(e.seconds) + ' timer' : e.sets_total + ' sets' + (e.reps ? ' of ' + esc(e.reps) + ' reps' : '') + ' · rest ' + mmss(e.seconds);
const exPencil = (mode, id) => '<button class="sq" style="width:40px;height:40px" data-a="ex-edit" data-m="' + mode + '" data-id="' + id + '" aria-label="Edit exercise">' + I('edit') + '</button>';
const addButtons = (mode) => '<button class="btn dashed block" data-a="ex-add" data-m="' + mode + '">' + I('plus') + ' Add custom machine / timer</button><div style="height:8px"></div><button class="btn dashed block" data-a="quick-timer" style="min-height:48px">' + I('clock') + ' Quick countdown timer</button>';
const planChips = () => '<div class="chips" style="flex-wrap:wrap;overflow:visible">' + S.plans.map((p) => '<button data-a="plan-pick" data-p="' + esc(p) + '" class="' + (p === S.plan ? 'on' : '') + '">' + esc(p) + '</button>').join('') + '<button data-a="plan-new">+ New workout</button></div>';
function setPlan(p) { S.plan = p; try { localStorage.setItem('gp_plan', p); } catch (e) {} }
const streakPill = (n) => n > 0 ? '<span class="pill">' + IF(FLAME) + n + '-day streak</span>' : '<span></span>';
const startLink = () => '<a href="#" data-a="guide" style="display:flex;align-items:center;gap:6px;min-height:44px;font-size:13px;color:var(--cyan);font-weight:700;text-decoration:none">New here? Start here ' + I('next').replace('class="ic ', 'style="width:14px;height:14px;stroke-width:2.6" class="ic ') + '</a>';

const lbs = (w) => (w % 1 ? w.toFixed(1) : String(w));
function lastLine(e) {
  const l = e.last; if (!l || !l.sets || !l.sets.length) return '';
  return '<div class="lastt">Last time' + (l.date ? ' (' + fmtDate(l.date) + ')' : '') + ': ' + l.sets.map((x) => (x.weight_lb ? lbs(x.weight_lb) + ' lb' : 'body') + ' × ' + x.reps).join(' · ') + '</div>';
}
function setLogBlock(e) {
  const next = Math.min(e.sets_total, e.sets_done + 1), logs = e.logs || [];
  const prevLog = logs.find((l) => l.set_no === next) || logs.find((l) => l.set_no === e.sets_done) || {};
  const ls = (e.last && e.last.sets) || [], lastSet = ls.find((l) => l.set_no === next) || ls[ls.length - 1] || {};
  const w = prevLog.weight_lb != null ? prevLog.weight_lb : (lastSet.weight_lb || ''), r = prevLog.reps != null ? prevLog.reps : (lastSet.reps || '');
  let h = '<div class="logbox"><div class="eyebrow" style="font-size:10px">Set ' + next + ' · what did you lift?</div><div class="row gap8" style="margin-top:6px">' +
    '<div class="field" style="margin:0;flex:1"><label>Weight (lb)</label><input id="lw" class="inputmono" type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" value="' + esc(w === 0 ? '' : w) + '"></div>' +
    '<div class="field" style="margin:0;flex:1"><label>Reps</label><input id="lr" class="inputmono" type="number" inputmode="numeric" min="0" placeholder="0" value="' + esc(r === 0 ? '' : r) + '"></div></div>' + lastLine(e);
  if (logs.length) h += '<div class="loglist">' + logs.slice().sort((a, b) => a.set_no - b.set_no).map((l) => '<span class="logchip' + (l.pr ? ' pr' : '') + '">' + (l.pr ? '★ ' : '') + 'Set ' + l.set_no + ': ' + (l.weight_lb ? lbs(l.weight_lb) + ' lb × ' : '') + l.reps + '</span>').join('') + '</div>';
  return h + (slugFor(e.name) ? '' : '<button class="howto" data-a="howto" data-name="' + esc(e.name) + '">How to do this</button>') + '</div>';
}

async function viewToday() {
  await loadToday();
  const s = S.session, p = S.prog;
  let h = '';
  if (!s) {
    const list = S.routine.filter((r) => r.plan === S.plan);
    const [dy, wt] = await Promise.all([GET('/api/diary?date=' + todayStr(), { quiet: true }).catch(() => null), GET('/api/water?date=' + todayStr(), { quiet: true }).catch(() => null)]);
    const first = (S.me.display_name || S.me.username || '').split(' ')[0];
    h += '<div class="head"><div><h1 class="title">Hi, ' + esc(first) + '</h1><p class="sub">' + esc(motivation(p)) + '</p></div>' + tools() + '</div>';
    if (S.doc && S.doc.ended_at) h += '<div class="card hi tight small">Your last workout is saved on this phone and will upload as soon as you are online.</div>';
    if (isIOS() && !isStandalone()) h += '<div class="card hi tight"><b>Install GymPulse on your iPhone</b><div class="small muted" style="margin-top:4px">Tap the Share button in Safari, then "Add to Home Screen". It opens full screen and can buzz you when a rest is over.</div></div>';
    h += '<div id="rest-slot">' + (timer ? timerPanel() : '') + '</div>';
    if (list.length) {
      const gs = []; list.forEach((r) => { const sl = slugFor(r.name); if (sl) window.GPAnim.groups(sl).forEach((g) => { if (gs.indexOf(g) < 0) gs.push(g); }); });
      const gsorted = (window.GPAnim ? window.GPAnim.order : gs).filter((g) => gs.indexOf(g) >= 0);
      h += '<div class="hero"><div class="eyebrow">Today\'s workout</div><h2>' + esc(S.plan) + '</h2><div class="hs">' + list.length + ' exercises · about ' + planMin(list) + ' min</div>' +
        '<div class="hp">' + gsorted.map((g) => '<span>' + esc(g) + '</span>').join('') + '</div><button class="hbtn" data-a="start-workout">Start workout</button><button class="hlink" data-a="plan-open">See the exercises or change workout</button></div>';
    } else {
      h += '<div class="hero empty"><div class="eyebrow">Today\'s workout</div><h2>Pick a workout</h2><div class="hs muted">Tell us how long you have and we will plan it for you.</div><div style="height:14px"></div><button class="hbtn" data-a="tab" data-t="train">Plan my workout</button></div>';
    }
    const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], goal = p.workouts_per_week || 3;
    h += '<div class="card"><div class="row between" style="margin-bottom:12px"><b style="font-size:15px">This week</b><span class="small muted" style="font-weight:600">' + p.week.workouts + ' of ' + goal + (p.streak > 0 ? ' · ' + p.streak + '-day streak' : '') + '</span></div><div class="weekrow">' +
      p.week.days.map((d, i) => '<div class="wd"><b class="' + (d.worked ? 'on' : '') + (d.date === todayStr() ? ' today' : '') + '">' + (d.worked ? I('check') : '') + '</b>' + names[i] + '</div>').join('') + '</div></div>';
    h += '<div class="minis">';
    if (dy) { const left = dy.goals.calories - dy.totals.calories; h += '<div class="mini" data-a="tab" data-t="food" style="cursor:pointer"><div class="eyebrow" style="font-size:10px">Food</div><div class="n">' + r0(Math.abs(left)).toLocaleString() + ' <small>cal ' + (left < 0 ? 'over' : 'left') + '</small></div><div class="pb"><i style="width:' + Math.min(100, dy.totals.calories / dy.goals.calories * 100) + '%"></i></div></div>'; }
    if (wt) h += '<div class="mini"><div class="row between"><div class="eyebrow" style="font-size:10px">Water</div><button class="linkbtn" data-a="water-quick" style="font-weight:700">+8 oz</button></div><div class="n">' + r0(wt.oz) + ' <small>of ' + wt.goal_oz + ' oz</small></div><div class="pb c"><i style="width:' + Math.min(100, wt.oz / wt.goal_oz * 100) + '%"></i></div></div>';
    h += '</div><button class="btn dashed block" data-a="quick-timer" style="min-height:48px">' + I('clock') + ' Quick countdown timer</button>';
    setApp(h); ensureTick(); return;
  }

  const done = S.exercises.filter((e) => e.completed).length, total = S.exercises.length;
  const paused = !!sessState().pausedAt;
  const quick = !!(timer && timer.kind === 'quick');
  h += '<div class="sessbar"><div class="row between"><div><div class="eyebrow">Session time</div><div class="row gap8"><span class="clock" id="sess-clock">' + hms(sessElapsed()) + '</span>' +
    '<button class="btn alt sm" style="color:var(--lime);min-height:32px;padding:0 12px;font-size:12px" data-a="sess-pause">' + (paused ? 'Resume' : 'Pause') + '</button></div></div>' +
    '<div class="row gap8"><button class="sq" data-a="test-sound" aria-label="Test sound" style="color:var(--cyan)">' + I('speaker') + '</button><button class="btn alt" style="min-height:44px;padding:0 14px;font-size:13px" data-a="finish-workout">Finish</button></div></div>' +
    '<div style="margin-top:10px"><div class="row between small" style="margin-bottom:5px"><span class="muted" style="font-weight:500">Workout progress</span><span class="mono lime" style="font-weight:700">' + done + ' / ' + total + ' Completed</span></div><div class="bar8"><i style="width:' + (total ? done / total * 100 : 0) + '%"></i></div></div></div>';
  h += '<div class="row between">' + startLink() + streakPill(p.streak) + '</div><div class="spacer" style="height:6px"></div>';
  if (quick) h += '<div id="rest-slot" class="card hi" style="padding:12px">' + timerPanel() + '</div>';

  const cur = S.exercises.find((e) => e.id === S.focus && !e.completed) || S.exercises.find((e) => !e.completed);
  if (!cur) {
    h += '<div class="exc cur"><div style="font-size:18px;font-weight:800">That\'s everything. Great work!</div><div class="small muted">Tap Finish to save your workout, or add one more exercise below.</div>' + (quick ? '' : '<div id="rest-slot">' + (timer ? timerPanel() : '') + '</div>') + '<button class="btn block" data-a="finish-workout">Finish workout</button></div>';
  }
  S.exercises.forEach((e, i) => {
    const x = exSecs(e), isCur = cur && e.id === cur.id;
    if (isCur) {
      const running = !!timer && !quick;
      h += '<div class="exc cur"><div class="row gap12" style="align-items:flex-start"><button class="cbox' + (e.completed ? ' on' : '') + '" style="margin-top:2px" data-a="toggle-ex" data-id="' + e.id + '" aria-label="Mark done">' + (e.completed ? I('check') : '') + '</button><div class="grow" style="min-width:0">' +
        '<div class="row gap6"><span class="badge">#' + (i + 1) + (x.cat ? ' · ' + esc(x.cat) : '') + '</span>' + (running ? '<span class="badge cyan">Running</span>' : '') + '</div>' +
        '<h3 style="margin:5px 0 0;font-size:18px;font-weight:800;line-height:1.2">' + esc(e.name) + '</h3><p class="small soft" style="margin-top:3px;font-size:13px">' + exSub(e) + '</p>' + (x.note ? '<p class="small muted" style="margin-top:2px;font-size:12px">' + esc(x.note) + '</p>' : '') + '</div>' + exPencil('session', e.id) + '</div>';
      const csl = slugFor(e.name);
      if (csl) h += '<div class="cursfig">' + window.GPAnim.stage(csl, { name: e.name }) + '</div><button class="howlink" data-a="howto" data-name="' + esc(e.name) + '">How to do this ' + I('next').replace('class="ic ', 'style="width:14px;height:14px" class="ic ') + '</button>';
      if (e.kind === 'sets') {
        h += '<div class="setrow">';
        for (let n = 1; n <= e.sets_total; n++) h += '<button class="setbtn' + (n <= e.sets_done ? ' on' : '') + '" data-a="set" data-id="' + e.id + '" data-n="' + n + '" data-done="' + e.sets_done + '" data-secs="' + x.secs + '" data-name="' + esc(e.name) + '">' + (n <= e.sets_done ? I('check') : '<span class="o"></span>') + 'Set ' + n + '</button>';
        h += '</div>' + setLogBlock(e);
        h += (quick ? '' : '<div id="rest-slot">' + (timer ? timerPanel() : '') + '</div>');
        if (!timer || quick) h += '<div class="buzz" style="color:var(--muted)">' + I('bell') + 'Fill in what you lifted, then tap the set. Your ' + mmss(x.secs) + ' rest starts automatically.</div>';
      } else {
        h += (quick ? '' : '<div id="rest-slot">' + (timer && timer.exId === e.id ? timerPanel() : '') + '</div>');
        if (!(timer && timer.exId === e.id)) h += '<div class="row gap8"><button class="btn" style="flex:1;min-height:48px" data-a="timed-start" data-id="' + e.id + '" data-secs="' + x.secs + '" data-name="' + esc(e.name) + '">' + IF(PLAY) + 'Start ' + mmss(x.secs) + '</button></div>';
        else h += '<button class="btn alt block" data-a="timed-done" data-id="' + e.id + '" data-v="1">Mark done</button>';
      }
      h += '</div>';
    } else {
      h += '<div class="exc' + (e.completed ? ' done' : '') + '" data-a="focus" data-id="' + e.id + '" style="cursor:pointer"><div class="row gap12" style="min-width:0"><button class="cbox' + (e.completed ? ' on' : '') + '" data-a="toggle-ex" data-id="' + e.id + '" aria-label="Toggle done">' + (e.completed ? I('check') : '') + '</button>' + thumbFor(e.name) + '<div style="min-width:0"><div class="eyebrow" style="font-size:10px">#' + (i + 1) + (x.cat ? ' · ' + esc(x.cat) : '') + '</div>' +
        '<div style="font-size:16px;font-weight:800">' + esc(e.name) + '</div><div class="small muted">' + (e.completed ? 'done · ' : '') + exSub(e) + '</div></div></div>' +
        '<div class="row gap6">' + (e.kind === 'timed' && !e.completed ? '<button class="btn sm" data-a="timed-start" data-id="' + e.id + '" data-secs="' + x.secs + '" data-name="' + esc(e.name) + '">' + IF(PLAY) + 'Start</button>' : '') + exPencil('session', e.id) + '</div></div>';
    }
  });
  h += addButtons('session') + '<div class="spacer"></div><button class="btn danger block" data-a="discard-workout" style="min-height:44px;font-size:14px">Discard this workout</button>';
  setApp(h); ensureTick();
}

// ---------- custom exercises (add / edit) ----------
let exCtx = null;
function openExForm(mode, id) {
  let ex = null;
  if (id) ex = (mode === 'plan' ? S.routine : S.exercises).find((x) => x.id === +id);
  exCtx = { mode, id: ex ? ex.id : null, routineId: ex ? ex.routine_id : null,
    d: ex ? { name: ex.name, category: ex.category || '', kind: ex.kind, sets: ex.sets_total || 3, reps: ex.reps || '', secs: ex.seconds, note: ex.note || '' }
      : { name: '', category: '', kind: 'sets', sets: 3, reps: '10-12', secs: 75, note: '' } };
  renderExForm();
}
function readExDraft() {
  if (!$('#ex-name')) return;
  const d = exCtx.d;
  d.name = val('ex-name'); d.category = val('ex-cat'); d.note = val('ex-note');
  if (d.kind === 'sets') { d.sets = parseInt(val('ex-sets'), 10) || 1; d.reps = val('ex-reps'); }
  d.secs = (parseInt(val('ex-m'), 10) || 0) * 60 + (parseInt(val('ex-s'), 10) || 0);
}
function renderExForm() {
  const d = exCtx.d, timed = d.kind === 'timed', edit = !!exCtx.id;
  const chips = timed ? [[60, '1 min'], [300, '5 min'], [600, '10 min'], [900, '15 min'], [1200, '20 min'], [1800, '30 min'], [2700, '45 min'], [3600, '60 min']] : [[30, '0:30'], [45, '0:45'], [60, '1:00'], [75, '1:15'], [90, '1:30'], [120, '2:00'], [180, '3:00']];
  const title = edit ? 'Edit exercise' : exCtx.mode === 'plan' ? 'Add to ' + esc(S.plan) : 'Add to this workout';
  sheet('<h2 class="title" style="font-size:22px">' + title + '</h2><p class="sub" style="margin-bottom:14px">Any machine, exercise or timer you like.</p>' +
    '<div class="field"><label>Name</label><input id="ex-name" placeholder="e.g. Leg Curl Machine, Treadmill, Plank" value="' + esc(d.name) + '"></div>' +
    '<div class="field"><label>Type</label><div class="seg"><button data-a="ex-kind" data-k="sets" class="' + (timed ? '' : 'on') + '">Sets &amp; reps</button><button data-a="ex-kind" data-k="timed" class="' + (timed ? 'on' : '') + '">Timed</button></div></div>' +
    (timed ? '' : '<div class="two"><div class="field"><label>Sets</label><input id="ex-sets" class="inputmono" type="number" inputmode="numeric" min="1" max="20" value="' + esc(d.sets) + '"></div><div class="field"><label>Reps (optional)</label><input id="ex-reps" class="inputmono" placeholder="10-12" value="' + esc(d.reps) + '"></div></div>') +
    '<div class="field"><label>' + (timed ? 'Timer length' : 'Rest between sets') + '</label><div class="row gap8"><input id="ex-m" class="inputmono" type="number" inputmode="numeric" min="0" max="180" value="' + Math.floor(d.secs / 60) + '"><span class="muted small">min</span><input id="ex-s" class="inputmono" type="number" inputmode="numeric" min="0" max="59" value="' + (d.secs % 60) + '"><span class="muted small">sec</span></div>' +
    '<div class="chips" style="margin:10px 0 0;flex-wrap:wrap;overflow:visible">' + chips.map((c) => '<button data-a="ex-chip" data-t="' + c[0] + '" style="min-height:36px;padding:0 14px;font-size:13px" class="' + (d.secs === c[0] ? 'on' : '') + '">' + c[1] + '</button>').join('') + '</div>' +
    '<div class="small muted" style="margin-top:6px;font-size:12px">' + (timed ? 'Counts down when you tap Start. Buzzes your phone when it\'s done.' : 'Your rest countdown starts when you finish each set.') + '</div></div>' +
    '<div class="field"><label>Category (optional)</label><input id="ex-cat" placeholder="e.g. Legs, Cardio, Core" value="' + esc(d.category) + '"></div>' +
    '<div class="field"><label>Note (optional)</label><input id="ex-note" placeholder="A reminder to yourself" value="' + esc(d.note) + '"></div>' +
    (exCtx.mode === 'session' && (!edit || exCtx.routineId) ? '<label class="check" style="margin-bottom:14px"><input type="checkbox" id="ex-save"> ' + (edit ? 'Also update it in my saved workout' : 'Also save it to my ' + esc(S.plan) + ' workout') + '</label>' : '') +
    '<button class="btn block" data-a="ex-save">' + (edit ? 'Save changes' : 'Add exercise') + '</button>' +
    (edit ? '<div class="spacer" style="height:8px"></div><button class="btn danger block" data-a="ex-delete">' + (exCtx.mode === 'plan' ? 'Delete exercise' : 'Remove from this workout') + '</button>' : ''));
}
function refreshAfterEx() { if (S.pageFn) S.pageFn(); else go('today'); }
function quickTimerSheet() {
  sheet('<h2 class="title" style="font-size:22px">Quick countdown</h2><p class="sub" style="margin-bottom:14px">A timer for anything: a plank, a stretch, an extra rest.</p>' +
    '<div class="chips" style="flex-wrap:wrap;overflow:visible">' + [[30, '0:30'], [60, '1:00'], [90, '1:30'], [120, '2:00'], [180, '3:00'], [300, '5:00'], [600, '10:00'], [900, '15:00']].map((c) => '<button data-a="qt-go" data-s="' + c[0] + '">' + c[1] + '</button>').join('') + '</div>' +
    '<div class="flabel">Or set your own</div><div class="row gap8" style="margin-bottom:14px"><input id="qt-m" class="inputmono" type="number" inputmode="numeric" placeholder="0" value="1"><span class="muted small">min</span><input id="qt-s" class="inputmono" type="number" inputmode="numeric" placeholder="0" value="0"><span class="muted small">sec</span></div>' +
    '<button class="btn block" data-a="qt-custom">Start timer</button>');
}
function newPlanSheet(copy) {
  sheet('<h2 class="title" style="font-size:22px">New workout</h2><p class="sub" style="margin-bottom:14px">Like Leg Day, Cardio, or Quick 20.</p><div class="field"><label>Name</label><input id="pn-name" placeholder="e.g. Leg Day"></div>' +
    '<label class="check" style="margin-bottom:14px"><input type="checkbox" id="pn-copy"' + (copy ? ' checked' : '') + '> Start with a copy of "' + esc(S.plan) + '"</label><button class="btn block" data-a="plan-create">Create workout</button>');
}

function motivation(p) {
  const w = p.week.workouts, goal = p.workouts_per_week || 3;
  if (p.streak >= 3) return p.streak + ' days in a row. Look at you go!';
  if (w >= goal) return 'You hit your weekly goal. Awesome work!';
  if (w > 0) return w + ' of ' + goal + ' workouts done this week. ' + (goal - w) + ' to go.';
  return 'A short workout still counts. Let\'s get your first one in this week.';
}

// ---------- Train (pick level + length) ----------
const LVL_TXT = [['Just starting', 'Mostly machines, light weight and extra rest. 2 sets each.'], ['Getting comfortable', 'Machines and free weights. 3 sets, a little less rest.'], ['Ready for more', 'More free weights and bodyweight moves. Shorter rests.']];
const exMeta = (e) => e.kind === 'timed' ? mmss(e.seconds) + ' timer' : e.sets_total + ' sets of ' + esc(e.reps);
async function viewTrain() {
  await loadToday();
  const t = S.tr;
  const pv = await GET('/api/programs/preview?level=' + t.level + '&minutes=' + t.minutes);
  let h = '<div class="head"><div><h1 class="title">Train</h1><p class="sub">Pick your level and how long you have.</p></div>' + tools() + '</div>';
  if (S.session) h += '<div class="card hi tight"><div class="row between"><div><b>Workout in progress</b><div class="small muted">' + esc(S.session.plan || '') + '</div></div><button class="btn sm" data-a="tab" data-t="today">Resume</button></div></div>';
  h += '<div class="eyebrow" style="margin:6px 0 10px">1 · Your level</div>';
  LVL_TXT.forEach((l, i) => { h += '<button class="lvl' + (t.level === i ? ' on' : '') + '" data-a="train-level" data-v="' + i + '"><span class="rd">' + (t.level === i ? I('check') : '') + '</span><span><b>' + l[0] + '</b><span class="d">' + l[1] + '</span></span></button>'; });
  h += '<div class="eyebrow" style="margin:16px 0 10px">2 · How long at the gym?</div><div class="lens">' + [20, 30, 45, 60].map((m) => '<button class="' + (t.minutes === m ? 'on' : '') + '" data-a="train-len" data-v="' + m + '">' + m + '<small>min</small></button>').join('') + '</div>';
  h += '<div class="card"><div class="sumrow"><div><b>' + pv.count + '</b><span>exercises</span></div><div><b>~' + pv.est_min + '</b><span>minutes</span></div><div><b>' + pv.sets + '</b><span>sets each</span></div></div><div class="cov">' + pv.groups.map((g) => '<span>' + esc(g) + '</span>').join('') + '</div></div>';
  h += '<div class="eyebrow" style="margin:6px 0 10px">Your plan</div>';
  pv.exercises.forEach((e) => {
    const sl = e.slug && window.GPAnim && window.GPAnim.has(e.slug) ? e.slug : null, gs = sl ? window.GPAnim.groups(sl) : [];
    h += '<div class="xrow" data-a="lib-open" data-slug="' + e.slug + '">' + (sl ? window.GPAnim.thumb(sl, { name: e.name, animate: false }) : '<div class="athumb"></div>') + '<div class="grow" style="min-width:0"><b>' + esc(e.name) + '</b><div class="xm">' + exMeta(e) + '</div>' + (gs.length ? '<div class="xf">' + esc(gs.join(' · ')) + '</div>' : '') + '</div>' + I('next', 'go') + '</div>';
  });
  h += '<p class="small muted" style="font-size:12px;line-height:1.5;margin:4px 0 12px">Time is an estimate. Rest times and sets are simple beginner picks, not medical advice. Start light and stop if anything hurts.</p>';
  h += '<button class="btn block" data-a="train-build" style="min-height:56px;font-size:16px">Use this workout</button>';
  const mine = S.plans.map((n) => ({ n, list: S.routine.filter((r) => r.plan === n) }));
  h += '<div class="eyebrow" style="margin:22px 0 10px">My workouts</div>' + mine.map((m) => '<div class="card tight"><div class="row between gap8"><div style="min-width:0"><b>' + esc(m.n) + '</b><div class="small muted">' + m.list.length + ' exercises · about ' + planMin(m.list) + ' min</div></div><div class="row gap6"><button class="btn alt sm" data-a="plan-edit" data-p="' + esc(m.n) + '">Edit</button><button class="btn sm" data-a="plan-start" data-p="' + esc(m.n) + '"' + (m.list.length && !S.session ? '' : ' disabled') + '>Start</button></div></div></div>').join('');
  h += '<button class="btn alt block" data-a="lib" style="margin-top:6px">Browse all exercises</button>';
  setApp(h);
}

async function viewMe() {
  const [prof, prog] = await Promise.all([GET('/api/profile'), GET('/api/progress?today=' + todayStr())]);
  S.profile = prof.profile; S.stats = prof.stats;
  const row = (ic, t, sub, a, extra) => '<button class="xrow" data-a="' + a + '"' + (extra || '') + '><div class="athumb" style="width:44px;height:44px;border-radius:12px;color:var(--lime)">' + I(ic) + '</div><div class="grow" style="min-width:0"><b>' + t + '</b><div class="xm">' + sub + '</div></div>' + I('next', 'go') + '</button>';
  let h = '<div class="head"><div class="row gap12">' + avatar(S.me.name) + '<div><h1 class="title" style="font-size:24px">' + esc(S.me.name) + '</h1><p class="sub">' + (S.me.role === 'admin' ? 'Admin · ' : '') + 'Login: ' + esc(S.me.username) + '</p></div></div>' + tools() + '</div>';
  h += '<div class="tiles"><div class="tile"><div class="n amber">' + prog.streak + '</div><div class="t">day streak</div></div><div class="tile"><div class="n lime">' + prog.week.workouts + '/' + (prog.workouts_per_week || 3) + '</div><div class="t">this week</div></div><div class="tile"><div class="n cyan">' + prog.total_sessions + '</div><div class="t">sessions</div></div></div>';
  h += row('progress', 'Progress', 'Weight chart and weekly goals', 'tab" data-t="progress') + row('body', 'Body &amp; goals', 'Height, weight and your daily calories', 'tab" data-t="body') + row('history', 'History', 'Past workouts on a calendar', 'tab" data-t="history');
  h += '<div class="eyebrow" style="margin:16px 0 10px">Workouts</div>' + row('edit', 'My workouts', 'Rename, reorder or edit exercises', 'routine') + row('dumb', 'Exercise library', 'Animated how-to for every move', 'lib') + row('clock', 'Start here', 'Gym words and how hard it should feel', 'guide');
  h += '<div class="eyebrow" style="margin:16px 0 10px">App</div>' + row('gear', 'Settings', 'Alerts, reminders, password' + (S.me.role === 'admin' ? ', users' : ''), 'settings');
  setApp(h);
}

// ---------- Progress ----------
function weightChart(ws, healthyMax, goal) {
  if (ws.length < 2) return '<p class="muted small" style="margin-top:10px">Log your weight a few times on the Body tab and your chart will show up here.</p>';
  const W = 328, H = 150, L = 34, R = 8, T = 10, B = 14;
  let vals = ws.map((x) => x.weight_lb); if (healthyMax) vals.push(healthyMax); if (goal) vals.push(goal);
  const lo = Math.floor((Math.min.apply(null, vals) - 4) / 10) * 10, hi = Math.ceil((Math.max.apply(null, vals) + 4) / 10) * 10;
  const x = (i) => L + (W - L - R) * (i / (ws.length - 1)); const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const pts = ws.map((p, i) => x(i).toFixed(1) + ',' + y(p.weight_lb).toFixed(1)).join(' ');
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Weight over time" style="margin-top:10px">';
  for (let v = lo; v <= hi; v += 10) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" style="stroke:var(--border)"/><text x="2" y="' + (y(v) + 4) + '" style="fill:var(--muted)" font-size="11" font-family="JetBrains Mono,monospace">' + v + '</text>';
  if (healthyMax) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(healthyMax) + '" y2="' + y(healthyMax) + '" style="stroke:var(--amber)" stroke-dasharray="5 4"/><text x="' + (W - R) + '" y="' + (y(healthyMax) - 6) + '" style="fill:var(--amber)" font-size="11" font-weight="600" text-anchor="end">Healthy range tops out at ' + r0(healthyMax) + '</text>';
  s += '<polyline fill="none" style="stroke:var(--acc)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="' + pts + '"/>';
  s += '<circle cx="' + x(ws.length - 1) + '" cy="' + y(ws[ws.length - 1].weight_lb) + '" r="5" style="fill:var(--acc)"/></svg>';
  return s;
}
function journeyMessage(prog) {
  const ws = prog.weights, st = prog.stats;
  if (!ws.length) return ['Let\'s get started.', 'Log your weight on the Body tab and we\'ll track your progress toward a healthy range.'];
  const target = prog.goal_weight_lb || st.healthy_max;
  if (!target) return ['Add your height.', 'Put your height and goal on the Body tab and we\'ll show how far along you are.'];
  const start = ws[0].weight_lb, cur = ws[ws.length - 1].weight_lb, dir = target < start ? 1 : -1;
  const total = Math.abs(start - target), moved = Math.max(0, (start - cur) * dir), remaining = Math.max(0, (cur - target) * dir);
  const label = prog.goal_weight_lb ? 'your goal' : 'the top of your healthy range';
  if (remaining <= 0) return ['You\'re there!', 'You\'ve reached ' + label + '. Keep it steady and keep showing up.'];
  const days = (new Date(ws[ws.length - 1].date) - new Date(ws[0].date)) / 86400000;
  const pace = days >= 14 && moved > 0 ? moved / (days / 7) : 1;
  const weeks = Math.max(1, Math.ceil(remaining / Math.max(0.25, pace)));
  const pct = total ? Math.round(moved / total * 100) : 0;
  return [pct > 0 ? 'You\'re ' + pct + '% of the way there.' : 'Every journey starts somewhere.', (moved > 0 ? r0(moved * 10) / 10 + ' lb ' + (dir === 1 ? 'down' : 'up') + ', ' : '') + (r0(remaining * 10) / 10) + ' to go to reach ' + label + '. ' + (moved > 0 && days >= 14 ? 'At your current pace' : 'At a safe pace of about 1 lb a week') + ' that\'s about ' + weeks + ' weeks. Steady wins.'];
}
async function viewProgress() {
  const prog = await GET('/api/progress?today=' + todayStr());
  const w = prog.week, goal = prog.workouts_per_week || 3, td = todayStr(), st = prog.stats;
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const ws = prog.weights, last = ws.length ? ws[ws.length - 1].weight_lb : null, delta = ws.length > 1 ? last - ws[0].weight_lb : 0;
  let h = '<button class="howlink" data-a="tab" data-t="me">' + I('back') + ' Me</button><div class="head"><div><h1 class="title">Progress</h1><p class="sub">Last 12 weeks</p></div></div>';
  h += '<div class="tiles"><div class="tile"><div class="n amber">' + prog.streak + '</div><div class="t">day streak</div></div><div class="tile"><div class="n lime">' + w.workouts + '/' + goal + '</div><div class="t">this week</div></div><div class="tile"><div class="n cyan">' + prog.total_sessions + '</div><div class="t">sessions</div></div></div>';
  h += '<div class="card"><div class="row between"><h3 style="margin:0;font-size:16px">This week</h3><div class="days">' + w.days.map((d, i) => '<b class="' + (d.worked ? 'on ' : '') + (d.date === td ? 'today' : '') + '">' + names[i] + '</b>').join('') + '</div></div><div class="spacer"></div>' +
    '<div class="row between small" style="margin-bottom:6px"><span class="soft">Active minutes</span><span class="mono lime" style="font-weight:700">' + w.minutes + ' / 150</span></div><div class="bar8"><i style="width:' + Math.min(100, w.minutes / 150 * 100) + '%"></i></div><div class="spacer"></div>' +
    '<div class="row between small" style="margin-bottom:6px"><span class="soft">Strength days</span><span class="mono cyan" style="font-weight:700">' + w.strength_days + ' / 2</span></div><div class="bar8 cyan"><i style="width:' + Math.min(100, w.strength_days / 2 * 100) + '%"></i></div>' +
    '<p class="small muted" style="margin-top:12px;font-size:12px">Targets from CDC adult guidelines: 150 min moderate activity and 2 strength days per week.</p></div>';
  h += '<div class="card"><div class="row between"><h3 style="margin:0;font-size:16px">Weight</h3>' + (last ? '<span class="mono lime" style="font-weight:700;font-size:14px">' + last.toFixed(1) + ' lb' + (ws.length > 1 ? ' · ' + (delta > 0 ? '+' : '') + delta.toFixed(1) : '') + '</span>' : '') + '</div>' + weightChart(ws, st.healthy_max, prog.goal_weight_lb && prog.goal_weight_lb < (st.healthy_max || 9999) ? prog.goal_weight_lb : null) + '</div>';
  const jm = journeyMessage(prog);
  h += '<div class="card good"><div style="font-weight:800;color:var(--lime);margin-bottom:6px">' + esc(jm[0]) + '</div><div style="line-height:1.5;font-size:15px">' + esc(jm[1]) + '</div></div><div id="x-bot"></div>';
  setApp(h);
}

// ---------- Body ----------
const ACT = [['sedentary', 'Mostly sitting'], ['light', 'Lightly active'], ['moderate', 'Moderately active'], ['very', 'Very active']];
function bmiGauge(b) {
  let pos;
  if (b < 18.5) pos = Math.max(0, (b - 15) / 3.5) * 17; else if (b < 25) pos = 17 + (b - 18.5) / 6.5 * 33; else if (b < 30) pos = 50 + (b - 25) / 5 * 25; else pos = 75 + Math.min(1, (b - 30) / 10) * 25;
  return '<div class="bmi"><i style="flex:17;background:var(--cyan);border-radius:6px 0 0 6px"></i><i style="flex:33;background:var(--lime)"></i><i style="flex:25;background:var(--amber)"></i><i style="flex:25;background:var(--rose);border-radius:0 6px 6px 0"></i><span class="mk" style="left:' + pos.toFixed(1) + '%"></span></div>' +
    '<div class="bmilab"><span style="flex:17">Under</span><span style="flex:33">Healthy</span><span style="flex:25">Over</span><span style="flex:25">Obese</span></div>';
}
async function viewBody() {
  const [prof, ws] = await Promise.all([GET('/api/profile'), GET('/api/weights')]);
  S.profile = prof.profile; S.stats = prof.stats;
  const p = prof.profile, st = prof.stats, last = ws.weights.length ? ws.weights[ws.weights.length - 1].weight_lb : '';
  const ft = p.height_in ? Math.floor(p.height_in / 12) : '', inch = p.height_in ? Math.round(p.height_in % 12) : '';
  let h = '<button class="howlink" data-a="tab" data-t="me">' + I('back') + ' Me</button><div class="head"><div><h1 class="title">Body &amp; goals</h1><p class="sub">Your numbers power every estimate in the app</p></div><button class="sq" data-a="settings" aria-label="Settings">' + I('gear') + '</button></div>';
  h += '<div class="two"><div class="field"><label>Age</label><input id="b-age" class="inputmono" type="number" inputmode="numeric" value="' + esc(p.age || '') + '"></div><div class="field"><label>Sex (for formulas)</label><select id="b-sex" style="font-weight:700"><option value="">Choose</option><option value="female"' + (p.sex === 'female' ? ' selected' : '') + '>Female</option><option value="male"' + (p.sex === 'male' ? ' selected' : '') + '>Male</option></select></div></div>';
  h += '<div class="two"><div class="field"><label>Height</label><div class="row gap6"><input id="b-ft" class="inputmono" type="number" inputmode="numeric" placeholder="ft" value="' + esc(ft) + '"><input id="b-in" class="inputmono" type="number" inputmode="numeric" placeholder="in" value="' + esc(inch) + '"></div></div><div class="field"><label>Weight today</label><input id="b-wt" class="inputmono" type="number" inputmode="decimal" step="0.1" placeholder="lb" value="' + esc(last) + '"></div></div>';
  h += '<div class="two"><div class="field"><label>Goal weight</label><input id="b-goal" class="inputmono" type="number" inputmode="decimal" placeholder="lb" value="' + esc(p.goal_weight_lb || '') + '"></div><div class="field"><label>Activity level</label><select id="b-act" style="font-weight:700">' + ACT.map((a) => '<option value="' + a[0] + '"' + (p.activity === a[0] ? ' selected' : '') + '>' + a[1] + '</option>').join('') + '</select></div></div>';
  h += '<div class="field"><label>Workouts per week I\'m aiming for</label><select id="b-wpw" style="font-weight:700">' + [1, 2, 3, 4, 5, 6, 7].map((n) => '<option' + (p.workouts_per_week === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>';
  h += '<button class="btn block" data-a="body-save" style="min-height:56px;font-size:16px">Log today\'s weight</button><div class="spacer"></div>';
  h += '<div class="card"><div class="row between"><h3 style="margin:0;font-size:16px">Your BMI</h3><span class="mono amber" style="font-size:22px;font-weight:800">' + (st.bmi ? st.bmi.toFixed(1) : '--') + '</span></div>' + (st.bmi ? bmiGauge(st.bmi) : '<p class="muted small" style="margin-top:10px">Add your height and weight to see your BMI.</p>') + '<p class="small muted" style="margin-top:12px;font-size:12px">BMI compares your weight to your height. It\'s a rough guide, not a diagnosis.</p></div>';
  h += '<div class="tiles"><div class="tile"><div class="eyebrow">Healthy range</div><div class="n lime" style="font-size:18px">' + (st.healthy_min ? r0(st.healthy_min) + '-' + r0(st.healthy_max) : '--') + '</div><div class="t">lb' + (p.height_in ? ' at ' + ftIn(p.height_in) : '') + '</div></div>' +
    '<div class="tile"><div class="eyebrow">Stay the same</div><div class="n cyan" style="font-size:18px">' + (st.stay_cal ? '~' + st.stay_cal.toLocaleString() : '--') + '</div><div class="t">cal a day</div></div>' +
    '<div class="tile"><div class="eyebrow">To goal</div><div class="n amber" style="font-size:18px">' + (st.lbs_to_goal != null ? r0(st.lbs_to_goal) + ' lb' : '--') + '</div><div class="t">' + (st.weeks_to_goal ? '~' + st.weeks_to_goal + ' wks at 1 lb/wk' : '&nbsp;') + '</div></div></div>';
  h += '<p class="small muted" style="font-size:12px;line-height:1.5">Estimates only, not medical advice. Calories to stay the same weight are a standard estimate (Mifflin-St Jeor). A safe pace is 1-2 lb a week (CDC).</p><div id="x-bot"></div>';
  setApp(h);
}

// ---------- Food ----------
function foodTitle(d) { return (d === todayStr() ? 'Today · ' : '') + new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
async function viewFood() {
  const [d, prof, prog, act] = await Promise.all([GET('/api/diary?date=' + S.foodDate), GET('/api/profile'), GET('/api/progress?today=' + todayStr()), GET('/api/session/active')]);
  S.profile = prof.profile; S.stats = prof.stats;
  const t = d.totals, g = d.goals, left = g.calories - t.calories, pct = Math.min(1, t.calories / g.calories), C = 2 * Math.PI * 54;
  const todayDone = (prog.week.days.find((x) => x.date === todayStr()) || {}).worked;
  const workout = (act.session || (S.doc && !S.doc.ended_at)) ? ['in progress', 'cyan'] : todayDone ? ['done', 'lime'] : ['not yet', 'muted'];
  let h = '<div class="head"><div><h1 class="title">Food</h1><p class="sub">' + foodTitle(S.foodDate) + '</p></div><div class="hdr-right">' + themeBtn() + '<button class="btn" style="min-height:44px;padding:0 14px" data-a="add-food" data-meal="' + defaultMeal() + '">' + I('plus') + ' Add food</button></div></div>';
  h += '<div id="x-top"></div><div class="row between" style="margin-bottom:12px"><button class="sq" data-a="food-day" data-d="-1" aria-label="Previous day">' + I('back') + '</button><span class="small muted" style="font-weight:600">' + (S.foodDate === todayStr() ? 'Today' : fmtDate(S.foodDate)) + '</span><button class="sq" data-a="food-day" data-d="1" aria-label="Next day">' + I('next') + '</button></div>';
  h += '<div class="card"><div class="row gap12"><div class="ring"><svg width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="54" style="stroke:var(--raise)" stroke-width="14" fill="none"/><circle cx="65" cy="65" r="54" style="stroke:' + (left < 0 ? 'var(--rose)' : 'var(--acc)') + '" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><div class="mid"><div class="mono" style="font-size:28px;font-weight:800">' + r0(Math.abs(left)) + '</div><div class="small muted" style="font-size:12px">cal ' + (left < 0 ? 'over' : 'left') + '</div></div></div>' +
    '<div class="grow"><div class="row between small" style="margin-bottom:6px"><span class="muted">Daily goal</span><b class="mono">' + g.calories.toLocaleString() + '</b></div><div class="row between small" style="margin-bottom:6px"><span class="muted">Food eaten</span><b class="mono lime">' + r0(t.calories).toLocaleString() + '</b></div><div class="row between small" style="margin-bottom:8px"><span class="muted">Workout today</span><b class="mono ' + workout[1] + '">' + workout[0] + '</b></div>' +
    '<div class="muted" style="font-size:11px;line-height:1.4">' + (g.personalized && S.stats.stay_cal ? 'Goal = the ~' + S.stats.stay_cal.toLocaleString() + ' cal to stay the same weight' + (S.stats.goal_cal < S.stats.stay_cal ? ', minus 500, to lose about 1 lb a week.' : S.stats.goal_cal > S.stats.stay_cal ? ', plus 300, to gain slowly.' : '.') : 'Add your body stats on the Body tab for a personal goal.') + '</div></div></div></div>';
  h += '<div class="card">' + [['Protein', t.protein, g.protein, 'cyan'], ['Carbs', t.carbs, g.carbs, 'lime'], ['Fat', t.fat, g.fat, 'amber']].map((m) => '<div class="macro"><div class="t"><span>' + m[0] + '</span><span class="mono ' + m[3] + '" style="font-size:12px">' + r0(m[1]) + ' / ' + m[2] + ' g</span></div><div class="bar8 ' + (m[3] === 'lime' ? '' : m[3]) + '"><i style="width:' + Math.min(100, m[1] / m[2] * 100) + '%"></i></div></div>').join('') + '</div>';
  ['breakfast', 'lunch', 'dinner', 'snacks'].forEach((m) => {
    const es = d.entries.filter((e) => e.meal === m), cals = r0(es.reduce((a, e) => a + e.calories, 0)), open = S.openMeal === m;
    h += '<div class="mealcard"><div class="row between" style="gap:12px"><div class="grow" data-a="open-meal" data-m="' + m + '" style="cursor:pointer"><div><b style="font-size:16px;text-transform:capitalize">' + m + '</b>' + (es.length ? ' <span class="mono lime" style="font-weight:700;margin-left:4px">' + cals + '</span>' : '') + '</div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (es.length ? esc(es.map((e) => e.name).join(', ')) : 'Nothing logged yet') + '</div></div>' +
      '<button class="sq' + (es.length ? '' : ' lime') + '" data-a="add-food" data-meal="' + m + '" aria-label="Add to ' + m + '" style="width:48px;height:48px">' + I('plus') + '</button></div>' +
      (open ? es.map((e) => '<div class="entry"><div class="grow"><div style="font-weight:600">' + esc(e.name) + '</div><div class="small muted">' + e.servings + ' × ' + esc(e.serving) + '</div></div><div class="mono" style="font-weight:700">' + r0(e.calories) + '</div><button class="sq" data-a="del-entry" data-id="' + e.id + '" aria-label="Remove" style="width:36px;height:36px;color:var(--rose)">' + I('dots').replace('<path d="' + P.dots + '"/>', '<path d="M6 6l12 12M18 6L6 18"/>') + '</button></div>').join('') : '') + '</div>';
  });
  h += '<button class="btn outline block" data-a="recipes" style="margin-bottom:12px">Recipes from you and your friends</button><div id="x-bot"></div>';
  setApp(h);
}
function defaultMeal() { const h = new Date().getHours(); return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }

let addCtx = { meal: 'breakfast', scope: 'all', q: '' };
async function pageAddFood(meal) {
  if (meal) addCtx = { meal, scope: 'all', q: '' };
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:22px">Add food</h1><p class="sub">To ' + esc(addCtx.meal) + ' · ' + new Date(S.foodDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' }) + '</p></div></div>' +
    '<div class="row gap8" style="margin-bottom:12px"><input id="fq" placeholder="Search foods, like banana or chicken" autocomplete="off" value="' + esc(addCtx.q) + '"><button class="sq cyan" data-a="barcode-toggle" aria-label="Barcode" style="width:56px;height:48px">' + I('barcode') + '</button></div>' +
    '<div class="seg" style="margin-bottom:12px">' + [['all', 'All'], ['recent', 'Recent'], ['mine', 'My foods']].map((s) => '<button data-a="fscope" data-s="' + s[0] + '" class="' + (addCtx.scope === s[0] ? 'on' : '') + '">' + s[1] + '</button>').join('') + '</div>' +
    '<div id="fres"></div>' +
    '<div class="card hi" id="barcard"><div class="row gap12"><div class="sq cyan dark" style="width:48px;height:48px;background:var(--cyanbg2);color:var(--cyan);border-color:var(--cyan)">' + I('barcode') + '</div><div><b>Look up a barcode</b><div class="small muted" style="font-size:12px">Type the number printed under the barcode to fill in the label from Open Food Facts.</div></div></div>' +
    '<div class="row gap8" style="margin-top:12px"><input id="fbar" inputmode="numeric" placeholder="Barcode number"><button class="btn cyan" data-a="barcode">Look up</button></div>' + ext('scanBtn') + '</div>' +
    '<button class="btn alt block" data-a="custom-food" style="min-height:52px">Can\'t find it? Create your own food</button>');
  $('#fq').addEventListener('input', debounce(() => { addCtx.q = val('fq'); runFoodSearch(); }, 250));
  runFoodSearch();
}
function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
let searchSeq = 0;
async function runFoodSearch() {
  const seq = ++searchSeq;
  const r = await GET('/api/foods/search?scope=' + addCtx.scope + '&q=' + encodeURIComponent(val('fq')));
  const box = $('#fres'); if (!box || seq !== searchSeq) return;
  box.innerHTML = r.foods.length ? r.foods.map(foodRow).join('') : '<p class="muted small" style="margin:6px 0 14px">Nothing found. Try another word, or create your own food below.</p>';
}
const SRC = { usda: ['USDA', 'cyan'], off: ['Packaged', 'amber'], custom: ['Mine', 'lime'] };
const foodRow = (f) => { const b = SRC[f.source]; return '<div class="res" data-a="pick-food" data-id="' + f.id + '" data-name="' + esc(f.name) + '" data-serving="' + esc(f.serving) + '" data-cal="' + f.calories + '" data-own="' + (f.owner_id && S.me && f.owner_id === S.me.id ? 1 : '') + '" style="cursor:pointer"><div class="grow"><div class="nm">' + esc(f.name) + '</div><div class="meta">' + esc(f.serving) + ' · <b>' + r0(f.calories) + ' cal</b> · ' + r0(f.protein) + 'g protein</div>' + (b || f.brand ? '<div style="margin-top:6px">' + (b ? '<span class="badge ' + b[1] + '">' + b[0] + '</span> ' : '') + (f.brand && f.brand !== 'USDA' ? '<span class="small muted">' + esc(f.brand) + '</span>' : '') + '</div>' : '') + '</div><div class="sq lime" style="width:48px;height:48px;border-radius:14px">' + I('plus') + '</div></div>'; };
function pickFood(el) {
  const d = el.dataset;
  sheet('<h2 class="title" style="font-size:22px">' + esc(d.name) + '</h2><p class="sub" style="margin-bottom:14px">' + esc(d.serving) + ' = ' + r0(d.cal) + ' cal</p>' +
    '<div class="field"><label>How many servings?</label><input id="srv" class="inputmono" type="number" step="0.25" inputmode="decimal" value="1"></div>' +
    '<button class="btn block" data-a="confirm-food" data-id="' + d.id + '">Add to ' + esc(addCtx.meal) + '</button>' +
    (d.own ? '<button class="btn danger block" style="margin-top:10px" data-a="food-del" data-id="' + d.id + '">Delete this food</button>' : ''));
}
function customFoodSheet() {
  sheet('<h2 class="title" style="font-size:22px">Create your own food</h2><p class="sub" style="margin-bottom:14px">Copy these numbers from the nutrition label.</p>' +
    '<div class="field"><label>Name</label><input id="cf-name"></div><div class="field"><label>Serving size (like "1 cup")</label><input id="cf-serv" value="1 serving"></div>' +
    '<div class="two"><div class="field"><label>Calories</label><input id="cf-cal" class="inputmono" type="number" inputmode="decimal"></div><div class="field"><label>Protein (g)</label><input id="cf-pro" class="inputmono" type="number" inputmode="decimal"></div></div>' +
    '<div class="two"><div class="field"><label>Carbs (g)</label><input id="cf-carb" class="inputmono" type="number" inputmode="decimal"></div><div class="field"><label>Fat (g)</label><input id="cf-fat" class="inputmono" type="number" inputmode="decimal"></div></div>' +
    '<button class="btn block" data-a="save-custom">Save and add</button>');
}

// recipes
async function pageRecipes() {
  const r = (await GET('/api/recipes')).recipes, f = S.recipeFilter;
  const list = r.filter((x) => f === 'all' || (f === 'quick' && x.minutes > 0 && x.minutes <= 15) || (f === 'protein' && x.protein >= 30) || (f === 'saved' && x.cheered));
  let h = '<div class="head"><div class="row gap12">' + backBtn() + '<div><h1 class="title" style="font-size:24px">Recipes</h1><p class="sub" style="font-size:12px">Shared by you and your friends</p></div></div><button class="btn" style="min-height:44px;padding:0 14px" data-a="recipe-new">' + I('plus') + ' Share one</button></div>';
  h += '<div class="chips">' + [['all', 'All'], ['quick', 'Quick'], ['protein', 'High protein'], ['saved', 'Saved']].map((c) => '<button data-a="rfilter" data-f="' + c[0] + '" class="' + (f === c[0] ? 'on' : '') + '">' + c[1] + '</button>').join('') + '</div>';
  if (!list.length) h += '<div class="card muted">' + (r.length ? 'Nothing matches that filter.' : 'No recipes yet. Share your favorite healthy meal and your friends will see it.') + '</div>';
  list.forEach((x, i) => {
    const tag = x.mine ? '<span class="badge">Yours</span>' : x.protein >= 30 ? '<span class="badge cyan">High protein</span>' : x.minutes > 0 && x.minutes <= 15 ? '<span class="badge amber">Quick</span>' : '';
    h += '<div class="card"><div class="row between" style="align-items:flex-start;gap:10px"><div><h3 style="font-size:17px;margin:0;line-height:1.25">' + esc(x.title) + '</h3><div class="small muted" style="margin-top:3px">by ' + (x.mine ? esc(x.owner) + ' (you)' : esc(x.owner)) + (x.minutes ? ' · ' + x.minutes + ' min' : '') + '</div></div>' + tag + '</div>' +
      '<div class="small" style="margin:10px 0"><b class="mono lime">' + r0(x.calories) + '</b> cal &nbsp; <b class="mono cyan">' + r0(x.protein) + 'g</b> protein <span class="muted"> per serving</span></div>' +
      '<div class="row gap8"><button class="btn' + (i === 0 && !x.mine ? '' : ' alt') + '" style="flex:1" data-a="recipe-open" data-id="' + x.id + '">View recipe</button>' + (x.mine ? '<button class="btn alt" data-a="recipe-edit" data-id="' + x.id + '">Edit</button>' : '<button class="btn alt" data-a="recipe-heart" data-id="' + x.id + '" style="' + (x.cheered ? 'color:var(--lime);border-color:rgba(163,230,53,.5);background:var(--limebg)' : '') + '">' + IF(HEART) + x.cheers + '</button>') + '</div></div>';
  });
  setPage(h);
}
async function recipeForm(id) {
  let r = { title: '', servings: 2, minutes: 20, ingredients: '', steps: '', calories: '', protein: '', carbs: '', fat: '', shared: 1 };
  if (id) r = (await GET('/api/recipes/' + id)).recipe;
  sheet('<h2 class="title" style="font-size:22px">' + (r.id ? 'Edit recipe' : 'Share a recipe') + '</h2><div class="spacer"></div>' +
    '<div class="field"><label>Title</label><input id="r-title" value="' + esc(r.title) + '"></div>' +
    '<div class="two"><div class="field"><label>Servings</label><input id="r-serv" class="inputmono" type="number" value="' + esc(r.servings) + '"></div><div class="field"><label>Minutes</label><input id="r-min" class="inputmono" type="number" value="' + esc(r.minutes) + '"></div></div>' +
    '<div class="field"><label>Ingredients (one per line)</label><textarea id="r-ing">' + esc(r.ingredients) + '</textarea></div>' +
    '<div class="field"><label>Steps (one per line)</label><textarea id="r-steps">' + esc(r.steps) + '</textarea></div>' +
    '<div class="flabel">Nutrition per serving (optional)</div><div class="two"><div class="field"><label>Calories</label><input id="r-cal" class="inputmono" type="number" value="' + esc(r.calories) + '"></div><div class="field"><label>Protein (g)</label><input id="r-pro" class="inputmono" type="number" value="' + esc(r.protein) + '"></div></div>' +
    '<div class="two"><div class="field"><label>Carbs (g)</label><input id="r-carb" class="inputmono" type="number" value="' + esc(r.carbs) + '"></div><div class="field"><label>Fat (g)</label><input id="r-fat" class="inputmono" type="number" value="' + esc(r.fat) + '"></div></div>' +
    '<label class="check" style="margin-bottom:14px"><input type="checkbox" id="r-share"' + (r.shared ? ' checked' : '') + '> Share with my friends</label>' +
    '<button class="btn block" data-a="recipe-save" data-id="' + (r.id || '') + '">Save recipe</button>');
}
async function pageRecipe(id) {
  const d = await GET('/api/recipes/' + id), r = d.recipe;
  const lines = (t) => esc(t).split('\n').filter((x) => x.trim());
  let h = '<div class="head back">' + backBtn() + '<div style="min-width:0"><h1 class="title" style="font-size:20px">' + esc(r.title) + '</h1><p class="sub">by ' + (r.mine ? 'you' : esc(r.owner)) + ' · Makes ' + r.servings + (r.minutes ? ' · ' + r.minutes + ' min' : '') + '</p></div></div>';
  if (r.calories) h += '<div class="card"><div class="eyebrow" style="font-size:10px;margin-bottom:8px">Per serving</div><div class="row between" style="text-align:center"><div style="flex:1"><div class="mono lime" style="font-size:24px;font-weight:800">' + r0(r.calories) + '</div><div class="small muted">cal</div></div><div style="flex:1"><div class="mono cyan" style="font-size:24px;font-weight:800">' + r0(r.protein) + 'g</div><div class="small muted">protein</div></div><div style="flex:1"><div class="mono lime" style="font-size:24px;font-weight:800">' + r0(r.carbs) + 'g</div><div class="small muted">carbs</div></div><div style="flex:1"><div class="mono amber" style="font-size:24px;font-weight:800">' + r0(r.fat) + 'g</div><div class="small muted">fat</div></div></div></div>';
  if (r.ingredients) h += '<div class="card"><h3>What you need</h3><div style="line-height:1.7">' + lines(r.ingredients).map((x) => '<div>' + x + '</div>').join('') + '</div></div>';
  if (r.steps) h += '<div class="card"><h3>How to make it</h3><ol class="plain">' + lines(r.steps).map((x) => '<li>' + x + '</li>').join('') + '</ol></div>';
  d.tips.forEach((t) => { h += '<div class="card good tight"><b class="lime">' + esc(t.username) + ':</b> ' + esc(t.text) + ' <span class="muted">· ' + ago(t.created_at) + '</span>' + (r.mine || t.user_id === S.me.id ? ' <button class="linkbtn" data-a="tip-del" data-id="' + t.id + '" data-rid="' + r.id + '">Delete</button>' : '') + '</div>'; });
  h += '<div class="row gap8" style="margin-bottom:12px"><input id="tip" placeholder="Share a tip (a swap or a shortcut)"><button class="btn alt" data-a="tip-send" data-id="' + r.id + '">Send</button></div>';
  const meal = defaultMeal();
  h += ext('recipeExtra', r) + '<div class="row gap8">' + (r.calories ? '<button class="btn" style="flex:1;min-height:56px" data-a="recipe-log-go" data-id="' + r.id + '" data-meal="' + meal + '">Add 1 serving to ' + meal + '</button>' : '<div style="flex:1"></div>') +
    '<button class="sq" data-a="recipe-cheer" data-id="' + r.id + '" style="width:56px;height:56px;' + (r.cheered ? 'color:var(--lime);border-color:rgba(163,230,53,.5);background:var(--limebg)' : '') + '" aria-label="Save">' + IF(HEART) + '</button></div>';
  if (r.mine) h += '<div class="row gap8" style="margin-top:12px"><button class="btn alt" style="flex:1" data-a="recipe-edit" data-id="' + r.id + '">Edit</button><button class="btn danger" style="flex:1" data-a="recipe-del" data-id="' + r.id + '">Delete</button></div>';
  setPage(h);
}

// ---------- Friends ----------
async function viewFriends() {
  const [lb, fr, ev] = await Promise.all([GET('/api/leaderboard?today=' + todayStr()), GET('/api/friends'), GET('/api/feed')]);
  let h = '<div class="head"><div><h1 class="title">Friends</h1><p class="sub">Show up for each other</p></div>' + tools() + '</div><div id="x-top"></div>';
  h += '<div class="row gap8" style="margin-bottom:12px"><input id="fr-name" autocapitalize="none" autocorrect="off" placeholder="Add a friend by their name"><button class="btn" data-a="friend-add" style="min-height:48px">Add</button></div>';
  fr.incoming.forEach((x) => { h += '<div class="card hi tight"><div class="row gap12">' + avatar(x.username) + '<div class="grow"><b>' + esc(x.username) + '</b> wants to connect</div><button class="btn sm" data-a="friend-accept" data-id="' + x.id + '">Accept</button><button class="btn alt sm" data-a="friend-ignore" data-id="' + x.id + '">Ignore</button></div></div>'; });
  fr.outgoing.forEach((x) => { h += '<div class="card tight"><div class="row gap12">' + avatar(x.username) + '<div class="grow small muted">Waiting for <b class="soft">' + esc(x.username) + '</b> to accept</div><button class="btn alt sm" data-a="friend-ignore" data-id="' + x.id + '">Cancel</button></div></div>'; });
  h += '<div class="card"><div class="row between" style="margin-bottom:6px"><h3 style="margin:0;font-size:16px">This week</h3><span class="small muted" style="font-size:12px">Workouts · streak</span></div>' + lb.leaders.map((u, i) => '<div class="lbrow' + (u.me ? ' me' : '') + '"><span class="rank' + (i === 0 ? ' first' : '') + '">' + (i + 1) + '</span>' + avatar(u.username) + '<div class="grow"><b>' + esc(u.username) + '</b>' + (u.me ? ' <span class="muted small">(you)</span>' : '') + '</div><span class="mono lime" style="font-weight:700;font-size:13px">' + u.workouts + ' · ' + u.streak + 'd</span></div>').join('') + (lb.leaders.length < 2 ? '<p class="small muted" style="margin-top:8px">Add a friend to see how you stack up.</p>' : '') + '</div>';
  h += '<div class="eyebrow" style="margin:18px 0 10px">Activity</div>';
  h += ev.events.length ? ev.events.map((e) => ext('feedRow', e) || '<div class="card tight"><div class="row gap12"><div class="grow"><b>' + esc(e.username) + '</b> ' + esc(e.text) + '<div class="small muted" style="margin-top:3px">' + ago(e.created_at) + (e.cheers ? ' · ' + e.cheers + ' cheer' + (e.cheers === 1 ? '' : 's') : '') + '</div></div>' +
    (e.type === 'recipe' ? '<button class="btn outline sm" data-a="recipe-open" data-id="' + e.ref_id + '">View</button>' : e.user_id !== S.me.id ? '<button class="btn sm" data-a="cheer" data-id="' + e.id + '" style="' + (e.cheered ? '' : 'background:var(--limebg);color:var(--lime);border:1px solid rgba(163,230,53,.4)') + '">' + IF(HEART) + 'Cheer</button>' : '') + '</div></div>').join('') : '<div class="card muted">Nothing yet. Finish a workout to be the first post!</div>';
  if (fr.friends.length) h += '<div class="eyebrow" style="margin:18px 0 10px">Your friends</div><div class="card tight">' + fr.friends.map((x) => '<div class="row gap12" style="padding:6px 0">' + avatar(x.username) + '<div class="grow"><b>' + esc(x.username) + '</b></div>' + ext('nudge', x) + '<button class="btn alt sm" data-a="friend-remove" data-id="' + x.id + '">Remove</button></div>').join('') + '</div>';
  h += '<p class="small muted" style="font-size:12px;line-height:1.5;margin-top:12px">Friends see your workouts and streaks. Your weight, food and body stats stay private.</p>';
  setApp(h);
}

// ---------- History ----------
async function viewHistory() {
  const d = await GET('/api/history?month=' + S.histMonth);
  const [Y, M] = S.histMonth.split('-').map(Number), td = todayStr();
  const first = new Date(Y, M - 1, 1), days = new Date(Y, M, 0).getDate(), lead = first.getDay();
  let cal = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => '<span>' + x + '</span>').join('');
  for (let i = 0; i < lead; i++) cal += '<b class="none"></b>';
  for (let n = 1; n <= days; n++) { const ds = Y + '-' + pad(M) + '-' + pad(n); cal += '<b class="' + (d.days.indexOf(ds) >= 0 ? 'on ' : '') + (ds === td ? 'today' : '') + '">' + n + '</b>'; }
  const monthName = first.toLocaleDateString(undefined, { month: 'long' });
  let h = '<button class="howlink" data-a="tab" data-t="me">' + I('back') + ' Me</button><div class="head"><div><h1 class="title">History</h1><p class="sub">' + d.month_sessions + ' workout' + (d.month_sessions === 1 ? '' : 's') + ' in ' + monthName + '</p></div><div class="row gap8"><button class="sq" data-a="hist-month" data-d="-1" aria-label="Previous month">' + I('back') + '</button><button class="sq" data-a="hist-month" data-d="1" aria-label="Next month">' + I('next') + '</button></div></div>';
  h += '<div class="card"><h3 style="font-size:16px;margin-bottom:12px">' + monthName + ' ' + Y + '</h3><div class="cal">' + cal + '</div><div class="legend"><span><i></i>Worked out</span><span><i class="t"></i>Today</span></div></div>';
  h += '<div class="eyebrow" style="margin:18px 0 10px">Recent sessions</div>';
  h += d.recent.length ? d.recent.map((s) => {
    const live = !s.ended_at, full = s.total && s.done >= s.total;
    const when = s.date === td ? 'Today' : fmtDate(s.date);
    const time = live ? new Date(s.started_at * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : r0((s.duration_sec || 0) / 60) + ' min';
    return '<div class="card tight" style="' + (live ? 'border-color:var(--cyan)' : '') + '"><div class="row between"><div><b>' + when + ' · ' + time + '</b><div class="small muted" style="margin-top:2px">' + (live ? 'Your routine · ' + s.done + ' of ' + s.total + ' done' : s.done + ' of ' + s.total + ' exercises · ' + s.sets + ' sets') + '</div></div><span class="badge ' + (live ? 'cyan' : full ? 'lime' : 'amber') + '">' + (live ? 'Live' : full ? 'Complete' : 'Partial') + '</span>' + (live ? '' : '<button class="sq" style="width:36px;height:36px;color:var(--rose);margin-left:8px" data-a="hist-del" data-id="' + s.id + '" aria-label="Delete this workout">\u00d7</button>') + '</div></div>';
  }).join('') : '<div class="card muted">Finish your first workout and it will show up here.</div>';
  setApp(h);
}

// ---------- Settings, admin, guide, routine ----------
async function pageSettings() {
  const prof = await GET('/api/profile'); S.profile = prof.profile; const p = prof.profile;
  await refreshPushState();
  setPage('<div class="head back">' + backBtn() + '<h1 class="title" style="font-size:24px">Settings</h1></div>' +
    '<div class="card"><div class="row gap12">' + avatar(S.me.name) + '<div class="grow"><b>' + esc(S.me.name) + '</b><div class="small muted">Login: ' + esc(S.me.username) + '</div></div>' + (S.me.role === 'admin' ? '<span class="badge amber">Admin</span>' : '') + '</div><div class="hr"></div>' +
    '<div class="field" style="margin-bottom:10px"><label>Display name</label><input id="dn" maxlength="30" placeholder="' + esc(S.me.username) + '" value="' + esc(S.me.display_name || '') + '" autocomplete="off"></div>' +
    '<div class="row between gap12"><div class="small muted" style="font-size:12px;line-height:1.4">This is the name your friends see. You still sign in as <b class="soft">' + esc(S.me.username) + '</b>.</div><button class="btn sm" data-a="save-name">Save</button></div></div>' +
    '<div class="card"><div class="eyebrow" style="font-size:10px;margin-bottom:12px">Rest alerts</div>' +
    '<div class="row between" style="gap:14px;margin-bottom:14px"><div><b>Alert when rest ends</b><div class="small muted" style="font-size:12px;margin-top:2px">Works with the screen locked. Mirrors to your Apple Watch.</div></div><label class="sw"><input type="checkbox" data-c="alert"' + (S.pushOn ? ' checked' : '') + '><i></i></label></div>' +
    '<div class="row between" style="gap:14px;margin-bottom:12px"><div><b>Nudge again after 30 sec</b><div class="small muted" style="font-size:12px;margin-top:2px">Repeats until you open the app</div></div><label class="sw"><input type="checkbox" data-c="nudge"' + (p.nudge ? ' checked' : '') + '><i></i></label></div>' +
    '<div class="row between" style="gap:14px;margin-bottom:12px"><div><b>Start next rest automatically</b><div class="small muted" style="font-size:12px;margin-top:2px">Rest begins when you tap a set</div></div><label class="sw"><input type="checkbox" data-c="auto"' + (p.auto_rest ? ' checked' : '') + '><i></i></label></div>' +
    '<div class="small cyan" id="push-note" style="font-weight:600">' + (S.pushOn ? '✓ Notifications allowed on this device' : 'Turn this on to get a buzz when your rest is over.' + (isIOS() && !isStandalone() ? ' On iPhone, add GymPulse to your Home Screen first.' : '')) + '</div>' +
    '<div class="row gap8" style="margin-top:12px"><button class="btn alt sm" data-a="test-push">Send a test alert</button></div></div>' +
    '<div class="card"><div class="row between" style="gap:14px"><div><b>Show a note when rest starts</b><div class="small muted" style="font-size:12px;margin-top:2px;line-height:1.4">A lock screen note like &quot;Back at 1:32 PM&quot; that also shows on your Apple Watch. It does not count down live, and it clears when the rest ends. Needs alerts turned on above.</div></div><label class="sw"><input type="checkbox" data-c="restnote"' + (p.rest_note ? ' checked' : '') + '><i></i></label></div></div>' +
    '<div class="card"><div class="row between"><div><b>Units</b><div class="small muted" style="font-size:12px">Pounds and feet / inches</div></div><span class="badge lime">lb</span></div></div>' +
    '<div id="x-set"></div><div class="card tight" data-a="routine" style="cursor:pointer"><div class="row between"><div><b>My workouts</b><div class="small muted" style="font-size:12px">Create workouts, add custom exercises and timers</div></div><span class="muted">' + I('next') + '</span></div></div>' +
    (S.me.role === 'admin' ? '<div class="card warn tight" data-a="admin" style="cursor:pointer"><div class="row between"><div><b>Manage users</b><div class="small muted" style="font-size:12px">Admin only · add users, reset passwords, backups</div></div><span class="amber">' + I('next') + '</span></div></div>' : '') +
    '<div class="row gap8"><button class="btn alt" style="flex:1" data-a="pw-sheet">Change password</button><button class="btn alt" style="flex:1;color:var(--rose)" data-a="logout">Sign out</button></div>' +
    '<p class="small muted" style="text-align:center;margin-top:16px;font-size:12px">GymPulse is for general fitness and is not medical advice. Check with your doctor before starting a new exercise or eating plan.</p>');
  ext('afterPage', 'settings');
}
function pageGuide() {
  const C = (t, body) => '<div class="card"><h3 style="font-size:16px;margin-bottom:10px">' + t + '</h3>' + body + '</div>';
  const w = (a, b) => '<p style="margin-bottom:10px;line-height:1.5"><b class="lime">' + a + '</b> ' + b + '</p>';
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:24px">Start here</h1><p class="sub">New to the gym? You\'re in the right place.</p></div></div>' +
    C('The words you\'ll see', w('Rep', 'is one lift or push, like pressing the weight once.') + w('Set', 'is a group of reps. "3 sets of 10" means do 10 reps, rest, and repeat 3 times.') + w('Rest', 'is your break between sets. GymPulse counts it down for you.') + w('Machine', 'equipment is adjustable. Staff will happily show you the seat and weight settings.')) +
    C('How hard should it feel?', '<p style="line-height:1.5">For walking or cardio, you should be able to talk but not sing. For lifting, pick a weight where the last 2 reps feel tough but never painful.</p>') +
    C('Your first weeks', '<p style="line-height:1.5">Aim for 2-3 workouts a week and go light. Adults are encouraged to work up to 150 minutes of moderate activity a week, and it\'s fine to build up slowly.</p>') +
    '<div class="card warn"><p style="line-height:1.5;font-size:14px"><b class="amber">Stay safe.</b> Stop if you feel sharp pain, dizziness or chest pain. If you have health concerns, check with your doctor before starting a new exercise program.</p></div>' +
    '<div id="x-set"></div><button class="btn block" data-a="close-page" style="min-height:56px">Got it, let\'s go</button>');
  ext('afterPage', 'guide');
}
async function pageRoutine() {
  const d = await GET('/api/routine'); S.routine = d.routine; S.plans = d.plans;
  if (S.plans.indexOf(S.plan) < 0) setPlan(S.plans[0]);
  const rt = S.routine.filter((r) => r.plan === S.plan);
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:24px">My workouts</h1><p class="sub">Build as many as you like and pick one on the Today screen</p></div></div>' + planChips() +
    '<div class="card">' + (rt.length ? rt.map((r, i) => '<div class="entry" style="gap:10px;' + (i === 0 ? 'border-top:0;padding-top:0' : '') + '">' + thumbFor(r.name) + '<div class="grow" style="min-width:0"><b>' + esc(r.name) + '</b><div class="small muted">' + exSub(r) + (r.category ? ' · ' + esc(r.category) : '') + '</div></div>' +
      '<button class="sq" style="width:38px;height:38px" data-a="rt-move" data-id="' + r.id + '" data-dir="up"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">↑</button><button class="sq" style="width:38px;height:38px" data-a="rt-move" data-id="' + r.id + '" data-dir="down"' + (i === rt.length - 1 ? ' disabled' : '') + ' aria-label="Move down">↓</button>' + exPencil('plan', r.id).replace('width:40px;height:40px', 'width:38px;height:38px') + '</div>').join('') : '<p class="muted">No exercises yet.</p>') + '</div>' +
    addButtons('plan') + '<div class="spacer"></div>' +
    (rt.length && !S.session ? '<button class="btn block" data-a="start-workout" style="min-height:52px;margin-bottom:12px">Start this workout</button>' : '') +
    '<div class="card tight"><div class="eyebrow" style="font-size:10px;margin-bottom:10px">This workout: ' + esc(S.plan) + '</div><div class="row gap8 wrap"><button class="btn alt sm" data-a="plan-rename">Rename</button><button class="btn alt sm" data-a="plan-copy">Copy</button><button class="btn danger sm" data-a="plan-delete">Delete</button></div></div>' +
    (S.plan === 'Beginner routine' ? '<button class="btn alt block" data-a="rt-template">Reset Beginner routine to the original</button>' : ''));
}
async function pageAdmin() {
  const us = (await GET('/api/admin/users')).users;
  setPage('<div class="head"><div class="row gap12">' + backBtn() + '<h1 class="title" style="font-size:24px">Users</h1></div><span class="badge amber">Admin</span></div>' +
    us.map((u) => '<div class="card tight"><div class="row gap12">' + avatar(u.display_name || u.username) + '<div class="grow"><b>' + esc(u.display_name || u.username) + '</b>' + (u.id === S.me.id ? ' <span class="muted small">(you)</span>' : '') + (u.disabled ? ' <span class="badge rose">Off</span>' : '') + '<div class="small muted" style="font-size:12px">' + (u.display_name ? 'Login: ' + esc(u.username) + ' · ' : '') + (u.last_workout ? 'Last workout ' + (u.last_workout === todayStr() ? 'today' : fmtDate(u.last_workout)) : 'No workouts yet') + '</div></div><span class="badge ' + (u.role === 'admin' ? 'amber' : '') + '">' + (u.role === 'admin' ? 'Admin' : 'Standard') + '</span><button class="sq" data-a="adm-menu" data-id="' + u.id + '" data-name="' + esc(u.display_name || u.username) + '" data-role="' + u.role + '" data-off="' + u.disabled + '" aria-label="Options">' + I('dots') + '</button></div></div>').join('') +
    '<div class="card"><div class="eyebrow" style="font-size:10px;margin-bottom:12px">Add a user</div><div class="two"><div class="field"><label>Username</label><input id="nu-name" autocapitalize="none" placeholder="e.g. taylor"></div><div class="field"><label>Temp password</label><input id="nu-pw" placeholder="they change it"></div></div>' +
    '<div class="row gap8"><div class="seg" style="flex:1" id="nu-role"><button class="on" data-a="nu-role" data-r="user">Standard</button><button data-a="nu-role" data-r="admin">Admin</button></div><button class="btn" style="flex:1" data-a="adm-add">Create user</button></div></div>' +
    '<div class="card good"><p style="font-size:13px;line-height:1.6"><b class="lime">Standard</b> users see only their own workouts, stats and food.<br><b class="amber">Admins</b> can also add, disable and reset users, and download backups. Admins can\'t read other people\'s weight or food.</p></div>' +
    '<div id="x-set"></div><div class="card tight"><div class="row between"><div><b>Database backup</b><div class="small muted" style="font-size:12px">Nightly copies are kept in your appdata folder</div></div><a class="btn outline sm" href="/api/admin/backup" style="text-decoration:none">Download</a></div></div>');
  ext('afterPage', 'admin');
}
function pwSheet() {
  sheet('<h2 class="title" style="font-size:22px">Change password</h2><div class="spacer"></div><div class="field"><input id="pw-old" type="password" placeholder="Current password" autocomplete="current-password"></div><div class="field"><input id="pw-new" type="password" placeholder="New password (8+ characters)" autocomplete="new-password"></div><button class="btn block" data-a="change-pw">Change password</button>');
}

// ---------- push ----------
function b64ToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const r = atob(s), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
async function refreshPushState() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') { S.pushOn = false; return; }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    S.pushOn = !!sub && Notification.permission === 'granted';
  } catch (e) { S.pushOn = false; }
}
async function enablePush() {
  const note = $('#push-note');
  const say = (t) => { if (note) note.textContent = t; };
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { say(isIOS() ? 'Add GymPulse to your Home Screen first (Share → Add to Home Screen), open it from there, then try again. Needs iOS 16.4 or newer.' : 'This browser does not support alerts.'); return false; }
  try {
    const key = (await GET('/api/push/key')).key;
    if (!key) { say('Alerts are not available on this server.'); return false; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { say('Alerts were not allowed. You can change this in Settings → Notifications → GymPulse.'); return false; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    await POST('/api/push/subscribe', { subscription: sub.toJSON() });
    S.pushOn = true; say('✓ Notifications allowed on this device. Tap "Send a test alert", then lock your phone.');
    return true;
  } catch (e) { say('Could not turn on alerts: ' + (e.message || e)); return false; }
}
async function disablePush() {
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); await POST('/api/push/unsubscribe'); } catch (e) {}
  S.pushOn = false; const n = $('#push-note'); if (n) n.textContent = 'Alerts are off.';
}

// ---------- events ----------
let nuRole = 'user';
const actions = {
  reload() { location.reload(); },
  forgot() { toast('Ask your admin to reset your password.'); },
  async setup() { try { await POST('/api/setup', { username: val('u'), password: val('p') }); boot(); } catch (e) { $('#e').textContent = e.userMessage || 'Could not create the account.'; } },
  async login() { try { await POST('/api/login', { username: val('u'), password: val('p'), remember: $('#keep') ? $('#keep').checked : true }); boot(); } catch (e) { $('#e').textContent = e.userMessage || 'Could not sign in.'; } },
  tab(el) { go(el.dataset.t); },
  theme() { applyTheme(curTheme() === 'light' ? 'dark' : 'light'); },
  'plan-open'() { openPage(pageRoutine, 'today'); },
  'plan-edit'(el) { setPlan(el.dataset.p); openPage(pageRoutine, 'train'); },
  'plan-start'(el) { setPlan(el.dataset.p); actions['start-workout'](); },
  'train-level'(el) { S.tr.level = +el.dataset.v; rerenderTrain(); },
  'train-len'(el) { S.tr.minutes = +el.dataset.v; rerenderTrain(); },
  async 'train-build'() {
    try { const r = await POST('/api/programs/build', { level: S.tr.level, minutes: S.tr.minutes }); setPlan(r.plan); toast('Workout ready: ' + r.plan); go('today'); } catch (e) { fail(e); }
  },
  async 'water-quick'() { try { await POST('/api/water', { date: todayStr(), add_oz: 8 }); go('today'); } catch (e) { fail(e); } },
  'close-page'() { closePage(); go(S.tab); },
  'start-workout'() {
    const list = S.routine.filter((r) => r.plan === S.plan); if (!list.length) return;
    const d = { uid: S.me.id, cid: 'w' + uid8(), plan: S.plan, date: todayStr(), started_at: Math.floor(Date.now() / 1000), nextId: 1, exercises: [] };
    list.forEach((r) => { const id = d.nextId++; d.exercises.push({ id, cid: 'e' + id, routine_id: r.id, name: r.name, kind: r.kind, sets_total: r.sets_total, sets_done: 0, completed: 0, category: r.category, note: r.note, reps: r.reps, seconds: r.seconds, logs: [], last: null, best: 0 }); });
    S.doc = d; bindDoc(); saveDoc(); S.focus = null; go('today'); fetchLast();
  },
  focus(el) { S.focus = +el.dataset.id; go('today'); },
  'toggle-ex'(el) {
    const e = docEx(el.dataset.id); if (!e) return;
    if (e.kind === 'sets') { e.sets_done = e.completed ? 0 : e.sets_total; e.completed = e.sets_done >= e.sets_total ? 1 : 0; } else e.completed = e.completed ? 0 : 1;
    saveDoc(); S.focus = null; go('today');
  },
  set(el) {
    const e = docEx(el.dataset.id); if (!e) return;
    const n = +el.dataset.n, done = e.sets_done, sets = n === done ? n - 1 : n;
    e.logs = e.logs || [];
    if (sets > done) {
      const w = parseFloat(val('lw')) || 0, r = parseInt(val('lr'), 10) || 0;
      if (w > 0 || r > 0) {
        e.logs = e.logs.filter((l) => l.set_no !== n);
        const lg = { set_no: n, weight_lb: Math.round(w * 10) / 10, reps: r };
        if (e.best > 0 && e1rm(w, r) > e.best + 0.05) { lg.pr = true; toast('New personal best! ' + (w ? lbs(w) + ' lb × ' : '') + r + ' \ud83c\udf89'); }
        e.logs.push(lg);
      }
    } else e.logs = e.logs.filter((l) => l.set_no <= sets);
    e.sets_done = sets; e.completed = sets >= e.sets_total ? 1 : 0;
    saveDoc();
    if (sets > done && S.profile.auto_rest && !e.completed) startTimer(+el.dataset.secs, 'Rest · ' + el.dataset.name, { exId: e.id });
    else if (e.completed) { if (timer) stopTimer(); S.focus = null; toast(el.dataset.name + ' done. Nice!'); }
    go('today');
  },
  'timed-start'(el) { S.focus = +el.dataset.id; startTimer(+el.dataset.secs, el.dataset.name, { exId: +el.dataset.id, kind: 'timed' }); go('today'); },
  'timed-done'(el) { const e = docEx(el.dataset.id); if (e) { e.completed = 1; saveDoc(); } stopTimer(); S.focus = null; go('today'); },
  'sess-pause'() { const st = sessState(); if (st.pausedAt) { st.pausedMs = (st.pausedMs || 0) + Date.now() - st.pausedAt; delete st.pausedAt; } else st.pausedAt = Date.now(); sessSave(st); go('today'); },
  'test-sound'() { beep(); toast('That\'s your timer sound.'); },
  async 'finish-workout'() {
    const d = S.doc, id = S.session.id; if (!d) return;
    d.paused_sec = Math.round(sessPausedMs() / 1000); d.ended_at = Math.floor(Date.now() / 1000);
    try { localStorage.removeItem(sessKey(id)); } catch (e) {}
    stopTimer(); S.focus = null; saveDoc(); bindDoc();
    toast('Workout saved. Great job!'); go('progress'); syncNow();
  },
  async 'discard-workout'() {
    if (!confirm('Discard this workout? It will not be saved.')) return;
    const d = S.doc; S.doc = null; persistDoc(); bindDoc(); paintBanner();
    if (d && d.session_id) { try { await DEL('/api/session/' + d.session_id, { quiet: true }); } catch (e) {} }
    stopTimer(); S.focus = null; go('today');
  },
  'timer-reset'() { stopTimer(); },
  'timer-adj'(el) { adjustTimer(+el.dataset.d); },
  'timer-pause'() { pauseResume(); },
  async 'body-save'() {
    const ft = parseFloat(val('b-ft')) || 0, inch = parseFloat(val('b-in')) || 0;
    try {
      await PUT('/api/profile', { age: val('b-age') || null, sex: val('b-sex'), height_in: ft || inch ? ft * 12 + inch : null, goal_weight_lb: val('b-goal') || null, activity: val('b-act'), workouts_per_week: +val('b-wpw') });
      const w = parseFloat(val('b-wt')); if (w) await POST('/api/weight', { weight_lb: w, date: todayStr() });
      toast('Saved.'); go('body');
    } catch (e) { fail(e); }
  },
  settings() { openPage(pageSettings, 'body'); },
  guide() { openPage(async () => pageGuide(), 'today'); },
  routine() { openPage(pageRoutine); },
  admin() { openPage(pageAdmin); },
  'pw-sheet'() { pwSheet(); },
  async 'save-name'() {
    try {
      const r = await PUT('/api/account', { display_name: val('dn') });
      S.me = r.user; toast(S.me.display_name ? 'Friends will now see "' + S.me.display_name + '".' : 'Friends will see your username.');
      pageSettings();
    } catch (e) { fail(e); }
  },
  recipes() { openPage(pageRecipes, 'food'); },
  'food-day'(el) { S.foodDate = shiftDate(S.foodDate, +el.dataset.d); go('food'); },
  'open-meal'(el) { S.openMeal = S.openMeal === el.dataset.m ? null : el.dataset.m; go('food'); },
  'add-food'(el) { openPage(() => pageAddFood(el.dataset.meal), 'food'); },
  fscope(el) { addCtx.scope = el.dataset.s; document.querySelectorAll('[data-a=fscope]').forEach((b) => b.classList.toggle('on', b === el)); runFoodSearch(); },
  'barcode-toggle'() { const c = $('#barcard'); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); const i = $('#fbar'); if (i) i.focus(); } },
  'pick-food'(el) { pickFood(el); },
  async 'confirm-food'(el) { const s = parseFloat(val('srv')); if (!s) return toast('Type how many servings.'); await POST('/api/diary', { food_id: +el.dataset.id, meal: addCtx.meal, servings: s, date: S.foodDate }); closeSheet(); closePage(); toast('Added to ' + addCtx.meal + '.'); S.openMeal = addCtx.meal; go('food'); },
  async 'del-entry'(el) { await DEL('/api/diary/' + el.dataset.id); go('food'); },
  async barcode() { const c = val('fbar').replace(/\s/g, ''); try { const r = await GET('/api/foods/barcode/' + c); $('#fres').innerHTML = foodRow(r.food); $('#fres').scrollIntoView({ behavior: 'smooth' }); } catch (e) { fail(e); } },
  'custom-food'() { customFoodSheet(); },
  'close-sheet'() { closeSheet(); },
  async 'tip-del'(el) { if (confirm('Delete this tip?')) { await DEL('/api/recipes/' + el.dataset.rid + '/tips/' + el.dataset.id); pageRecipe(el.dataset.rid); } },
  async 'food-del'(el) { if (confirm('Delete this food? Past diary entries keep their numbers.')) { await DEL('/api/foods/' + el.dataset.id); closeSheet(); toast('Food deleted.'); if (typeof runFoodSearch === 'function') runFoodSearch(); } },
  async 'hist-del'(el) { if (confirm('Delete this workout from your history?')) { await DEL('/api/session/' + el.dataset.id); toast('Workout deleted.'); go('history'); } },
  async 'save-custom'() {
    try {
      const r = await POST('/api/foods', { name: val('cf-name'), serving: val('cf-serv'), calories: val('cf-cal'), protein: val('cf-pro'), carbs: val('cf-carb'), fat: val('cf-fat') });
      await POST('/api/diary', { food_id: r.food.id, meal: addCtx.meal, servings: 1, date: S.foodDate }); closeSheet(); closePage(); toast('Added.'); S.openMeal = addCtx.meal; go('food');
    } catch (e) { fail(e); }
  },
  rfilter(el) { S.recipeFilter = el.dataset.f; pageRecipes(); },
  'recipe-new'() { recipeForm(); },
  'recipe-open'(el) { openPage(() => pageRecipe(el.dataset.id), 'food'); },
  'recipe-edit'(el) { recipeForm(el.dataset.id); },
  async 'recipe-save'(el) {
    const b = { title: val('r-title'), servings: val('r-serv'), minutes: val('r-min'), ingredients: val('r-ing'), steps: val('r-steps'), calories: val('r-cal'), protein: val('r-pro'), carbs: val('r-carb'), fat: val('r-fat'), shared: $('#r-share').checked };
    try { if (el.dataset.id) await PUT('/api/recipes/' + el.dataset.id, b); else await POST('/api/recipes', b); closeSheet(); toast('Recipe saved.'); if (S.tab === 'friends') go('friends'); else if (S.pageFn) S.pageFn(); else openPage(pageRecipes, 'food'); } catch (e) { fail(e); }
  },
  async 'recipe-del'(el) { if (confirm('Delete this recipe?')) { await DEL('/api/recipes/' + el.dataset.id); openPage(pageRecipes, 'food'); } },
  async 'recipe-heart'(el) { await POST('/api/recipes/' + el.dataset.id + '/cheer'); pageRecipes(); },
  async 'recipe-cheer'(el) { await POST('/api/recipes/' + el.dataset.id + '/cheer'); pageRecipe(el.dataset.id); },
  async 'tip-send'(el) { try { await POST('/api/recipes/' + el.dataset.id + '/tips', { text: val('tip') }); pageRecipe(el.dataset.id); } catch (e) { fail(e); } },
  async 'recipe-log-go'(el) { try { await POST('/api/recipes/' + el.dataset.id + '/log', { meal: el.dataset.meal, servings: 1, date: S.foodDate }); toast('Added to ' + el.dataset.meal + '.'); } catch (e) { fail(e); } },
  async 'friend-add'() { try { await POST('/api/friends/request', { username: val('fr-name') }); toast('Request sent.'); go('friends'); } catch (e) { fail(e); } },
  async 'friend-accept'(el) { await POST('/api/friends/' + el.dataset.id + '/accept'); go('friends'); },
  async 'friend-ignore'(el) { await POST('/api/friends/' + el.dataset.id + '/ignore'); go('friends'); },
  async 'friend-remove'(el) { if (confirm('Remove this friend?')) { await DEL('/api/friends/' + el.dataset.id); go('friends'); } },
  async cheer(el) { try { await POST('/api/feed/' + el.dataset.id + '/cheer'); go('friends'); } catch (e) { fail(e); } },
  'hist-month'(el) { const [Y, M] = S.histMonth.split('-').map(Number); const d = new Date(Y, M - 1 + +el.dataset.d, 1); S.histMonth = d.getFullYear() + '-' + pad(d.getMonth() + 1); go('history'); },
  async 'rt-move'(el) { await POST('/api/routine/' + el.dataset.id + '/move', { direction: el.dataset.dir }); pageRoutine(); },
  async 'rt-template'() { if (confirm('Replace the Beginner routine with the original 8 exercises?')) { await POST('/api/routine/template'); pageRoutine(); } },
  'ex-add'(el) { openExForm(el.dataset.m, null); },
  'ex-edit'(el) { openExForm(el.dataset.m, el.dataset.id); },
  'ex-kind'(el) { readExDraft(); const d = exCtx.d; if (d.kind !== el.dataset.k) { d.kind = el.dataset.k; if (d.kind === 'timed' && d.secs <= 180) d.secs = 600; if (d.kind === 'sets' && d.secs > 300) d.secs = 75; } renderExForm(); },
  'ex-chip'(el) { readExDraft(); exCtx.d.secs = +el.dataset.t; renderExForm(); },
  async 'ex-save'() {
    readExDraft(); const d = exCtx.d, timed = d.kind === 'timed';
    const body = { name: d.name, category: d.category, kind: d.kind, sets_total: timed ? 0 : d.sets, reps: timed ? '' : d.reps, seconds: d.secs, note: d.note };
    try {
      if (exCtx.mode === 'plan') { if (exCtx.id) await PUT('/api/routine/' + exCtx.id, body); else await POST('/api/routine', Object.assign({ plan: S.plan }, body)); }
      else {
        const toPlan = !!($('#ex-save') && $('#ex-save').checked), d = S.doc;
        if (exCtx.id) {
          const e = docEx(exCtx.id); const kindChanged = e.kind !== body.kind;
          Object.assign(e, { name: body.name, category: body.category, kind: body.kind, sets_total: body.sets_total, reps: body.reps, seconds: body.seconds, note: body.note });
          if (kindChanged) { e.sets_done = 0; e.completed = 0; e.logs = []; } else if (e.kind === 'sets') { e.sets_done = Math.min(e.sets_done, e.sets_total); e.completed = e.sets_done >= e.sets_total ? 1 : 0; }
          if (toPlan && e.routine_id) { try { await PUT('/api/routine/' + e.routine_id, body, { quiet: true, noqueue: true }); } catch (x) {} }
        } else {
          const id = d.nextId++, ne = { id, cid: 'e' + id, routine_id: null, name: body.name, kind: body.kind, sets_total: body.sets_total, sets_done: 0, completed: 0, category: body.category || 'Custom', note: body.note, reps: body.reps, seconds: body.seconds, logs: [], last: null, best: 0 };
          if (toPlan) { try { const r = await POST('/api/routine', Object.assign({ plan: S.plan }, body), { quiet: true, noqueue: true }); const nr = (r.routine || []).filter((x) => x.plan === S.plan).pop(); if (nr) ne.routine_id = nr.id; } catch (x) {} }
          d.exercises.push(ne);
        }
        saveDoc();
      }
      closeSheet(); toast(exCtx.id ? 'Saved.' : 'Added.'); refreshAfterEx();
    } catch (e) { fail(e); }
  },
  async 'ex-delete'() {
    if (!confirm(exCtx.mode === 'plan' ? 'Delete this exercise from the workout?' : 'Remove this exercise from today\'s workout?')) return;
    try { if (exCtx.mode === 'plan') await DEL('/api/routine/' + exCtx.id); else { S.doc.exercises = S.doc.exercises.filter((x) => x.id !== exCtx.id); bindDoc(); saveDoc(); } closeSheet(); refreshAfterEx(); } catch (e) { fail(e); }
  },
  'quick-timer'() { quickTimerSheet(); },
  'qt-go'(el) { closeSheet(); startTimer(+el.dataset.s, 'Quick timer', { kind: 'quick' }); refreshAfterEx(); },
  'qt-custom'() { const secs = (parseInt(val('qt-m'), 10) || 0) * 60 + (parseInt(val('qt-s'), 10) || 0); if (secs < 5) return toast('Pick at least 5 seconds.'); closeSheet(); startTimer(secs, 'Quick timer', { kind: 'quick' }); refreshAfterEx(); },
  'plan-pick'(el) { setPlan(el.dataset.p); refreshAfterEx(); },
  'plan-new'() { newPlanSheet(false); },
  'plan-copy'() { newPlanSheet(true); },
  async 'plan-create'() { try { const name = val('pn-name').trim(); await POST('/api/plans', { name, copy_from: $('#pn-copy').checked ? S.plan : '' }); setPlan(name); closeSheet(); toast('Workout created. Add your exercises.'); refreshAfterEx(); } catch (e) { fail(e); } },
  async 'plan-rename'() { const n = prompt('New name for this workout:', S.plan); if (n && n.trim() && n.trim() !== S.plan) { try { await PUT('/api/plans', { old: S.plan, new: n.trim() }); setPlan(n.trim()); refreshAfterEx(); } catch (e) { fail(e); } } },
  async 'plan-delete'() { if (!confirm('Delete the workout "' + S.plan + '" and all its exercises?')) return; try { const r = await DEL('/api/plans?name=' + encodeURIComponent(S.plan)); setPlan(r.plans[0]); refreshAfterEx(); } catch (e) { fail(e); } },
  'nu-role'(el) { nuRole = el.dataset.r; document.querySelectorAll('#nu-role button').forEach((b) => b.classList.toggle('on', b === el)); },
  async 'adm-add'() { try { await POST('/api/admin/users', { username: val('nu-name'), password: val('nu-pw'), role: nuRole }); toast('User created.'); pageAdmin(); } catch (e) { fail(e); } },
  'adm-menu'(el) {
    const d = el.dataset;
    sheet('<h2 class="title" style="font-size:20px">' + esc(d.name) + '</h2><div class="spacer"></div><div class="col gap8">' +
      '<button class="btn alt block" data-a="adm-role" data-id="' + d.id + '" data-role="' + (d.role === 'admin' ? 'user' : 'admin') + '">' + (d.role === 'admin' ? 'Make standard user' : 'Make admin') + '</button>' +
      '<button class="btn alt block" data-a="adm-pw" data-id="' + d.id + '">Reset password</button>' +
      '<button class="btn danger block" data-a="adm-off" data-id="' + d.id + '" data-off="' + (d.off === '1' ? 0 : 1) + '">' + (d.off === '1' ? 'Turn account on' : 'Turn account off') + '</button></div>');
  },
  async 'adm-role'(el) { try { await PUT('/api/admin/users/' + el.dataset.id, { role: el.dataset.role }); closeSheet(); pageAdmin(); } catch (e) { fail(e); } },
  async 'adm-off'(el) { try { await PUT('/api/admin/users/' + el.dataset.id, { disabled: el.dataset.off === '1' }); closeSheet(); pageAdmin(); } catch (e) { fail(e); } },
  async 'adm-pw'(el) { const p = prompt('New password for this person (8+ characters):'); if (p) { try { await PUT('/api/admin/users/' + el.dataset.id, { password: p }); closeSheet(); toast('Password changed.'); } catch (e) { fail(e); } } },
  async 'test-push'() { if (!S.pushOn) { toast('Turn on "Alert when rest ends" first.'); return; } try { await POST('/api/push/test'); toast('Sending in a few seconds. Lock your phone!'); } catch (e) { fail(e); } },
  async 'change-pw'() { try { await POST('/api/password', { current: val('pw-old'), new: val('pw-new') }); closeSheet(); toast('Password changed.'); } catch (e) { fail(e); } },
  async logout() { await POST('/api/logout'); S.me = null; S.doc = null; clearCache(); stopTimer(false); boot(); }
};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  if (el.tagName === 'A') ev.preventDefault();
  // a button inside a clickable row should not also trigger the row
  const inner = ev.target.closest('button[data-a]');
  const target = inner && inner !== el ? inner : el;
  const fn = actions[target.dataset.a];
  if (fn) { Promise.resolve(fn(target)).catch((e) => { if (e && e.userMessage) toast(e.userMessage); }); }
});
document.addEventListener('change', async (ev) => {
  const c = ev.target.getAttribute && ev.target.getAttribute('data-c'); if (!c) return;
  try {
    if (c === 'alert') { if (ev.target.checked) { const ok = await enablePush(); if (!ok) ev.target.checked = false; } else await disablePush(); }
    else if (c === 'nudge') await PUT('/api/profile', { nudge: ev.target.checked });
    else if (c === 'auto') { await PUT('/api/profile', { auto_rest: ev.target.checked }); }
    else if (c === 'restnote') { await PUT('/api/profile', { rest_note: ev.target.checked }); }
    const pr = await GET('/api/profile'); S.profile = pr.profile;
  } catch (e) { fail(e); }
});

window.GP = { slugFor, loadGuide, thumbFor, tools, S, actions, api, GET, POST, PUT, DEL, toast, fail, val, esc, I, IF, P, sheet, closeSheet, openPage, setPage, closePage, backBtn, go, todayStr, shiftDate, fmtDate, ago, r0, avatar, defaultMeal, debounce, ftIn, $, pad, clearCache, pollNotes, bell, rerunPage, lbs, mmss, outbox, flushOutbox };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
})();
