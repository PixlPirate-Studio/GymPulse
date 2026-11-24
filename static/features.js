/* GymPulse extras: reactions, challenges, badges, reminders, water, photos, scanner, guide,
   grocery list, connect-an-app. Loads after app.js and plugs in through window.GP / window.GPX. */
(function () {
'use strict';
const G = window.GP;
if (!G) return;
const { S, actions, GET, POST, PUT, DEL, toast, fail, val, esc, I, IF, sheet, closeSheet, openPage, setPage, backBtn, go, todayStr, shiftDate, fmtDate, ago, r0, avatar, $ } = G;
const HEART = 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6C19 16.5 12 21 12 21z';
const EMOJIS = ['👏', '🔥', '💪', '🎉', '❤️'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const slot = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
const card = (inner, cls) => '<div class="card ' + (cls || '') + '">' + inner + '</div>';
const eyebrow = (t) => '<div class="eyebrow" style="font-size:10px;margin-bottom:10px">' + t + '</div>';
const safe = (fn) => fn().catch(() => {});
const origin = location.origin;

const X = window.GPX = {};

// ---------------------------------------------------------------- per-tab extras
X.after = function (tab) {
  if (tab === 'progress') safe(progressExtras);
  else if (tab === 'food') safe(foodExtras);
  else if (tab === 'friends') safe(friendsExtras);
  else if (tab === 'body') safe(bodyExtras);
};
X.afterPage = function (name) {
  if (name === 'settings') safe(settingsExtras);
  else if (name === 'admin') safe(adminExtras);
  else if (name === 'guide') slot('x-set', '<button class="btn alt block" data-a="lib" style="margin-bottom:12px">Exercise how-to library</button>');
};

// ---------------------------------------------------------------- feed: reactions + nudge
X.feedRow = function (e) {
  const mine = e.user_id === S.me.id;
  const badge = e.type === 'pr' ? '📈 ' : e.type === 'badge' ? '🏅 ' : e.type === 'challenge' ? '🏁 ' : '';
  const reacts = mine
    ? '<div class="reacts">' + (e.reactions || []).map((r) => '<span class="rx">' + r.emoji + ' ' + r.count + '</span>').join('') + '<button class="linkbtn" data-a="feed-del" data-id="' + e.id + '">Delete post</button></div>'
    : '<div class="reacts">' + EMOJIS.map((em) => {
      const c = (e.reactions || []).find((r) => r.emoji === em);
      return '<button class="rx' + (e.mine === em ? ' on' : '') + '" data-a="react" data-id="' + e.id + '" data-e="' + em + '" aria-label="React ' + em + '">' + em + (c ? ' ' + c.count : '') + '</button>';
    }).join('') + '</div>';
  return '<div class="card tight"><div class="row gap12"><div class="grow"><b>' + esc(e.username) + '</b> ' + badge + esc(e.text) +
    '<div class="small muted" style="margin-top:3px">' + ago(e.created_at) + '</div>' + reacts + '</div>' +
    (e.type === 'recipe' ? '<button class="btn outline sm" data-a="recipe-open" data-id="' + e.ref_id + '">View</button>' : '') + '</div></div>';
};
X.nudge = function (f) { return '<button class="btn outline sm" data-a="nudge" data-id="' + f.id + '">Nudge</button>'; };
actions.react = async (el) => { try { await POST('/api/feed/' + el.dataset.id + '/react', { emoji: el.dataset.e }); go('friends'); } catch (e) { fail(e); } };
actions['feed-del'] = async (el) => { if (confirm('Remove this post from the activity feed?')) { await DEL('/api/feed/' + el.dataset.id); go('friends'); } };
actions.nudge = async (el) => { try { await POST('/api/friends/' + el.dataset.id + '/nudge'); toast('Nudge sent!'); } catch (e) { fail(e); } };

// ---------------------------------------------------------------- notifications
actions.notes = () => openPage(pageNotes);
async function pageNotes() {
  const r = await GET('/api/notifications', { quiet: true });
  const icon = { reaction: '👏', nudge: '👋', challenge: '🏁', badge: '🏅', reminder: '⏰' };
  setPage('<div class="head back">' + backBtn() + '<h1 class="title" style="font-size:24px">Notifications</h1></div>' +
    (r.items.length ? r.items.map((n) => '<div class="card tight' + (n.is_read ? '' : ' hi') + '"><div class="row gap12"><span style="font-size:20px">' + (icon[n.kind] || '🔔') + '</span><div class="grow">' + esc(n.text) + '<div class="small muted">' + ago(n.created_at) + '</div></div></div></div>').join('') : '<div class="card muted">Nothing yet. Friend reactions, nudges and badges show up here.</div>'));
  if (r.unread) { await POST('/api/notifications/read'); S.notes = 0; G.pollNotes(); document.querySelectorAll('.bellbtn').forEach((b) => { b.outerHTML = G.bell(); }); }
}

// ---------------------------------------------------------------- friends: challenges
async function friendsExtras() {
  const r = await GET('/api/challenges');
  let h = '';
  const list = r.challenges;
  if (list.length) {
    h += card('<div class="row between" style="margin-bottom:6px"><h3 style="margin:0;font-size:16px">Challenges</h3><button class="btn sm" data-a="chal-new">New</button></div>' + list.map(chalRow).join(''));
  } else {
    h += card('<div class="row between"><div><h3 style="margin:0;font-size:16px">Challenges</h3><div class="small muted" style="font-size:12px">Team up or race a friend to a goal</div></div><button class="btn sm" data-a="chal-new">Start one</button></div>');
  }
  slot('x-top', h);
}
function chalRow(c) {
  const unit = c.metric === 'minutes' ? 'min' : 'workouts';
  const pct = Math.min(100, c.total / c.target * 100);
  let h = '<div class="hr"></div><div class="row between" style="gap:8px"><div><b>' + esc(c.title) + '</b><div class="small muted" style="font-size:12px">' + (c.kind === 'team' ? 'Team goal' : 'Race') + ' · ' + c.target + ' ' + unit + ' · ends ' + fmtDate(c.end_date) + '</div></div>' +
    '<span class="badge ' + (c.state === 'done' ? 'lime' : c.state === 'over' ? 'amber' : 'cyan') + '">' + (c.state === 'done' ? 'Done' : c.state === 'over' ? 'Ended' : 'Active') + '</span></div>';
  if (c.status === 'invited') {
    return h + '<div class="small" style="margin:8px 0">' + esc(c.creator) + ' invited you.</div><div class="row gap8"><button class="btn sm" data-a="chal-join" data-id="' + c.id + '">Join</button><button class="btn alt sm" data-a="chal-leave" data-id="' + c.id + '">No thanks</button></div>';
  }
  if (c.kind === 'team') h += '<div class="bar8" style="margin:10px 0 4px"><i style="width:' + pct + '%"></i></div><div class="small muted">' + c.total + ' of ' + c.target + ' ' + unit + ' together</div>';
  h += '<div style="margin-top:8px">' + c.members.filter((m) => m.status === 'joined').map((m) => '<div class="row between small" style="padding:3px 0"><span>' + esc(m.name) + (m.me ? ' (you)' : '') + '</span><b class="mono lime">' + m.progress + (c.kind === 'race' ? ' / ' + c.target : '') + '</b></div>').join('') + '</div>';
  if (c.winner) h += '<div class="small lime" style="margin-top:6px;font-weight:700">🏆 ' + esc(c.winner) + ' won</div>';
  h += '<div class="row gap8" style="margin-top:8px">' + (c.mine ? '<button class="btn danger sm" data-a="chal-del" data-id="' + c.id + '">Delete</button>' : '<button class="btn alt sm" data-a="chal-leave" data-id="' + c.id + '">Leave</button>') + '</div>';
  return h;
}
let chalDraft = { kind: 'team', metric: 'workouts', invite: [] };
actions['chal-new'] = async () => {
  chalDraft = { kind: 'team', metric: 'workouts', invite: [] };
  const fr = (await GET('/api/friends')).friends;
  sheet('<h2 class="title" style="font-size:22px">New challenge</h2><p class="sub" style="margin-bottom:14px">Pick a goal and who to invite.</p>' +
    '<div class="field"><label>Name</label><input id="ch-title" placeholder="e.g. 10 workouts in 2 weeks"></div>' +
    '<div class="field"><label>Style</label><div class="seg" id="ch-kind"><button class="on" data-a="chal-opt" data-k="kind" data-v="team">Team (add it up)</button><button data-a="chal-opt" data-k="kind" data-v="race">Race (first there)</button></div></div>' +
    '<div class="field"><label>Count</label><div class="seg" id="ch-metric"><button class="on" data-a="chal-opt" data-k="metric" data-v="workouts">Workout days</button><button data-a="chal-opt" data-k="metric" data-v="minutes">Minutes</button></div></div>' +
    '<div class="two"><div class="field"><label>Goal number</label><input id="ch-target" class="inputmono" type="number" inputmode="numeric" value="10"></div><div class="field"><label>Days to finish</label><input id="ch-days" class="inputmono" type="number" inputmode="numeric" value="14"></div></div>' +
    (fr.length ? '<div class="flabel">Invite friends</div>' + fr.map((f) => '<label class="check" style="margin-bottom:8px"><input type="checkbox" class="ch-inv" value="' + f.id + '"> ' + esc(f.username) + '</label>').join('') : '<p class="small muted">Add a friend first to invite them. You can still start one alone.</p>') +
    '<div class="spacer" style="height:10px"></div><button class="btn block" data-a="chal-create">Start challenge</button>');
};
actions['chal-opt'] = (el) => { chalDraft[el.dataset.k] = el.dataset.v; el.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el)); };
actions['chal-create'] = async () => {
  const ids = Array.prototype.map.call(document.querySelectorAll('.ch-inv:checked'), (x) => +x.value);
  try { await POST('/api/challenges', { title: val('ch-title'), kind: chalDraft.kind, metric: chalDraft.metric, target: +val('ch-target'), days: +val('ch-days'), invite_ids: ids }); closeSheet(); toast('Challenge started.'); go('friends'); } catch (e) { fail(e); }
};
actions['chal-join'] = async (el) => { await POST('/api/challenges/' + el.dataset.id + '/join'); go('friends'); };
actions['chal-leave'] = async (el) => { await POST('/api/challenges/' + el.dataset.id + '/leave'); go('friends'); };
actions['chal-del'] = async (el) => { if (confirm('Delete this challenge for everyone?')) { await DEL('/api/challenges/' + el.dataset.id); go('friends'); } };

// ---------------------------------------------------------------- progress: badges + records + steps
async function progressExtras() {
  const [b, rec, hl] = await Promise.all([GET('/api/badges'), GET('/api/records'), GET('/api/health?days=7')]);
  const got = b.badges.filter((x) => x.earned_at);
  let h = card('<div class="row between"><h3 style="margin:0;font-size:16px">Badges</h3><button class="btn alt sm" data-a="badges">' + got.length + ' of ' + b.badges.length + '</button></div>' +
    '<div class="badgerow">' + (got.length ? got.slice(0, 8).map((x) => '<span class="bdg" title="' + esc(x.name) + '">' + x.icon + '</span>').join('') : '<span class="small muted">Finish a workout to earn your first one.</span>') + '</div>');
  h += card('<div class="row between" style="margin-bottom:6px"><h3 style="margin:0;font-size:16px">Personal bests</h3>' + (rec.records.length > 5 ? '<button class="btn alt sm" data-a="records">See all</button>' : '') + '</div>' +
    (rec.records.length ? rec.records.slice(0, 5).map(recRow).join('') : '<p class="small muted">Log the weight and reps for your sets and your best lifts show up here.</p>'));
  const d = hl.days[0];
  if (d && d.steps) h += card('<div class="row between"><div><div class="eyebrow" style="font-size:10px">Steps</div><div class="mono cyan" style="font-size:26px;font-weight:800">' + d.steps.toLocaleString() + '</div><div class="small muted">' + (d.date === todayStr() ? 'today' : fmtDate(d.date)) + (d.resting_hr ? ' · resting heart rate ' + d.resting_hr : '') + '</div></div></div>');
  slot('x-bot', h);
}
const recRow = (r) => '<div class="entry"><div class="grow"><b>' + esc(r.name) + '</b><div class="small muted">' + fmtDate(r.date) + '</div></div><b class="mono lime">' + G.lbs(r.weight_lb) + ' lb × ' + r.reps + '</b></div>';
actions.records = () => openPage(async () => {
  const r = await GET('/api/records');
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:24px">Personal bests</h1><p class="sub">Your heaviest lift on each exercise</p></div></div>' + card(r.records.map(recRow).join('') || '<p class="muted">Nothing yet.</p>'));
}, 'progress');
actions.badges = () => openPage(async () => {
  const b = (await GET('/api/badges')).badges;
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:24px">Badges</h1><p class="sub">' + b.filter((x) => x.earned_at).length + ' of ' + b.length + ' earned</p></div></div>' +
    '<div class="badgegrid">' + b.map((x) => '<div class="bgc' + (x.earned_at ? ' on' : '') + '"><div class="ic2">' + x.icon + '</div><b>' + esc(x.name) + '</b><div class="small muted" style="font-size:11px">' + esc(x.how) + '</div></div>').join('') + '</div>');
}, 'progress');

