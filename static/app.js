/* GymPulse front end. Plain JavaScript, no build step, no outside libraries. */
(function () {
'use strict';

// ---------- helpers ----------
const $ = (s, r) => (r || document).querySelector(s);
const pad = (n) => (n < 10 ? '0' : '') + n;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const shiftDate = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); };
const fmtDate = (s) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const r0 = (n) => Math.round(n);
const ftIn = (inches) => inches ? Math.floor(inches / 12) + ' ft ' + Math.round(inches % 12) + ' in' : '';
const ago = (t) => { const s = Date.now() / 1000 - t; if (s < 90) return 'just now'; if (s < 3600) return r0(s / 60) + ' min ago'; if (s < 86400) return r0(s / 3600) + ' hr ago'; return r0(s / 86400) + ' days ago'; };

const S = { me: null, tab: 'today', foodDate: todayStr(), foodView: 'diary', friendView: 'board', histMonth: todayStr().slice(0, 7), profile: null, stats: null, session: null, exercises: [], routine: [] };
let timer = null; // {endAt, total, label}
try { timer = JSON.parse(localStorage.getItem('gp_timer') || 'null'); } catch (e) { timer = null; }
let tickHandle = null;

async function api(method, path, body) {
  const opt = { method, headers: { 'X-GymPulse': '1' }, credentials: 'same-origin' };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(path, opt); } catch (e) { toast('Can\'t reach the server. Check your connection.'); throw e; }
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (res.status === 401 && S.me) { S.me = null; boot(); throw new Error('signed out'); }
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong.'); e.userMessage = data.error || 'Something went wrong.'; throw e; }
  return data;
}
const GET = (p) => api('GET', p);
const POST = (p, b) => api('POST', p, b || {});
const PUT = (p, b) => api('PUT', p, b || {});
const DEL = (p) => api('DELETE', p);

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
const fail = (e) => { if (e && e.userMessage) toast(e.userMessage); };

function sheet(html) {
  closeSheet();
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'sheet';
  m.innerHTML = '<div class="sheet">' + html + '</div>';
  m.addEventListener('click', (e) => { if (e.target === m) closeSheet(); });
  document.body.appendChild(m);
  return m;
}
function closeSheet() { const m = $('#sheet'); if (m) m.remove(); }
const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };

function isStandalone() { return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches; }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }

// ---------- boot / login ----------
async function boot() {
  $('#nav').hidden = true;
  let me;
  try { me = await GET('/api/me'); } catch (e) { $('#app').innerHTML = '<div class="center login"><p class="muted">Can\'t reach the server.</p><button class="btn" data-a="reload">Try again</button></div>'; return; }
  if (me.needs_setup) return renderAuth(true);
  if (!me.user) return renderAuth(false);
  S.me = me.user;
  buildNav();
  go(S.tab);
}

function renderAuth(setup) {
  $('#nav').hidden = true;
  $('#app').innerHTML = '<div class="center login"><div class="logo">💪</div><h1 class="title">GymPulse</h1>' +
    '<p class="sub">' + (setup ? 'Welcome! Create the first account. It will be the admin.' : 'Sign in to keep going.') + '</p>' +
    '<div class="card"><div class="field"><label>Username</label><input id="u" autocapitalize="none" autocomplete="username" autocorrect="off"></div>' +
    '<div class="field"><label>Password' + (setup ? ' (at least 8 characters)' : '') + '</label><input id="p" type="password" autocomplete="' + (setup ? 'new-password' : 'current-password') + '"></div>' +
    '<div class="err" id="e"></div><button class="btn block" data-a="' + (setup ? 'setup' : 'login') + '">' + (setup ? 'Create admin account' : 'Sign in') + '</button></div></div>';
  const enter = (e) => { if (e.key === 'Enter') { const b = $('[data-a=setup],[data-a=login]'); if (b) b.click(); } };
  $('#u').addEventListener('keydown', enter); $('#p').addEventListener('keydown', enter);
}

// ---------- navigation ----------
const TABS = [['today', '🏋️', 'Today'], ['progress', '📈', 'Progress'], ['food', '🍎', 'Food'], ['friends', '👥', 'Friends'], ['history', '🗓️', 'History'], ['more', '⚙️', 'More']];
function buildNav() {
  const n = $('#nav');
  n.innerHTML = '<div class="in">' + TABS.map((t) => '<button data-a="tab" data-t="' + t[0] + '" id="nav-' + t[0] + '"><span class="i">' + t[1] + '</span>' + t[2] + '</button>').join('') + '</div>';
  n.hidden = false;
}
function go(tab) {
  S.tab = tab;
  TABS.forEach((t) => { const b = $('#nav-' + t[0]); if (b) b.classList.toggle('on', t[0] === tab); });
  window.scrollTo(0, 0);
  const fn = { today: viewToday, progress: viewProgress, food: viewFood, friends: viewFriends, history: viewHistory, more: viewMore }[tab];
  fn().catch((e) => { if (e.message !== 'signed out') { $('#app').innerHTML = '<div class="card">Something went wrong loading this page. <button class="btn sm" data-a="reload">Reload</button></div>'; } });
}
const setApp = (h) => { $('#app').innerHTML = h; };