// ---------------------------------------------------------------- food: water, saved meals, copy day, grocery
async function foodExtras() {
  const date = S.foodDate;
  const w = await GET('/api/water?date=' + date);
  const pct = Math.min(100, w.oz / w.goal_oz * 100);
  slot('x-top', card('<div class="row between"><div><div class="eyebrow" style="font-size:10px">Water</div><div><b class="mono cyan" style="font-size:22px">' + r0(w.oz) + '</b> <span class="muted small">of ' + w.goal_oz + ' oz</span></div></div>' +
    '<div class="row gap6"><button class="btn alt sm" data-a="water" data-oz="8">+8 oz</button><button class="btn alt sm" data-a="water" data-oz="16">+16 oz</button><button class="sq" style="width:40px;height:40px" data-a="water-edit" aria-label="Edit water">' + I('edit') + '</button></div></div><div class="bar8 cyan" style="margin-top:10px"><i style="width:' + pct + '%"></i></div>'));
  const meals = (await GET('/api/meals')).meals;
  let h = card(eyebrow('Shortcuts') + '<div class="row gap8 wrap"><button class="btn alt sm" data-a="copy-day">Copy yesterday</button><button class="btn alt sm" data-a="meal-save-sheet">Save a meal</button><button class="btn alt sm" data-a="grocery">Grocery list</button></div>' +
    (meals.length ? '<div class="hr"></div>' + meals.map((m) => '<div class="entry" style="border:0;padding:6px 0"><div class="grow"><b>' + esc(m.name) + '</b><div class="small muted">' + m.items.length + ' item' + (m.items.length === 1 ? '' : 's') + ' · ' + m.calories + ' cal</div></div><button class="btn sm" data-a="meal-go" data-id="' + m.id + '" data-name="' + esc(m.name) + '">Add</button><button class="sq" style="width:36px;height:36px;color:var(--rose)" data-a="meal-del" data-id="' + m.id + '" aria-label="Delete saved meal">×</button></div>').join('') : ''));
  slot('x-bot', h);
}
actions.water = async (el) => { try { await POST('/api/water', { date: S.foodDate, add_oz: +el.dataset.oz }); go('food'); } catch (e) { fail(e); } };
actions['water-edit'] = () => {
  sheet('<h2 class="title" style="font-size:22px">Water</h2><p class="sub" style="margin-bottom:14px">Fix today\'s total or change your daily goal.</p>' +
    '<div class="two"><div class="field"><label>Total today (oz)</label><input id="w-oz" class="inputmono" type="number" inputmode="decimal"></div><div class="field"><label>Daily goal (oz)</label><input id="w-goal" class="inputmono" type="number" inputmode="numeric" placeholder="64"></div></div><button class="btn block" data-a="water-save">Save</button>');
};
actions['water-save'] = async () => {
  try { if (val('w-oz') !== '') await POST('/api/water', { date: S.foodDate, set_oz: +val('w-oz') }); if (val('w-goal') !== '') await PUT('/api/water/goal', { goal_oz: +val('w-goal') }); closeSheet(); go('food'); } catch (e) { fail(e); }
};
actions['copy-day'] = async () => {
  const from = shiftDate(S.foodDate, -1);
  try { const r = await POST('/api/diary/copy', { from, to: S.foodDate }); toast(r.added ? 'Copied ' + r.added + ' item' + (r.added === 1 ? '' : 's') + ' from yesterday.' : 'Nothing was logged yesterday.'); go('food'); } catch (e) { fail(e); }
};
const mealPick = (act, extra) => '<div class="chips" style="flex-wrap:wrap;overflow:visible">' + ['breakfast', 'lunch', 'dinner', 'snacks'].map((m) => '<button data-a="' + act + '" data-meal="' + m + '"' + (extra || '') + ' style="text-transform:capitalize">' + m + '</button>').join('') + '</div>';
actions['meal-save-sheet'] = () => sheet('<h2 class="title" style="font-size:22px">Save a meal</h2><p class="sub" style="margin-bottom:14px">Turn what you ate into a one-tap combo.</p><div class="field"><label>Name</label><input id="sm-name" placeholder="e.g. My usual breakfast"></div><div class="flabel">Which meal from this day?</div>' + mealPick('meal-save'));
actions['meal-save'] = async (el) => { try { await POST('/api/meals', { name: val('sm-name'), meal: el.dataset.meal, date: S.foodDate }); closeSheet(); toast('Saved.'); go('food'); } catch (e) { fail(e); } };
actions['meal-go'] = (el) => sheet('<h2 class="title" style="font-size:22px">Add "' + esc(el.dataset.name) + '"</h2><p class="sub" style="margin-bottom:14px">Which meal?</p>' + mealPick('meal-log', ' data-id="' + el.dataset.id + '"'));
actions['meal-log'] = async (el) => { try { await POST('/api/meals/' + el.dataset.id + '/log', { meal: el.dataset.meal, date: S.foodDate }); closeSheet(); S.openMeal = el.dataset.meal; toast('Added.'); go('food'); } catch (e) { fail(e); } };
actions['meal-del'] = async (el) => { if (confirm('Delete this saved meal?')) { await DEL('/api/meals/' + el.dataset.id); go('food'); } };

actions.grocery = () => openPage(pageGrocery, 'food');
async function pageGrocery() {
  const items = (await GET('/api/grocery')).items;
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:24px">Grocery list</h1><p class="sub">Add from any recipe, or type your own</p></div></div>' +
    '<div class="row gap8" style="margin-bottom:12px"><input id="gr-new" placeholder="e.g. spinach"><button class="btn" data-a="gr-add" style="min-height:48px">Add</button></div>' +
    card(items.length ? items.map((i) => '<div class="entry" style="padding:8px 0"><label class="check grow" style="' + (i.done ? 'opacity:.5;text-decoration:line-through' : '') + '"><input type="checkbox" data-a="gr-toggle" data-id="' + i.id + '"' + (i.done ? ' checked' : '') + '> ' + esc(i.text) + '</label><button class="sq" style="width:34px;height:34px;color:var(--rose)" data-a="gr-del" data-id="' + i.id + '" aria-label="Remove">×</button></div>').join('') : '<p class="muted">Your list is empty.</p>') +
    (items.some((i) => i.done) ? '<button class="btn alt block" data-a="gr-clear">Clear checked items</button>' : ''));
}
actions['gr-add'] = async () => { try { await POST('/api/grocery', { text: val('gr-new') }); pageGrocery(); } catch (e) { fail(e); } };
actions['gr-toggle'] = async (el) => { await PUT('/api/grocery/' + el.dataset.id, { done: el.checked }); pageGrocery(); };
actions['gr-del'] = async (el) => { await DEL('/api/grocery/' + el.dataset.id); pageGrocery(); };
actions['gr-clear'] = async () => { await DEL('/api/grocery'); pageGrocery(); };
X.recipeExtra = (r) => '<button class="btn alt block" data-a="recipe-grocery" data-id="' + r.id + '" style="margin-bottom:12px">Add ingredients to my grocery list</button>';
actions['recipe-grocery'] = async (el) => { try { const r = await POST('/api/recipes/' + el.dataset.id + '/grocery'); toast(r.added ? 'Added ' + r.added + ' item' + (r.added === 1 ? '' : 's') + '.' : 'Already on your list.'); } catch (e) { fail(e); } };