// ---------- timer ----------
function saveTimer() { try { if (timer) localStorage.setItem('gp_timer', JSON.stringify(timer)); else localStorage.removeItem('gp_timer'); } catch (e) {} }
function startTimer(seconds, label, opts) {
  opts = opts || {};
  timer = { endAt: Date.now() + seconds * 1000, total: seconds, label: label || 'Rest', paused: false, alerted: false };
  saveTimer();
  if (!opts.silent) {
    POST('/api/timer', { seconds, title: (label || 'Rest') + ' is over', body: 'Time to get going again.' }).catch(() => {});
    if (S.profile && S.profile.apple_timer && !opts.noShortcut) {
      const name = encodeURIComponent(S.profile.shortcut_name || 'GymPulse Timer');
      // Optional hand-off to an Apple Shortcut that starts a Clock timer. It briefly leaves the app.
      setTimeout(() => { window.location.href = 'shortcuts://run-shortcut?name=' + name + '&input=text&text=' + seconds; }, 150);
    }
  }
  ensureTick();
  const slot = $('#rest-slot'); if (slot) slot.innerHTML = timerBox();
}
function stopTimer(cancelServer) {
  timer = null; saveTimer();
  if (cancelServer !== false) DEL('/api/timer').catch(() => {});
  paintTimer();
}
function adjustTimer(delta) {
  if (!timer) return;
  const left = Math.max(0, (timer.paused ? timer.leftMs : timer.endAt - Date.now()) / 1000) + delta;
  const secs = Math.max(5, left);
  if (timer.paused) { timer.leftMs = secs * 1000; saveTimer(); paintTimer(); return; }
  startTimer(secs, timer.label, { noShortcut: true });
}
function pauseResume() {
  if (!timer) return;
  if (timer.paused) { timer.endAt = Date.now() + timer.leftMs; timer.paused = false; saveTimer(); POST('/api/timer', { seconds: Math.ceil(timer.leftMs / 1000), title: timer.label + ' is over', body: 'Time to get going again.' }).catch(() => {}); }
  else { timer.leftMs = Math.max(0, timer.endAt - Date.now()); timer.paused = true; saveTimer(); DEL('/api/timer').catch(() => {}); }
  paintTimer();
}
function ensureTick() { if (!tickHandle) tickHandle = setInterval(paintTimer, 250); }
function beep() {
  try {
    const A = window.AudioContext || window.webkitAudioContext; const c = new A();
    [0, 0.25, 0.5].forEach((d) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.25, c.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d + 0.2); o.start(c.currentTime + d); o.stop(c.currentTime + d + 0.22); });
  } catch (e) {}
  try { navigator.vibrate && navigator.vibrate([300, 120, 300]); } catch (e) {}
}
function timerBox() {
  if (!timer) return '';
  const left = timer.paused ? timer.leftMs / 1000 : (timer.endAt - Date.now()) / 1000;
  const over = left <= 0;
  return '<div class="rest' + (over ? ' over' : '') + '" id="rest"><div class="row between"><div class="label" style="margin:0">' + esc(timer.label) + '</div>' +
    '<button class="btn alt sm" data-a="timer-reset">' + (over ? 'Dismiss' : 'Cancel') + '</button></div>' +
    '<div class="time" id="rest-time">' + (over ? 'Go!' : fmtTime(Math.ceil(left))) + '</div>' +
    '<div class="progressbar"><i id="rest-bar" style="width:' + Math.max(0, Math.min(100, (1 - Math.max(0, left) / timer.total) * 100)) + '%"></i></div>' +
    (over ? '' : '<div class="pills"><button class="btn alt sm" data-a="timer-adj" data-d="-15">−15s</button><button class="btn alt sm" data-a="timer-adj" data-d="15">+15s</button><button class="btn alt sm" data-a="timer-adj" data-d="60">+1m</button><button class="btn alt sm" data-a="timer-pause">' + (timer.paused ? 'Resume' : 'Pause') + '</button></div>') + '</div>';
}
function paintTimer() {
  const box = $('#rest-slot');
  if (!timer) { if (box) box.innerHTML = ''; return; }
  const left = timer.paused ? timer.leftMs / 1000 : (timer.endAt - Date.now()) / 1000;
  if (left <= 0 && !timer.alerted && !timer.paused) { timer.alerted = true; saveTimer(); beep(); if (box) box.innerHTML = timerBox(); return; }
  if (box) {
    const t = $('#rest-time');
    if (!t || (left <= 0) !== !!$('#rest.over')) { box.innerHTML = timerBox(); return; }
    if (left > 0) { t.textContent = fmtTime(Math.ceil(left)); const b = $('#rest-bar'); if (b) b.style.width = Math.min(100, (1 - left / timer.total) * 100) + '%'; }
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) paintTimer(); });
if (timer) ensureTick();

// ---------- Today ----------
async function loadToday() {
  const [prof, act, rt, prog] = await Promise.all([GET('/api/profile'), GET('/api/session/active'), GET('/api/routine'), GET('/api/progress?today=' + todayStr())]);
  S.profile = prof.profile; S.stats = prof.stats; S.session = act.session; S.exercises = act.exercises; S.routine = rt.routine; S.prog = prog;
}
function greet() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function motivation(p) {
  const w = p.week.workouts, goal = p.workouts_per_week || 3;
  if (p.streak >= 3) return p.streak + ' days in a row. Look at you go!';
  if (w >= goal) return 'You hit your weekly goal. Awesome work!';
  if (w > 0) return w + ' of ' + goal + ' workouts done this week. ' + (goal - w) + ' to go.';
  return 'A short workout still counts. Let\'s get your first one in this week.';
}
async function viewToday() {
  await loadToday();
  const p = S.prog, s = S.session;
  let h = '<div class="row between"><div><h1 class="title">' + greet() + ', ' + esc(S.me.username) + '</h1><p class="sub">' + esc(motivation(p)) + '</p></div></div>';
  if (isIOS() && !isStandalone()) h += '<div class="card install"><b>Install GymPulse on your iPhone</b><div class="small muted" style="margin-top:4px">Tap the Share button in Safari, then "Add to Home Screen". It opens full screen and can send you timer alerts.</div></div>';
  h += '<div id="rest-slot">' + timerBox() + '</div>';
  if (!s) {
    h += '<div class="card"><div class="label">Today\'s plan</div>' + (S.routine.length ? S.routine.map((r, i) => '<div class="item"><div class="num ex" style="display:block"><span class="chip">' + (i + 1) + '</span></div><div class="grow"><div class="name">' + esc(r.name) + '</div><div class="small muted">' + esc(r.kind === 'timed' ? fmtTime(r.seconds) + ' timed' : r.sets_total + ' sets · rest ' + fmtTime(r.seconds)) + '</div></div></div>').join('') : '<p class="muted">Your routine is empty. Add exercises under More → My routine.</p>') +
      '</div><button class="btn block" data-a="start-workout"' + (S.routine.length ? '' : ' disabled') + '>Start workout</button>';
  } else {
    const done = S.exercises.filter((e) => e.completed).length;
    h += '<div class="card"><div class="row between"><div class="label" style="margin:0">Workout in progress</div><span class="chip lime">' + done + ' / ' + S.exercises.length + ' done</span></div><div class="spacer"></div><div class="progressbar"><i style="width:' + (S.exercises.length ? done / S.exercises.length * 100 : 0) + '%"></i></div></div>';
    S.exercises.forEach((e, i) => {
      const r = S.routine.find((x) => x.id === e.routine_id) || {};
      const secs = r.seconds || (e.kind === 'timed' ? 300 : 75);
      h += '<div class="card"><div class="ex' + (e.completed ? ' done' : '') + '"><div class="num">' + (e.completed ? '✓' : i + 1) + '</div><div class="grow"><div class="name">' + esc(e.name) + '</div><div class="small muted">' + esc(r.note || '') + '</div>';
      if (e.kind === 'sets') {
        h += '<div class="setrow">';
        for (let n = 1; n <= e.sets_total; n++) h += '<button class="setbtn' + (n <= e.sets_done ? ' on' : '') + '" data-a="set" data-id="' + e.id + '" data-n="' + n + '" data-done="' + e.sets_done + '" data-secs="' + secs + '" data-name="' + esc(e.name) + '">' + n + '</button>';
        h += '</div><div class="small muted" style="margin-top:6px">Tap a set when you finish it. Rest starts automatically.</div>';
      } else {
        h += '<div class="setrow"><button class="btn cyan sm" data-a="timed-start" data-secs="' + secs + '" data-name="' + esc(e.name) + '">Start ' + fmtTime(secs) + '</button><button class="btn alt sm" data-a="timed-done" data-id="' + e.id + '" data-v="' + (e.completed ? 0 : 1) + '">' + (e.completed ? 'Undo' : 'Mark done') + '</button></div>';
      }
      h += '</div></div></div>';
    });
    h += '<button class="btn block" data-a="finish-workout">Finish workout</button><div class="spacer"></div><button class="btn danger block" data-a="discard-workout">Discard this workout</button>';
  }
  setApp(h);
  ensureTick();
}