// ---------------------------------------------------------------- body: measurements, photos, health
async function bodyExtras() {
  const [m, ph, hl] = await Promise.all([GET('/api/measurements'), GET('/api/photos'), GET('/api/health?days=7')]);
  const last = m.measurements[0], prev = m.measurements[1];
  const f = (k, lab) => last && last[k] != null ? '<div class="tile"><div class="eyebrow">' + lab + '</div><div class="n lime" style="font-size:18px">' + last[k] + '"</div>' + (prev && prev[k] != null && prev[k] !== last[k] ? '<div class="t">' + (last[k] - prev[k] > 0 ? '+' : '') + (last[k] - prev[k]).toFixed(1) + '"</div>' : '<div class="t">&nbsp;</div>') + '</div>' : '';
  let h = card('<div class="row between"><h3 style="margin:0;font-size:16px">Measurements</h3><button class="btn sm" data-a="meas-new">Log</button></div>' +
    (last ? '<div class="small muted" style="margin:6px 0 10px">' + fmtDate(last.date) + ' · inches</div><div class="tiles">' + ['waist_in', 'hips_in', 'chest_in'].map((k, i) => f(k, ['Waist', 'Hips', 'Chest'][i])).join('') + '</div><div class="tiles">' + ['arm_in', 'thigh_in'].map((k, i) => f(k, ['Arm', 'Thigh'][i])).join('') + '</div>' : '<p class="small muted" style="margin-top:8px">The scale is not the only way to see progress. Log a waist or arm measurement once a month.</p>'));
  const ps = ph.photos;
  h += card('<div class="row between"><div><h3 style="margin:0;font-size:16px">Progress photos</h3><div class="small muted" style="font-size:12px">Private. Only you can see them. Not even admins.</div></div><button class="btn sm" data-a="photo-add">Add</button></div>' +
    '<input type="file" id="photo-file" accept="image/*" hidden>' +
    (ps.length > 1 ? '<div class="row gap8" style="margin-top:12px"><div class="grow"><div class="small muted">First · ' + fmtDate(ps[ps.length - 1].date) + '</div><img class="pimg" src="/api/photos/' + ps[ps.length - 1].id + '/image?size=thumb" alt="First photo"></div><div class="grow"><div class="small muted">Latest · ' + fmtDate(ps[0].date) + '</div><img class="pimg" src="/api/photos/' + ps[0].id + '/image?size=thumb" alt="Latest photo"></div></div>' : '') +
    (ps.length ? '<div class="photogrid">' + ps.slice(0, 12).map((p) => '<button data-a="photo-open" data-id="' + p.id + '" data-date="' + p.date + '" aria-label="Photo ' + p.date + '"><img src="/api/photos/' + p.id + '/image?size=thumb" alt=""></button>').join('') + '</div>' : ''));
  const d = hl.days;
  h += card('<div class="row between"><div><h3 style="margin:0;font-size:16px">Apple Health steps</h3><div class="small muted" style="font-size:12px">' + (d.length ? 'Last sync ' + fmtDate(d[0].date) : 'Send your steps with an iPhone Shortcut') + '</div></div><button class="btn alt sm" data-a="health-setup">' + (d.length ? 'Setup' : 'Set up') + '</button></div>' +
    (d.length ? '<div class="row gap6" style="margin-top:10px;align-items:flex-end;height:60px">' + (function () { const mx = Math.max.apply(null, d.map((x) => x.steps || 0).concat([1])); return d.slice().reverse().map((x) => '<div style="flex:1;text-align:center"><div style="background:var(--cyan);border-radius:4px;height:' + Math.max(3, (x.steps || 0) / mx * 44) + 'px"></div><div class="small muted" style="font-size:10px">' + new Date(x.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }) + '</div></div>').join(''); })() + '</div>' : ''));
  const ws = (await GET('/api/weights')).weights.slice(-8).reverse();
  if (ws.length) h += card(eyebrow('Recent weigh-ins') + ws.map((w) => '<div class="entry" style="padding:6px 0"><div class="grow">' + fmtDate(w.date) + '</div><b class="mono lime">' + w.weight_lb + ' lb</b><button class="sq" style="width:34px;height:34px;color:var(--rose);margin-left:8px" data-a="weigh-del" data-d="' + w.date + '" aria-label="Delete weigh-in">\u00d7</button></div>').join(''));
  slot('x-bot', h);
}
actions['weigh-del'] = async (el) => { if (confirm('Delete this weigh-in?')) { await DEL('/api/weight/' + el.dataset.d); go('body'); } };
actions['meas-new'] = () => sheet('<h2 class="title" style="font-size:22px">Log measurements</h2><p class="sub" style="margin-bottom:14px">In inches. Fill in only the ones you want.</p>' +
  '<div class="two"><div class="field"><label>Waist</label><input id="m-waist" class="inputmono" type="number" inputmode="decimal"></div><div class="field"><label>Hips</label><input id="m-hips" class="inputmono" type="number" inputmode="decimal"></div></div>' +
  '<div class="two"><div class="field"><label>Chest</label><input id="m-chest" class="inputmono" type="number" inputmode="decimal"></div><div class="field"><label>Arm</label><input id="m-arm" class="inputmono" type="number" inputmode="decimal"></div></div>' +
  '<div class="field"><label>Thigh</label><input id="m-thigh" class="inputmono" type="number" inputmode="decimal"></div><button class="btn block" data-a="meas-save">Save</button>');