// ---------- Progress ----------
function weightChart(ws, goal) {
  if (ws.length < 2) return '<p class="muted small">Log your weight a few times and your chart will show up here.</p>';
  const W = 320, H = 150, L = 34, R = 8, T = 10, B = 20;
  let vals = ws.map((x) => x.weight_lb); if (goal) vals = vals.concat([goal]);
  let lo = Math.min.apply(null, vals) - 3, hi = Math.max.apply(null, vals) + 3;
  const x = (i) => L + (W - L - R) * (i / (ws.length - 1)); const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const pts = ws.map((p, i) => x(i).toFixed(1) + ',' + y(p.weight_lb).toFixed(1)).join(' ');
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Weight over time">';
  [lo, (lo + hi) / 2, hi].forEach((v) => { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#1E293B"/><text x="2" y="' + (y(v) + 4) + '" fill="#94A3B8" font-size="10">' + r0(v) + '</text>'; });
  if (goal) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(goal) + '" y2="' + y(goal) + '" stroke="#FBBF24" stroke-dasharray="4 4"/><text x="' + (W - R) + '" y="' + (y(goal) - 4) + '" fill="#FBBF24" font-size="10" text-anchor="end">goal ' + r0(goal) + '</text>';
  s += '<polyline fill="none" stroke="#A3E635" stroke-width="3" stroke-linejoin="round" points="' + pts + '"/>';
  const last = ws[ws.length - 1]; s += '<circle cx="' + x(ws.length - 1) + '" cy="' + y(last.weight_lb) + '" r="4.5" fill="#22D3EE"/></svg>';
  return s;
}
function bmiLabel(b) { return b < 18.5 ? 'Under the healthy range' : b < 25 ? 'In the healthy range' : b < 30 ? 'A little above the healthy range' : 'Above the healthy range'; }
async function viewProgress() {
  const [prog, prof] = await Promise.all([GET('/api/progress?today=' + todayStr()), GET('/api/profile')]);
  S.profile = prof.profile; S.stats = prof.stats;
  const st = prog.stats, w = prog.week, goal = prog.workouts_per_week || 3, td = todayStr();
  const names = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  let h = '<h1 class="title">Progress</h1><p class="sub">' + esc(motivation(prog)) + '</p>';
  h += '<div class="card"><div class="two"><div><div class="label">Streak</div><div class="big lime">' + prog.streak + '</div><div class="small muted">day' + (prog.streak === 1 ? '' : 's') + ' in a row</div></div><div><div class="label">All time</div><div class="big cyan">' + prog.total_sessions + '</div><div class="small muted">workouts</div></div></div></div>';
  h += '<div class="card"><div class="label">This week</div><div class="week">' + w.days.map((d, i) => '<div>' + names[i] + '<i class="' + (d.worked ? 'on ' : '') + (d.date === td ? 'today' : '') + '"></i></div>').join('') + '</div>' +
    '<div class="spacer"></div><div class="bar"><div class="t"><span>Workouts (goal ' + goal + ')</span><span>' + w.workouts + '</span></div><div class="progressbar"><i style="width:' + Math.min(100, w.workouts / goal * 100) + '%"></i></div></div>' +
    '<div class="bar"><div class="t"><span>Active minutes (CDC suggests 150)</span><span>' + w.minutes + '</span></div><div class="progressbar"><i style="width:' + Math.min(100, w.minutes / 150 * 100) + '%"></i></div></div>' +
    '<div class="bar"><div class="t"><span>Strength days (CDC suggests 2)</span><span>' + w.strength_days + '</span></div><div class="progressbar"><i style="width:' + Math.min(100, w.strength_days / 2 * 100) + '%"></i></div></div></div>';
  h += '<div class="card"><div class="row between"><div class="label" style="margin:0">Body</div><button class="btn alt sm" data-a="body-edit">Edit my stats</button></div><div class="spacer"></div>';
  if (st.weight_lb) {
    h += '<div class="row between"><div><div class="big">' + st.weight_lb + ' <span class="small muted">lb</span></div><div class="small muted">current weight</div></div>' + (st.bmi ? '<div style="text-align:right"><div class="big cyan">' + st.bmi + '</div><div class="small muted">BMI</div></div>' : '') + '</div>';
    if (st.bmi) h += '<div class="small" style="margin-top:8px">' + bmiLabel(st.bmi) + '. For your height (' + ftIn(prof.profile.height_in) + ') a healthy weight is about <b>' + r0(st.healthy_min) + '–' + r0(st.healthy_max) + ' lb</b>.</div>';
    if (st.lbs_to_goal) h += '<div class="small muted" style="margin-top:6px">' + st.lbs_to_goal + ' lb from your goal of ' + prof.profile.goal_weight_lb + ' lb. At a safe pace of about 1 lb a week, that is roughly ' + st.weeks_to_goal + ' weeks.</div>';
  } else h += '<p class="muted small">Add your height and weight to see your healthy range.</p>';
  h += '<div class="spacer"></div>' + weightChart(prog.weights, prog.goal_weight_lb) + '<div class="spacer"></div>' +
    '<div class="row"><input id="wt" type="number" inputmode="decimal" step="0.1" placeholder="Today\'s weight (lb)"><button class="btn" data-a="log-weight">Save</button></div></div>';
  if (st.personalized) h += '<div class="card"><div class="label">Your daily calories</div><div class="two"><div><div class="big lime">' + st.goal_cal + '</div><div class="small muted">to reach your goal</div></div><div><div class="big">' + st.stay_cal + '</div><div class="small muted">to stay the same</div></div></div><div class="small muted" style="margin-top:8px">An estimate from the Mifflin-St Jeor formula. A loss of 1–2 lb per week is considered safe.</div></div>';
  setApp(h);
}
function bodyForm() {
  const p = S.profile;
  const ft = p.height_in ? Math.floor(p.height_in / 12) : '', inch = p.height_in ? Math.round(p.height_in % 12) : '';
  sheet('<h2 class="title" style="font-size:22px">My body stats</h2><p class="sub">Used only to estimate a healthy weight and daily calories.</p>' +
    '<div class="two field"><div><label>Age</label><input id="b-age" type="number" inputmode="numeric" value="' + esc(p.age || '') + '"></div><div><label>Sex</label><select id="b-sex"><option value="">Choose</option><option value="female"' + (p.sex === 'female' ? ' selected' : '') + '>Female</option><option value="male"' + (p.sex === 'male' ? ' selected' : '') + '>Male</option></select></div></div>' +
    '<div class="two field"><div><label>Height (ft)</label><input id="b-ft" type="number" inputmode="numeric" value="' + esc(ft) + '"></div><div><label>Height (in)</label><input id="b-in" type="number" inputmode="numeric" value="' + esc(inch) + '"></div></div>' +
    '<div class="field"><label>Goal weight (lb)</label><input id="b-goal" type="number" inputmode="decimal" value="' + esc(p.goal_weight_lb || '') + '"></div>' +
    '<div class="field"><label>How active are you day to day?</label><select id="b-act"><option value="sedentary">Mostly sitting</option><option value="light">A little (some walking)</option><option value="moderate">Moderate (on my feet a lot)</option><option value="very">Very active</option></select></div>' +
    '<div class="field"><label>Workouts per week I\'m aiming for</label><select id="b-wpw">' + [1, 2, 3, 4, 5, 6, 7].map((n) => '<option' + (p.workouts_per_week === n ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
    '<button class="btn block" data-a="body-save">Save</button>');
  $('#b-act').value = p.activity || 'light';
}

// ---------- Food ----------
async function viewFood() {
  if (S.foodView === 'recipes') return viewRecipes();
  const d = await GET('/api/diary?date=' + S.foodDate);
  const t = d.totals, g = d.goals, left = g.calories - t.calories, pct = Math.min(1, t.calories / g.calories);
  const C = 2 * Math.PI * 62;
  let h = '<h1 class="title">Food</h1>' + foodTabs() +
    '<div class="row between" style="margin-bottom:10px"><button class="btn alt sm" data-a="food-day" data-d="-1">‹</button><b>' + (S.foodDate === todayStr() ? 'Today' : fmtDate(S.foodDate)) + '</b><button class="btn alt sm" data-a="food-day" data-d="1">›</button></div>' +
    '<div class="card"><div class="row"><div class="ring"><svg width="150" height="150" viewBox="0 0 150 150"><circle cx="75" cy="75" r="62" stroke="#1E293B" stroke-width="14" fill="none"/><circle cx="75" cy="75" r="62" stroke="' + (left < 0 ? '#FB7185' : '#A3E635') + '" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '"/></svg><div class="mid"><div class="big" style="font-size:28px">' + r0(Math.abs(left)) + '</div><div class="small muted">cal ' + (left < 0 ? 'over' : 'left') + '</div></div></div>' +
    '<div class="grow">' + [['Protein', t.protein, g.protein, 'cyan'], ['Carbs', t.carbs, g.carbs, 'amber'], ['Fat', t.fat, g.fat, 'rose']].map((m) => '<div class="bar"><div class="t"><span>' + m[0] + '</span><span class="muted">' + r0(m[1]) + ' / ' + m[2] + ' g</span></div><div class="progressbar"><i style="width:' + Math.min(100, m[1] / m[2] * 100) + '%"></i></div></div>').join('') + '</div></div>' +
    '<div class="small muted" style="margin-top:10px">Goal: ' + g.calories + ' cal a day' + (g.personalized ? '' : ' (add your body stats under Progress for a personal goal)') + '. Eaten: ' + r0(t.calories) + ' cal.</div></div>';
  ['breakfast', 'lunch', 'dinner', 'snacks'].forEach((m) => {
    const es = d.entries.filter((e) => e.meal === m);
    h += '<div class="card"><div class="row between"><div><b style="text-transform:capitalize">' + m + '</b> <span class="small muted">' + r0(es.reduce((a, e) => a + e.calories, 0)) + ' cal</span></div><button class="btn alt sm" data-a="add-food" data-meal="' + m + '">+ Add</button></div>' +
      es.map((e) => '<div class="item"><div class="grow"><div>' + esc(e.name) + '</div><div class="small muted">' + e.servings + ' × ' + esc(e.serving) + '</div></div><div>' + r0(e.calories) + '</div><button class="btn danger sm" data-a="del-entry" data-id="' + e.id + '" aria-label="Remove">✕</button></div>').join('') + '</div>';
  });
  setApp(h);
}
function foodTabs() { return '<div class="tabs"><button data-a="food-view" data-v="diary" class="' + (S.foodView === 'diary' ? 'on' : '') + '">My diary</button><button data-a="food-view" data-v="recipes" class="' + (S.foodView === 'recipes' ? 'on' : '') + '">Recipes</button></div>'; }

let addCtx = { meal: 'breakfast', scope: 'all' };
function addFoodSheet(meal) {
  addCtx = { meal, scope: 'all' };
  sheet('<h2 class="title" style="font-size:22px">Add to ' + esc(meal) + '</h2><div class="spacer"></div>' +
    '<input id="fq" placeholder="Search foods, like banana or chicken" autocomplete="off"><div class="tabs" style="margin-top:10px"><button data-a="fscope" data-s="all" class="on">All</button><button data-a="fscope" data-s="recent">Recent</button><button data-a="fscope" data-s="mine">My foods</button></div>' +
    '<div id="fres"></div><div class="hr"></div><div class="label">Packaged food barcode</div><div class="row"><input id="fbar" inputmode="numeric" placeholder="Type the number under the barcode"><button class="btn alt" data-a="barcode">Look up</button></div><div class="small muted" style="margin-top:6px">Uses the free Open Food Facts database. Your server needs internet for this.</div>' +
    '<div class="hr"></div><button class="btn alt block" data-a="custom-food">Can\'t find it? Add your own food</button>');
  $('#fq').addEventListener('input', debounce(runFoodSearch, 250));
  runFoodSearch();
}
function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
async function runFoodSearch() {
  const q = val('fq');
  const r = await GET('/api/foods/search?scope=' + addCtx.scope + '&q=' + encodeURIComponent(q));
  const box = $('#fres'); if (!box) return;
  box.innerHTML = r.foods.length ? r.foods.map(foodRow).join('') : '<p class="muted small" style="margin-top:10px">Nothing found. Try another word, or add your own food below.</p>';
}
const foodRow = (f) => '<div class="item" data-a="pick-food" data-id="' + f.id + '" data-name="' + esc(f.name) + '" data-serving="' + esc(f.serving) + '" data-cal="' + f.calories + '" style="cursor:pointer"><div class="grow"><div>' + esc(f.name) + (f.brand ? ' <span class="muted small">· ' + esc(f.brand) + '</span>' : '') + '</div><div class="small muted">' + esc(f.serving) + '</div></div><div><b>' + r0(f.calories) + '</b> <span class="small muted">cal</span></div></div>';
function pickFood(el) {
  const d = el.dataset;
  sheet('<h2 class="title" style="font-size:22px">' + esc(d.name) + '</h2><p class="sub">' + esc(d.serving) + ' = ' + r0(d.cal) + ' cal</p>' +
    '<div class="field"><label>How many servings?</label><input id="srv" type="number" step="0.25" inputmode="decimal" value="1"></div>' +
    '<button class="btn block" data-a="confirm-food" data-id="' + d.id + '">Add to ' + esc(addCtx.meal) + '</button>');
}
function customFoodSheet() {
  sheet('<h2 class="title" style="font-size:22px">Add your own food</h2><p class="sub">Copy these numbers from the nutrition label.</p>' +
    '<div class="field"><label>Name</label><input id="cf-name"></div><div class="field"><label>Serving size (like "1 cup" or "2 slices")</label><input id="cf-serv" value="1 serving"></div>' +
    '<div class="two field"><div><label>Calories</label><input id="cf-cal" type="number" inputmode="decimal"></div><div><label>Protein (g)</label><input id="cf-pro" type="number" inputmode="decimal"></div></div>' +
    '<div class="two field"><div><label>Carbs (g)</label><input id="cf-carb" type="number" inputmode="decimal"></div><div><label>Fat (g)</label><input id="cf-fat" type="number" inputmode="decimal"></div></div>' +
    '<button class="btn block" data-a="save-custom">Save and add</button>');
}

// recipes
async function viewRecipes() {
  const r = await GET('/api/recipes');
  let h = '<h1 class="title">Food</h1>' + foodTabs() + '<button class="btn block" data-a="recipe-new">+ Share a recipe</button><div class="spacer"></div>';
  if (!r.recipes.length) h += '<div class="card muted">No recipes yet. Add your favorite healthy meal and your friends will see it.</div>';
  r.recipes.forEach((x) => {
    h += '<div class="card" data-a="recipe-open" data-id="' + x.id + '" style="cursor:pointer"><div class="row between"><b>' + esc(x.title) + '</b><span class="chip lime">' + r0(x.calories) + ' cal</span></div><div class="small muted">by ' + (x.mine ? 'you' : esc(x.owner)) + (x.minutes ? ' · ' + x.minutes + ' min' : '') + ' · serves ' + x.servings + ' · ' + x.cheers + ' 👏</div></div>';
  });
  setApp(h);
}
function recipeForm(r) {
  r = r || { title: '', servings: 2, minutes: 20, ingredients: '', steps: '', calories: '', protein: '', carbs: '', fat: '', shared: 1 };
  sheet('<h2 class="title" style="font-size:22px">' + (r.id ? 'Edit recipe' : 'Share a recipe') + '</h2><div class="spacer"></div>' +
    '<div class="field"><label>Title</label><input id="r-title" value="' + esc(r.title) + '"></div>' +
    '<div class="two field"><div><label>Servings</label><input id="r-serv" type="number" value="' + esc(r.servings) + '"></div><div><label>Minutes</label><input id="r-min" type="number" value="' + esc(r.minutes) + '"></div></div>' +
    '<div class="field"><label>Ingredients (one per line)</label><textarea id="r-ing">' + esc(r.ingredients) + '</textarea></div>' +
    '<div class="field"><label>Steps</label><textarea id="r-steps">' + esc(r.steps) + '</textarea></div>' +
    '<div class="label">Nutrition per serving (optional)</div><div class="two field"><div><label>Calories</label><input id="r-cal" type="number" value="' + esc(r.calories) + '"></div><div><label>Protein (g)</label><input id="r-pro" type="number" value="' + esc(r.protein) + '"></div></div>' +
    '<div class="two field"><div><label>Carbs (g)</label><input id="r-carb" type="number" value="' + esc(r.carbs) + '"></div><div><label>Fat (g)</label><input id="r-fat" type="number" value="' + esc(r.fat) + '"></div></div>' +
    '<label class="row small" style="margin-bottom:12px"><input type="checkbox" id="r-share" style="width:auto"' + (r.shared ? ' checked' : '') + '> Share with my friends</label>' +
    '<button class="btn block" data-a="recipe-save" data-id="' + (r.id || '') + '">Save recipe</button>');
}
async function recipeDetail(id) {
  const d = await GET('/api/recipes/' + id), r = d.recipe;
  const lines = (t) => esc(t).split('\n').filter((x) => x.trim()).map((x) => '<li>' + x + '</li>').join('');
  window.__recipe = r;
  sheet('<h2 class="title" style="font-size:22px">' + esc(r.title) + '</h2><p class="sub">by ' + (r.mine ? 'you' : esc(r.owner)) + ' · serves ' + r.servings + (r.minutes ? ' · ' + r.minutes + ' min' : '') + '</p>' +
    (r.calories ? '<div class="row wrap" style="margin-bottom:12px"><span class="chip lime">' + r0(r.calories) + ' cal</span><span class="chip cyan">' + r0(r.protein) + ' g protein</span><span class="chip amber">' + r0(r.carbs) + ' g carbs</span><span class="chip">' + r0(r.fat) + ' g fat</span></div>' : '') +
    (r.ingredients ? '<div class="label">Ingredients</div><ul>' + lines(r.ingredients) + '</ul>' : '') + (r.steps ? '<div class="label">Steps</div><ol>' + lines(r.steps) + '</ol>' : '') +
    '<div class="row wrap"><button class="btn alt sm" data-a="recipe-cheer" data-id="' + r.id + '">' + (r.cheered ? '👏 Cheered' : '👏 Cheer') + ' (' + r.cheers + ')</button>' +
    (r.calories ? '<button class="btn alt sm" data-a="recipe-log" data-id="' + r.id + '">Add to my diary</button>' : '') + (r.mine ? '<button class="btn alt sm" data-a="recipe-edit">Edit</button><button class="btn danger sm" data-a="recipe-del" data-id="' + r.id + '">Delete</button>' : '') + '</div>' +
    '<div class="hr"></div><div class="label">Tips from friends</div>' + (d.tips.length ? d.tips.map((t) => '<div class="item"><div class="av">' + esc(t.username[0].toUpperCase()) + '</div><div class="grow"><b>' + esc(t.username) + '</b><div class="small">' + esc(t.text) + '</div></div></div>').join('') : '<p class="muted small">No tips yet.</p>') +
    '<div class="row" style="margin-top:10px"><input id="tip" placeholder="Share a tip (like a swap or a shortcut)"><button class="btn" data-a="tip-send" data-id="' + r.id + '">Send</button></div>');
}

// ---------- Friends ----------
async function viewFriends() {
  let h = '<h1 class="title">Friends</h1><div class="tabs">' + [['board', 'This week'], ['feed', 'Activity'], ['people', 'Friends']].map((t) => '<button data-a="friend-view" data-v="' + t[0] + '" class="' + (S.friendView === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>';
  if (S.friendView === 'board') {
    const l = (await GET('/api/leaderboard?today=' + todayStr())).leaders;
    h += '<div class="card">' + l.map((u, i) => '<div class="item"><div class="num ex" style="display:block;width:22px;font-weight:800;color:var(--muted)">' + (i + 1) + '</div><div class="av">' + esc(u.username[0].toUpperCase()) + '</div><div class="grow"><b>' + esc(u.username) + (u.me ? ' (you)' : '') + '</b><div class="small muted">' + u.streak + '-day streak</div></div><span class="chip lime">' + u.workouts + ' workout' + (u.workouts === 1 ? '' : 's') + '</span></div>').join('') + '</div>' + (l.length < 2 ? '<p class="muted small">Add a friend to see how you stack up.</p>' : '');
  } else if (S.friendView === 'feed') {
    const ev = (await GET('/api/feed')).events;
    h += ev.length ? ev.map((e) => '<div class="card"><div class="row"><div class="av">' + esc(e.username[0].toUpperCase()) + '</div><div class="grow"><b>' + esc(e.username) + '</b> ' + esc(e.text) + '<div class="small muted">' + ago(e.created_at) + '</div></div>' + (e.user_id !== S.me.id ? '<button class="btn alt sm" data-a="cheer" data-id="' + e.id + '">' + (e.cheered ? '👏 Cheered' : '👏 Cheer') + (e.cheers ? ' ' + e.cheers : '') + '</button>' : (e.cheers ? '<span class="chip">👏 ' + e.cheers + '</span>' : '')) + '</div></div>').join('') : '<div class="card muted">Nothing yet. Finish a workout to be the first post!</div>';
  } else {
    const f = await GET('/api/friends');
    h += '<div class="card"><div class="label">Add a friend</div><div class="row"><input id="fr-name" autocapitalize="none" placeholder="Their username"><button class="btn" data-a="friend-add">Send</button></div></div>';
    if (f.incoming.length) h += '<div class="card"><div class="label">Requests</div>' + f.incoming.map((x) => '<div class="item"><div class="grow"><b>' + esc(x.username) + '</b></div><button class="btn sm" data-a="friend-accept" data-id="' + x.id + '">Accept</button><button class="btn alt sm" data-a="friend-ignore" data-id="' + x.id + '">Ignore</button></div>').join('') + '</div>';
    if (f.outgoing.length) h += '<div class="card"><div class="label">Waiting for a reply</div>' + f.outgoing.map((x) => '<div class="item"><div class="grow">' + esc(x.username) + '</div><button class="btn alt sm" data-a="friend-ignore" data-id="' + x.id + '">Cancel</button></div>').join('') + '</div>';
    h += '<div class="card"><div class="label">Your friends</div>' + (f.friends.length ? f.friends.map((x) => '<div class="item"><div class="av">' + esc(x.username[0].toUpperCase()) + '</div><div class="grow"><b>' + esc(x.username) + '</b></div><button class="btn danger sm" data-a="friend-remove" data-id="' + x.id + '">Remove</button></div>').join('') : '<p class="muted small">No friends yet.</p>') + '</div>';
  }
  setApp(h);
}

// ---------- History ----------
async function viewHistory() {
  const d = await GET('/api/history?month=' + S.histMonth);
  const [Y, M] = S.histMonth.split('-').map(Number);
  const first = new Date(Y, M - 1, 1), days = new Date(Y, M, 0).getDate(), lead = (first.getDay() + 6) % 7;
  let cal = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x) => '<span>' + x + '</span>').join('');
  for (let i = 0; i < lead; i++) cal += '<b class="none"></b>';
  for (let n = 1; n <= days; n++) cal += '<b class="' + (d.days.indexOf(Y + '-' + pad(M) + '-' + pad(n)) >= 0 ? 'on' : '') + '">' + n + '</b>';
  let h = '<h1 class="title">History</h1><p class="sub">' + d.month_sessions + ' workout day' + (d.month_sessions === 1 ? '' : 's') + ' this month</p><div class="card"><div class="row between" style="margin-bottom:10px"><button class="btn alt sm" data-a="hist-month" data-d="-1">‹</button><b>' + first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + '</b><button class="btn alt sm" data-a="hist-month" data-d="1">›</button></div><div class="cal">' + cal + '</div></div>';
  h += '<div class="card"><div class="label">Recent workouts</div>' + (d.recent.length ? d.recent.map((s) => '<div class="item"><div class="grow"><b>' + fmtDate(s.date) + '</b><div class="small muted">' + s.done + ' of ' + s.total + ' exercises · ' + s.sets + ' sets</div></div><span class="chip cyan">' + r0((s.duration_sec || 0) / 60) + ' min</span></div>').join('') : '<p class="muted small">Finish your first workout and it will show up here.</p>') + '</div>';
  setApp(h);
}

// ---------- More ----------
async function viewMore() {
  const prof = await GET('/api/profile'); S.profile = prof.profile; const p = prof.profile;
  let h = '<h1 class="title">More</h1><p class="sub">Signed in as ' + esc(S.me.username) + (S.me.role === 'admin' ? ' · admin' : '') + '</p>';
  h += '<div class="card">' + [['guide', '📖', 'Start here (how the gym works)'], ['body-edit', '📏', 'My body stats'], ['routine', '📋', 'My routine']].concat(S.me.role === 'admin' ? [['admin', '🛠️', 'Admin: people and backup']] : []).map((x) => '<div class="item" data-a="' + x[0] + '" style="cursor:pointer"><span style="font-size:22px">' + x[1] + '</span><div class="grow">' + x[2] + '</div><span class="muted">›</span></div>').join('') + '</div>';
  h += '<div class="card"><div class="label">Timer and alerts</div>' +
    '<label class="row small" style="margin-bottom:10px"><input type="checkbox" id="s-auto" style="width:auto"' + (p.auto_rest ? ' checked' : '') + '> Start the rest timer when I finish a set</label>' +
    '<label class="row small" style="margin-bottom:10px"><input type="checkbox" id="s-nudge" style="width:auto"' + (p.nudge ? ' checked' : '') + '> Remind me again if I keep resting</label>' +
    '<label class="row small" style="margin-bottom:10px"><input type="checkbox" id="s-apple" style="width:auto"' + (p.apple_timer ? ' checked' : '') + '> Also start an Apple Timer (needs a Shortcut)</label>' +
    '<div class="field"><label>Shortcut name</label><input id="s-sc" value="' + esc(p.shortcut_name || 'GymPulse Timer') + '"></div>' +
    '<div class="row wrap"><button class="btn alt sm" data-a="save-settings">Save</button><button class="btn cyan sm" data-a="enable-push">Turn on lock-screen alerts</button><button class="btn alt sm" data-a="test-push">Send a test</button></div><div class="small muted" id="push-note" style="margin-top:8px">On iPhone, first add GymPulse to your Home Screen, then turn on alerts.</div></div>';
  h += '<div class="card"><div class="label">Change my password</div><div class="field"><input id="pw-old" type="password" placeholder="Current password" autocomplete="current-password"></div><div class="field"><input id="pw-new" type="password" placeholder="New password (8+ characters)" autocomplete="new-password"></div><button class="btn alt sm" data-a="change-pw">Change password</button></div>';
  h += '<button class="btn danger block" data-a="logout">Sign out</button><p class="small muted" style="text-align:center;margin-top:14px">GymPulse is for general fitness and is not medical advice. Check with your doctor before starting a new exercise or eating plan.</p>';
  setApp(h);
}
function guideSheet() {
  const T = [['Rep', 'One full movement, like one push or one pull.'], ['Set', 'A group of reps done back to back. "3 sets of 10" means 10 reps, rest, 10 reps, rest, 10 reps.'], ['Rest', 'A short break between sets so your muscles recover. 60 to 90 seconds is typical for beginners.'], ['Machine', 'Strength machines guide your movement, which makes them a safe place to start. Adjust the seat so the handles line up with the middle of your chest or the weight stack moves smoothly.'], ['How heavy?', 'Pick a weight where the last 2 reps feel hard but you can still keep good form. If you can do 12 easily, go up a little next time.']];
  sheet('<h2 class="title" style="font-size:22px">Start here</h2><p class="sub">Everything you need to know on day one.</p>' + T.map((t) => '<div class="card flat"><b class="lime">' + t[0] + '</b><div class="small" style="margin-top:4px">' + t[1] + '</div></div>').join('') +
    '<div class="card flat"><b class="amber">Stay safe</b><div class="small" style="margin-top:4px">Breathe out when you push or pull. Never lock your joints. Stop if you feel sharp pain (sore muscles are normal, sharp pain is not). Ask staff at the gym to show you any machine you are unsure about, they are happy to help.</div></div>' +
    '<div class="card flat"><b class="cyan">How often?</b><div class="small" style="margin-top:4px">The CDC suggests 150 minutes of moderate activity a week plus strength work on 2 days. Starting with 2 to 3 short workouts a week is a great plan.</div></div>');
}
async function routineSheet() {
  const rt = (await GET('/api/routine')).routine; S.routine = rt;
  sheet('<h2 class="title" style="font-size:22px">My routine</h2><p class="sub">The exercises that show up when you start a workout.</p>' +
    rt.map((r, i) => '<div class="item"><div class="grow"><b>' + esc(r.name) + '</b><div class="small muted">' + (r.kind === 'timed' ? 'Timed · ' + fmtTime(r.seconds) : r.sets_total + ' sets · rest ' + fmtTime(r.seconds)) + '</div></div>' +
      '<button class="btn alt sm" data-a="rt-move" data-id="' + r.id + '" data-dir="up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="btn alt sm" data-a="rt-move" data-id="' + r.id + '" data-dir="down"' + (i === rt.length - 1 ? ' disabled' : '') + '>↓</button><button class="btn danger sm" data-a="rt-del" data-id="' + r.id + '">✕</button></div>').join('') +
    '<div class="hr"></div><div class="label">Add an exercise</div><div class="field"><input id="rt-name" placeholder="Name, like Leg Curl Machine"></div>' +
    '<div class="two field"><div><label>Type</label><select id="rt-kind"><option value="sets">Sets and reps</option><option value="timed">Timed (like treadmill)</option></select></div><div><label>Sets</label><input id="rt-sets" type="number" value="3"></div></div>' +
    '<div class="field"><label>Rest between sets (or length of timed exercise), in seconds</label><input id="rt-secs" type="number" value="75"></div>' +
    '<div class="field"><input id="rt-note" placeholder="A quick note (optional)"></div>' +
    '<button class="btn block" data-a="rt-add">Add</button><div class="spacer"></div><button class="btn alt block" data-a="rt-template">Reset to the beginner plan</button>');
}
async function adminSheet() {
  const us = (await GET('/api/admin/users')).users;
  sheet('<h2 class="title" style="font-size:22px">People</h2><div class="spacer"></div>' +
    us.map((u) => '<div class="item"><div class="grow"><b>' + esc(u.username) + '</b> <span class="chip ' + (u.role === 'admin' ? 'amber' : '') + '">' + u.role + '</span>' + (u.disabled ? ' <span class="chip">off</span>' : '') + '<div class="small muted">' + (u.last_workout ? 'Last workout ' + fmtDate(u.last_workout) : 'No workouts yet') + '</div></div>' +
      '<button class="btn alt sm" data-a="adm-role" data-id="' + u.id + '" data-role="' + (u.role === 'admin' ? 'user' : 'admin') + '">' + (u.role === 'admin' ? 'Make standard' : 'Make admin') + '</button></div><div class="row wrap" style="padding-bottom:10px"><button class="btn alt sm" data-a="adm-pw" data-id="' + u.id + '">Reset password</button><button class="btn alt sm" data-a="adm-off" data-id="' + u.id + '" data-off="' + (u.disabled ? 0 : 1) + '">' + (u.disabled ? 'Turn on' : 'Turn off') + '</button></div>').join('') +
    '<div class="hr"></div><div class="label">Add a person</div><div class="field"><input id="nu-name" autocapitalize="none" placeholder="Username"></div><div class="field"><input id="nu-pw" type="text" placeholder="Starting password (8+ characters)"></div><button class="btn block" data-a="adm-add">Add person</button>' +
    '<div class="hr"></div><a class="btn alt block" style="text-align:center;text-decoration:none" href="/api/admin/backup">Download a backup of the database</a><p class="small muted">Admins can add and manage people but cannot see anyone\'s weight or food. Nightly backups are also kept in your appdata folder.</p>');
}

// ---------- push ----------
function b64ToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const r = atob(s), a = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
async function enablePush() {
  const note = $('#push-note');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { note.textContent = isIOS() ? 'Add GymPulse to your Home Screen first (Share → Add to Home Screen), open it from there, then try again. Needs iOS 16.4 or newer.' : 'This browser does not support alerts.'; return; }
  try {
    const key = (await GET('/api/push/key')).key;
    if (!key) { note.textContent = 'Alerts are not available on this server.'; return; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { note.textContent = 'Alerts were not allowed. You can change this in Settings → GymPulse → Notifications.'; return; }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    await POST('/api/push/subscribe', { subscription: sub.toJSON() });
    note.textContent = 'Alerts are on. Tap "Send a test" and lock your phone to try it.';
  } catch (e) { note.textContent = 'Could not turn on alerts: ' + (e.message || e); }
}

// ---------- click handling ----------
const actions = {
  reload() { location.reload(); },
  async setup() { try { await POST('/api/setup', { username: val('u'), password: val('p') }); boot(); } catch (e) { $('#e').textContent = e.userMessage || 'Could not create the account.'; } },
  async login() { try { await POST('/api/login', { username: val('u'), password: val('p') }); boot(); } catch (e) { $('#e').textContent = e.userMessage || 'Could not sign in.'; } },
  tab(el) { go(el.dataset.t); },
  async 'start-workout'() { await POST('/api/session/start', { date: todayStr() }); go('today'); },
  async set(el) {
    const n = +el.dataset.n, done = +el.dataset.done, sets = n === done ? n - 1 : n;
    const r = await POST('/api/session/' + S.session.id + '/exercise/' + el.dataset.id, { sets_done: sets });
    const ex = r.exercises.find((e) => e.id === +el.dataset.id);
    if (sets > done && S.profile.auto_rest && !ex.completed) startTimer(+el.dataset.secs, 'Rest · ' + el.dataset.name);
    else if (ex.completed) { if (timer) stopTimer(); toast('Nice! ' + el.dataset.name + ' is done.'); }
    go('today');
  },
  'timed-start'(el) { startTimer(+el.dataset.secs, el.dataset.name); },
  async 'timed-done'(el) { await POST('/api/session/' + S.session.id + '/exercise/' + el.dataset.id, { completed: el.dataset.v === '1' }); if (el.dataset.v === '1' && timer) stopTimer(); go('today'); },
  async 'finish-workout'() { await POST('/api/session/' + S.session.id + '/finish'); stopTimer(); toast('Workout saved. Great job!'); go('progress'); },
  async 'discard-workout'() { if (confirm('Discard this workout? It will not be saved.')) { await DEL('/api/session/' + S.session.id); stopTimer(); go('today'); } },
  'timer-reset'() { stopTimer(); },
  'timer-adj'(el) { adjustTimer(+el.dataset.d); },
  'timer-pause'() { pauseResume(); },
  async 'log-weight'() { const v = parseFloat(val('wt')); if (!v) return toast('Type your weight first.'); await POST('/api/weight', { weight_lb: v, date: todayStr() }); toast('Saved.'); go('progress'); },
  'body-edit'() { if (!S.profile) GET('/api/profile').then((r) => { S.profile = r.profile; bodyForm(); }); else bodyForm(); },
  async 'body-save'() {
    const ft = parseFloat(val('b-ft')) || 0, inch = parseFloat(val('b-in')) || 0;
    await PUT('/api/profile', { age: val('b-age') || null, sex: val('b-sex'), height_in: ft || inch ? ft * 12 + inch : null, goal_weight_lb: val('b-goal') || null, activity: val('b-act'), workouts_per_week: +val('b-wpw') });
    closeSheet(); toast('Saved.'); go(S.tab);
  },
  'food-view'(el) { S.foodView = el.dataset.v; go('food'); },
  'food-day'(el) { S.foodDate = shiftDate(S.foodDate, +el.dataset.d); go('food'); },
  'add-food'(el) { addFoodSheet(el.dataset.meal); },
  fscope(el) { addCtx.scope = el.dataset.s; document.querySelectorAll('[data-a=fscope]').forEach((b) => b.classList.toggle('on', b === el)); runFoodSearch(); },
  'pick-food'(el) { pickFood(el); },
  async 'confirm-food'(el) { const s = parseFloat(val('srv')); if (!s) return toast('Type how many servings.'); await POST('/api/diary', { food_id: +el.dataset.id, meal: addCtx.meal, servings: s, date: S.foodDate }); closeSheet(); toast('Added.'); go('food'); },
  async 'del-entry'(el) { await DEL('/api/diary/' + el.dataset.id); go('food'); },
  async barcode() { const c = val('fbar').replace(/\s/g, ''); try { const r = await GET('/api/foods/barcode/' + c); $('#fres').innerHTML = foodRow(r.food); } catch (e) { fail(e); } },
  'custom-food'() { customFoodSheet(); },
  async 'save-custom'() {
    try {
      const r = await POST('/api/foods', { name: val('cf-name'), serving: val('cf-serv'), calories: val('cf-cal'), protein: val('cf-pro'), carbs: val('cf-carb'), fat: val('cf-fat') });
      await POST('/api/diary', { food_id: r.food.id, meal: addCtx.meal, servings: 1, date: S.foodDate }); closeSheet(); toast('Added.'); go('food');
    } catch (e) { fail(e); }
  },
  'recipe-new'() { recipeForm(); },
  'recipe-open'(el) { recipeDetail(el.dataset.id); },
  'recipe-edit'() { recipeForm(window.__recipe); },
  async 'recipe-save'(el) {
    const b = { title: val('r-title'), servings: val('r-serv'), minutes: val('r-min'), ingredients: val('r-ing'), steps: val('r-steps'), calories: val('r-cal'), protein: val('r-pro'), carbs: val('r-carb'), fat: val('r-fat'), shared: $('#r-share').checked };
    try { if (el.dataset.id) await PUT('/api/recipes/' + el.dataset.id, b); else await POST('/api/recipes', b); closeSheet(); toast('Recipe saved.'); go('food'); } catch (e) { fail(e); }
  },
  async 'recipe-del'(el) { if (confirm('Delete this recipe?')) { await DEL('/api/recipes/' + el.dataset.id); closeSheet(); go('food'); } },
  async 'recipe-cheer'(el) { await POST('/api/recipes/' + el.dataset.id + '/cheer'); recipeDetail(el.dataset.id); },
  async 'tip-send'(el) { try { await POST('/api/recipes/' + el.dataset.id + '/tips', { text: val('tip') }); recipeDetail(el.dataset.id); } catch (e) { fail(e); } },
  'recipe-log'(el) {
    sheet('<h2 class="title" style="font-size:22px">Add to my diary</h2><div class="field"><label>Meal</label><select id="rl-meal"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner" selected>Dinner</option><option value="snacks">Snacks</option></select></div><div class="field"><label>Servings eaten</label><input id="rl-s" type="number" step="0.25" value="1"></div><button class="btn block" data-a="recipe-log-go" data-id="' + el.dataset.id + '">Add</button>');
  },
  async 'recipe-log-go'(el) { try { await POST('/api/recipes/' + el.dataset.id + '/log', { meal: val('rl-meal'), servings: parseFloat(val('rl-s')), date: S.foodDate }); closeSheet(); toast('Added to your diary.'); } catch (e) { fail(e); } },
  'friend-view'(el) { S.friendView = el.dataset.v; go('friends'); },
  async 'friend-add'() { try { await POST('/api/friends/request', { username: val('fr-name') }); toast('Request sent.'); go('friends'); } catch (e) { fail(e); } },
  async 'friend-accept'(el) { await POST('/api/friends/' + el.dataset.id + '/accept'); go('friends'); },
  async 'friend-ignore'(el) { await POST('/api/friends/' + el.dataset.id + '/ignore'); go('friends'); },
  async 'friend-remove'(el) { if (confirm('Remove this friend?')) { await DEL('/api/friends/' + el.dataset.id); go('friends'); } },
  async cheer(el) { try { await POST('/api/feed/' + el.dataset.id + '/cheer'); go('friends'); } catch (e) { fail(e); } },
  'hist-month'(el) { const [Y, M] = S.histMonth.split('-').map(Number); const d = new Date(Y, M - 1 + +el.dataset.d, 1); S.histMonth = d.getFullYear() + '-' + pad(d.getMonth() + 1); go('history'); },
  guide() { guideSheet(); },
  routine() { routineSheet(); },
  admin() { adminSheet(); },
  async 'rt-add'() { try { await POST('/api/routine', { name: val('rt-name'), kind: val('rt-kind'), sets_total: val('rt-sets'), seconds: val('rt-secs'), note: val('rt-note') }); routineSheet(); } catch (e) { fail(e); } },
  async 'rt-del'(el) { await DEL('/api/routine/' + el.dataset.id); routineSheet(); },
  async 'rt-move'(el) { await POST('/api/routine/' + el.dataset.id + '/move', { direction: el.dataset.dir }); routineSheet(); },
  async 'rt-template'() { if (confirm('Replace your routine with the beginner plan?')) { await POST('/api/routine/template'); routineSheet(); } },
  async 'adm-add'() { try { await POST('/api/admin/users', { username: val('nu-name'), password: val('nu-pw') }); adminSheet(); } catch (e) { fail(e); } },
  async 'adm-role'(el) { try { await PUT('/api/admin/users/' + el.dataset.id, { role: el.dataset.role }); adminSheet(); } catch (e) { fail(e); } },
  async 'adm-off'(el) { try { await PUT('/api/admin/users/' + el.dataset.id, { disabled: el.dataset.off === '1' }); adminSheet(); } catch (e) { fail(e); } },
  async 'adm-pw'(el) { const p = prompt('New password for this person (8+ characters):'); if (p) { try { await PUT('/api/admin/users/' + el.dataset.id, { password: p }); toast('Password changed.'); } catch (e) { fail(e); } } },
  async 'save-settings'() { await PUT('/api/profile', { auto_rest: $('#s-auto').checked, nudge: $('#s-nudge').checked, apple_timer: $('#s-apple').checked, shortcut_name: val('s-sc') }); toast('Saved.'); },
  'enable-push'() { enablePush(); },
  async 'test-push'() { try { await POST('/api/push/test'); toast('Sending in a few seconds. Lock your phone!'); } catch (e) { fail(e); } },
  async 'change-pw'() { try { await POST('/api/password', { current: val('pw-old'), new: val('pw-new') }); toast('Password changed.'); $('#pw-old').value = ''; $('#pw-new').value = ''; } catch (e) { fail(e); } },
  async logout() { await POST('/api/logout'); S.me = null; stopTimer(false); boot(); }
};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.a];
  if (fn) { Promise.resolve(fn(el)).catch((e) => { if (e && e.userMessage) toast(e.userMessage); }); }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
})();