actions['meas-save'] = async () => { try { await POST('/api/measurements', { date: todayStr(), waist_in: val('m-waist'), hips_in: val('m-hips'), chest_in: val('m-chest'), arm_in: val('m-arm'), thigh_in: val('m-thigh') }); closeSheet(); go('body'); } catch (e) { fail(e); } };

actions['photo-add'] = () => { const f = $('#photo-file'); if (f) f.click(); };
document.addEventListener('change', async (ev) => {
  const f = ev.target;
  if (!f || f.id !== 'photo-file' || !f.files[0]) return;
  const fd = new FormData(); fd.append('photo', f.files[0]); fd.append('date', todayStr());
  toast('Uploading...');
  try {
    const res = await fetch('/api/photos', { method: 'POST', headers: { 'X-GymPulse': '1' }, body: fd, credentials: 'same-origin' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(j.error), { userMessage: j.error || 'Upload failed.' });
    toast('Photo saved.'); go('body');
  } catch (e) { if (e.userMessage) fail(e); else toast("Can't reach the server."); }
});
actions['photo-open'] = (el) => sheet('<img src="/api/photos/' + el.dataset.id + '/image" alt="Progress photo" style="width:100%;border-radius:14px;margin-bottom:12px"><div class="row between"><b>' + fmtDate(el.dataset.date) + '</b><button class="btn danger sm" data-a="photo-del" data-id="' + el.dataset.id + '">Delete</button></div>');
actions['photo-del'] = async (el) => { if (confirm('Delete this photo for good?')) { await DEL('/api/photos/' + el.dataset.id); closeSheet(); go('body'); } };

actions['health-setup'] = async () => {
  sheet('<h2 class="title" style="font-size:22px">Send steps from Apple Health</h2><p class="sub" style="margin-bottom:14px">A web app can\'t read Apple Health itself, so an iPhone Shortcut does the sending. Set up once, about 3 minutes.</p>' +
    '<button class="btn block" data-a="health-key">Step 1: Make my private key</button><div id="hk" style="margin-top:12px"></div>');
};
actions['health-key'] = async () => {
  try {
    const t = await POST('/api/tokens', { name: 'Health Shortcut', scope: 'health' });
    $('#hk').innerHTML = '<div class="card hi tight"><div class="small muted">Your key (shown once, it only lets a Shortcut send health numbers):</div><div class="mono" style="word-break:break-all;margin:6px 0;font-size:13px">' + esc(t.token) + '</div><button class="btn alt sm" data-a="copy" data-t="' + esc(t.token) + '">Copy key</button></div>' +
      '<ol class="plain" style="margin-top:12px"><li>Open <b>Shortcuts</b> and tap <b>+</b>.</li><li>Add <b>Find Health Samples</b>: type <b>Steps</b>, start date <b>Today</b>. Turn on <b>Group by day</b> if offered.</li><li>Add <b>Calculate Statistics</b> (Sum) on those steps.</li><li>Add <b>Get Contents of URL</b>. URL: <span class="mono" style="word-break:break-all">' + esc(origin) + '/api/v1/health</span>. Method <b>POST</b>.</li><li>Under Headers add <b>Authorization</b> = <span class="mono">Bearer</span> then a space and your key. Add <b>Content-Type</b> = <span class="mono">application/json</span>.</li><li>Request Body: <b>JSON</b>. Add a number field <b>steps</b> with the sum from step 3.</li><li>Under <b>Automation</b>, make a daily one (like 9 pm) that runs this Shortcut.</li></ol>' +
      '<p class="small muted" style="margin-top:10px">Tip: run it once by hand and your steps appear here under Body.</p>';
  } catch (e) { fail(e); }
};
actions.copy = async (el) => { try { await navigator.clipboard.writeText(el.dataset.t); toast('Copied.'); } catch (e) { toast('Press and hold to copy.'); } };

// ---------------------------------------------------------------- settings: reminders + connect app
async function settingsExtras() {
  const [rm, tk] = await Promise.all([GET('/api/reminders'), GET('/api/tokens')]);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let h = card(eyebrow('Workout reminders') + (rm.reminders.length ? rm.reminders.map((r) => '<div class="entry" style="padding:8px 0"><div class="grow"><b class="mono">' + r.at + '</b>' + (r.label ? ' <span class="small muted">· ' + esc(r.label) + '</span>' : '') + '<div class="row gap6" style="margin-top:4px">' + DAYS.map((d, i) => '<span class="dayp' + (r.days.indexOf(i) >= 0 ? ' on' : '') + '">' + d + '</span>').join('') + '</div></div><label class="sw"><input type="checkbox" data-a="rem-toggle" data-id="' + r.id + '"' + (r.enabled ? ' checked' : '') + '><i></i></label><button class="sq" style="width:36px;height:36px;color:var(--rose)" data-a="rem-del" data-id="' + r.id + '" aria-label="Delete reminder">×</button></div>').join('') : '<p class="small muted" style="margin-bottom:10px">Get a nudge at the time you pick. Skipped on days you already worked out.</p>') +
    '<button class="btn alt sm" data-a="rem-new">Add a reminder</button>' + (S.pushOn ? '' : '<p class="small amber" style="margin-top:10px">Turn on "Alert when rest ends" above so reminders can reach your lock screen.</p>'));
  const cur = tk.tokens;
  h += card(eyebrow('Connect another device') + '<p class="small muted" style="margin-bottom:10px;line-height:1.5">Sign in on a new phone or a GymPulse app without typing your password. Everyone runs their own server, so your data stays on yours.</p><button class="btn alt sm" data-a="pair">Get a pairing code</button><div id="pair-out"></div>' +
    (cur.length ? '<div class="hr"></div>' + cur.map((t) => '<div class="entry" style="border:0;padding:6px 0"><div class="grow"><b>' + esc(t.name) + '</b>' + (t.scope === 'health' ? ' <span class="badge cyan">health only</span>' : '') + '<div class="small muted" style="font-size:12px">' + (t.last_used ? 'Used ' + ago(t.last_used) : 'Never used') + '</div></div><button class="btn danger sm" data-a="tok-del" data-id="' + t.id + '">Remove</button></div>').join('') : ''));
  h += '<div class="small muted" style="font-size:11px;margin:-4px 0 12px">Your time zone: ' + esc(tz) + '</div>';
  slot('x-set', h);
}
const remForm = { days: [0, 2, 4] };
actions['rem-new'] = () => {
  remForm.days = [0, 2, 4];
  sheet('<h2 class="title" style="font-size:22px">New reminder</h2><p class="sub" style="margin-bottom:14px">Pick the days and the time.</p><div class="chips" style="flex-wrap:wrap;overflow:visible" id="rem-days">' + DAYS.map((d, i) => '<button data-a="rem-day" data-d="' + i + '" class="' + (remForm.days.indexOf(i) >= 0 ? 'on' : '') + '" style="min-width:44px">' + d + '</button>').join('') + '</div>' +
    '<div class="field" style="margin-top:12px"><label>Time</label><input id="rem-time" type="time" value="17:30"></div><div class="field"><label>Label (optional)</label><input id="rem-label" placeholder="e.g. Leg day"></div><button class="btn block" data-a="rem-save">Save reminder</button>');
};
actions['rem-day'] = (el) => { const d = +el.dataset.d, i = remForm.days.indexOf(d); if (i >= 0) remForm.days.splice(i, 1); else remForm.days.push(d); el.classList.toggle('on', i < 0); };
actions['rem-save'] = async () => { try { await POST('/api/reminders', { days: remForm.days, at: val('rem-time'), label: val('rem-label'), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); closeSheet(); toast('Reminder saved.'); G.rerunPage(); } catch (e) { fail(e); } };
actions['rem-toggle'] = async (el) => {
  const r = (await GET('/api/reminders')).reminders.find((x) => x.id === +el.dataset.id); if (!r) return;
  try { await PUT('/api/reminders/' + r.id, { days: r.days, at: r.at, label: r.label, tz: r.tz, enabled: el.checked }); } catch (e) { fail(e); }
};
actions['rem-del'] = async (el) => { await DEL('/api/reminders/' + el.dataset.id); G.rerunPage(); };
actions.pair = async () => {
  try { const r = await POST('/api/auth/pair'); slot('pair-out', '<div class="card hi tight" style="margin-top:12px;text-align:center"><div class="small muted">Type this code on the other device (good for 5 minutes)</div><div class="mono lime" style="font-size:32px;font-weight:800;letter-spacing:.08em;margin:6px 0">' + esc(r.code) + '</div></div>'); } catch (e) { fail(e); }
};
actions['tok-del'] = async (el) => { if (confirm('Sign that device out?')) { await DEL('/api/tokens/' + el.dataset.id); G.rerunPage(); } };

// ---------------------------------------------------------------- admin: invite links
async function adminExtras() {
  const inv = (await GET('/api/admin/invites')).invites;
  const state = { ok: ['Waiting', 'cyan'], used: ['Used', 'lime'], expired: ['Expired', 'amber'], revoked: ['Cancelled', 'rose'] };
  slot('x-set', card(eyebrow('Invite link (easier than a temp password)') + '<p class="small muted" style="margin-bottom:10px;line-height:1.5">Send someone a link. They choose their own username, name and password, and you two become friends automatically.</p><button class="btn block" data-a="inv-new">Create invite link</button><div id="inv-out"></div>' +
    (inv.length ? '<div class="hr"></div>' + inv.slice(0, 6).map((i) => '<div class="entry" style="border:0;padding:6px 0"><div class="grow"><span class="small muted">' + (i.note ? esc(i.note) + ' · ' : '') + 'expires ' + new Date(i.expires_at * 1000).toLocaleDateString() + '</span></div><span class="badge ' + state[i.state][1] + '">' + state[i.state][0] + '</span>' + (i.state === 'ok' ? '<button class="sq" style="width:34px;height:34px;color:var(--rose)" data-a="inv-del" data-id="' + i.id + '" aria-label="Cancel invite">×</button>' : '') + '</div>').join('') : '')));
}
actions['inv-new'] = async () => {
  try {
    const r = await POST('/api/admin/invites', { days: 7 });
    const url = origin + r.path;
    slot('inv-out', '<div class="card hi tight" style="margin-top:12px"><div class="small muted">Good for 7 days, works once:</div><div class="mono" style="word-break:break-all;font-size:12px;margin:6px 0">' + esc(url) + '</div><div class="row gap8"><button class="btn sm" data-a="copy" data-t="' + esc(url) + '">Copy link</button>' + (navigator.share ? '<button class="btn alt sm" data-a="inv-share" data-t="' + esc(url) + '">Share</button>' : '') + '</div></div>');
  } catch (e) { fail(e); }
};
actions['inv-share'] = (el) => { navigator.share({ title: 'Join me on GymPulse', url: el.dataset.t }).catch(() => {}); };
actions['inv-del'] = async (el) => { await DEL('/api/admin/invites/' + el.dataset.id); G.rerunPage(); };

// ---------------------------------------------------------------- invite sign-up page
X.invite = async function (token) {
  const app = $('#app');
  let info;
  try { const res = await fetch('/api/invite/' + encodeURIComponent(token)); info = await res.json(); } catch (e) { info = { valid: false }; }
  if (!info.valid) {
    app.innerHTML = '<div class="center login"><div class="logo">' + I('clock') + '</div><h1 class="title" style="font-size:26px">Invite not valid</h1><p class="sub" style="margin:8px 0 16px">This link was already used, cancelled, or has expired. Ask for a new one.</p><button class="btn" data-a="inv-home">Go to sign in</button></div>';
    return;
  }
  app.innerHTML = '<div class="center login"><div class="logo">' + I('clock') + '</div><h1 class="title" style="font-size:26px">Join ' + esc(info.server) + '</h1><p class="sub" style="font-size:14px;margin:6px 0 14px">' + (info.invited_by ? esc(info.invited_by) + ' invited you. ' : '') + 'Pick how you will sign in.</p>' +
    '<div class="card"><div class="field"><label>Your name (friends see this)</label><input id="iv-name" maxlength="30" autocomplete="name"></div><div class="field"><label>Username (for signing in)</label><input id="iv-user" autocapitalize="none" autocomplete="username" autocorrect="off"></div><div class="field"><label>Password (8+ characters)</label><input id="iv-pw" type="password" autocomplete="new-password"></div><div class="err" id="e"></div><button class="btn block" data-a="inv-accept" data-t="' + esc(token) + '">Create my account</button></div></div>';
};
actions['inv-home'] = () => { history.replaceState(null, '', '/'); location.reload(); };
actions['inv-accept'] = async (el) => {
  try { await POST('/api/invite/' + encodeURIComponent(el.dataset.t) + '/accept', { display_name: val('iv-name'), username: val('iv-user'), password: val('iv-pw') }); history.replaceState(null, '', '/'); location.reload(); }
  catch (e) { $('#e').textContent = e.userMessage || 'Could not create the account.'; }
};

// ---------------------------------------------------------------- exercise how-to
const guideBody = (c) => '<p class="small muted" style="margin-bottom:12px">' + esc(c.category) + ' · works ' + esc(c.muscles.toLowerCase()) + '</p>' +
  '<div class="flabel">Set up</div><ol class="plain">' + c.setup.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
  '<div class="flabel" style="margin-top:12px">Do it</div><ol class="plain">' + c.how.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ol>' +
  '<div class="flabel" style="margin-top:12px">Common mistakes</div><ul class="plain" style="padding-left:18px;line-height:1.6">' + c.mistakes.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' +
  '<div class="card good tight" style="margin-top:12px"><b class="lime">Tip:</b> ' + esc(c.tip) + '</div>' +
  '<p class="small muted" style="margin-top:10px">Start light. Stop if anything hurts, and ask gym staff to check your form.</p>';
actions.howto = async (el) => {
  try {
    const c = (await GET('/api/exercise-guide?name=' + encodeURIComponent(el.dataset.name))).card;
    sheet('<h2 class="title" style="font-size:22px">' + esc(c ? c.name : el.dataset.name) + '</h2>' + (c ? guideBody(c) : '<p class="sub" style="margin-top:8px">We don\'t have a how-to card for this one yet. Ask gym staff to show you the settings, and start with a light weight.</p>'));
  } catch (e) { fail(e); }
};
actions.lib = () => openPage(async () => {
  const cards = (await GET('/api/exercise-guide')).cards, cats = {};
  cards.forEach((c) => { (cats[c.category] = cats[c.category] || []).push(c); });
  setPage('<div class="head back">' + backBtn() + '<div><h1 class="title" style="font-size:24px">How-to library</h1><p class="sub">Tap one to see how it is done</p></div></div>' +
    Object.keys(cats).sort().map((k) => '<div class="eyebrow" style="margin:14px 0 8px">' + esc(k) + '</div>' + cats[k].map((c) => '<div class="card tight" data-a="lib-open" data-slug="' + c.slug + '" style="cursor:pointer"><div class="row between"><div><b>' + esc(c.name) + '</b><div class="small muted" style="font-size:12px">' + (c.kind === 'timed' ? G.mmss(c.seconds) + ' timer' : c.sets_total + ' sets of ' + esc(c.reps)) + '</div></div><span class="muted">' + I('next') + '</span></div></div>').join('')).join(''));
}, 'today');
actions['lib-open'] = async (el) => {
  const c = (await GET('/api/exercise-guide/' + el.dataset.slug)).card;
  sheet('<h2 class="title" style="font-size:22px">' + esc(c.name) + '</h2>' + guideBody(c) + '<button class="btn block" style="margin-top:14px" data-a="lib-add" data-slug="' + c.slug + '">Add to "' + esc(S.plan) + '"</button>');
};
actions['lib-add'] = async (el) => {
  try {
    const c = (await GET('/api/exercise-guide/' + el.dataset.slug)).card;
    await POST('/api/routine', { plan: S.plan, name: c.name, category: c.category, kind: c.kind, sets_total: c.sets_total, reps: c.reps, seconds: c.seconds, note: c.tip });
    closeSheet(); toast('Added to ' + S.plan + '.');
  } catch (e) { fail(e); }
};

// ---------------------------------------------------------------- camera barcode scanner
const PHOTO_BTN = '<button class="btn alt block" data-a="scan-photo" style="margin-top:10px">Scan from a photo</button><input type="file" id="scan-file" accept="image/*" capture="environment" hidden>';
X.scanBtn = () => (window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  ? '<button class="btn alt block" data-a="scan" style="margin-top:10px">Scan with camera</button>' + PHOTO_BTN
  : PHOTO_BTN + '<p class="small muted" style="margin-top:10px">Camera scanning turns on when you open GymPulse through a secure (https) address, like your Cloudflare tunnel. Until then, type the number.</p>';
let scanStream = null, scanStop = false;
function stopScan() { scanStop = true; if (scanStream) { scanStream.getTracks().forEach((t) => t.stop()); scanStream = null; } }
function loadZXing() {
  return new Promise((res, rej) => {
    if (window.ZXing) return res();
    const s = document.createElement('script'); s.src = '/static/vendor/zxing.min.js'; s.onload = () => res(); s.onerror = () => rej(new Error('scanner')); document.head.appendChild(s);
  });
}
actions.scan = async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Camera is not available here. Type the number instead.');
  scanStop = false;
  sheet('<h2 class="title" style="font-size:22px">Scan a barcode</h2><p class="sub" style="margin-bottom:12px">Hold the barcode inside the box.</p><div class="scanbox"><video id="scan-v" playsinline muted autoplay></video><i></i></div><p class="small muted" id="scan-note" style="margin-top:10px">Starting camera...</p><button class="btn alt block" data-a="scan-close" style="margin-top:10px">Cancel</button>');
  const note = (t) => { const n = $('#scan-note'); if (n) n.textContent = t; };
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const v = $('#scan-v'); if (!v) return stopScan();
    v.srcObject = scanStream; await v.play().catch(() => {});
    note('Looking for a barcode...');
    const found = (code) => { stopScan(); closeSheet(); const f = $('#fbar'); if (f) f.value = code; actions.barcode(); };
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const loop = async () => { if (scanStop) return; try { const r = await det.detect(v); if (r.length) return found(r[0].rawValue); } catch (e) {} setTimeout(loop, 200); };
      loop();
    } else {
      await loadZXing();
      const Z = window.ZXing, F = Z.BarcodeFormat;
      const hints = new Map(); hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E]); hints.set(Z.DecodeHintType.TRY_HARDER, true);
      const mf = new Z.MultiFormatReader(); mf.setHints(hints);
      const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
      const loop = () => {
        if (scanStop) return;
        if (v.videoWidth) {
          const w = Math.min(1024, v.videoWidth), hgt = Math.round(w * v.videoHeight / v.videoWidth);
          cv.width = w; cv.height = hgt; cx.drawImage(v, 0, 0, w, hgt);
          try { const r = mf.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))); return found(r.getText()); } catch (e) {}
        }
        setTimeout(loop, 120);
      };
      loop();
    }
  } catch (e) { stopScan(); note('Live camera failed (' + ((e && (e.name || e.message)) || 'unknown') + '). Close this and use "Scan from a photo" instead, or type the number.'); }
};
actions['scan-close'] = () => { stopScan(); closeSheet(); };
actions['scan-photo'] = () => { const f = $('#scan-file'); if (f) { f.value = ''; f.click(); } };
function zxHints() {
  const Z = window.ZXing, F = Z.BarcodeFormat, h = new Map();
  h.set(Z.DecodeHintType.POSSIBLE_FORMATS, [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E]); h.set(Z.DecodeHintType.TRY_HARDER, true);
  return h;
}
async function decodePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    await loadZXing();
    const Z = window.ZXing;
    for (const maxW of [1600, 1000, 700]) {
      const sc = Math.min(1, maxW / Math.max(img.naturalWidth, img.naturalHeight));
      for (const rot of [0, 90]) {
        const cv = document.createElement('canvas'), w = Math.round(img.naturalWidth * sc), hh = Math.round(img.naturalHeight * sc);
        cv.width = rot ? hh : w; cv.height = rot ? w : hh;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        if (rot) { cx.translate(cv.width, 0); cx.rotate(Math.PI / 2); }
        cx.drawImage(img, 0, 0, w, hh);
        try {
          const mf = new Z.MultiFormatReader(); mf.setHints(zxHints());
          return mf.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)))).getText();
        } catch (e) {}
      }
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}
document.addEventListener('change', async (ev) => {
  if (!ev.target || ev.target.id !== 'scan-file' || !ev.target.files[0]) return;
  toast('Reading the barcode...');
  try {
    const code = await decodePhoto(ev.target.files[0]);
    if (!code) return toast('No barcode found. Get closer, keep it flat and sharp, or type the number.');
    const f = $('#fbar'); if (f) f.value = code; actions.barcode();
  } catch (e) { toast('Could not read that photo. Type the number instead.'); }
});
X.sheetClosed = stopScan;
})();
