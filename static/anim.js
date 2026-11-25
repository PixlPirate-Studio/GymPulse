/* GymPulse exercise pictures: small animated figures and muscle maps.
 * Everything is drawn with SVG in the browser (no image files, nothing downloaded).
 * Each exercise is two or more "poses"; the browser smoothly moves between them.
 */
(function () {
  'use strict';
  var reduced = false;
  try { reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var L = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  // two-bone leg/arm: where the middle joint (knee/elbow) goes
  function ik(a, b, l1, l2, dir) {
    var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.max(1, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5));
    var aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - aa * aa));
    var ux = dx / d, uy = dy / d, mx = a[0] + ux * aa, my = a[1] + uy * aa;
    return [mx - uy * hh * dir, my + ux * hh * dir];
  }
  function assign(o) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; for (var k in s) o[k] = s[k]; } return o; }

  var SIDE = { hd: [150, 52], S: [150, 84], H: [148, 160], K: [150, 215], A: [148, 268], T: [176, 270], E: [154, 122], W: [156, 156] };
  var FRONT = {
    hd: [150, 58], Sm: [150, 92], Sl: [120, 92], Sr: [180, 92], H: [150, 172],
    Hl: [136, 172], Hr: [164, 172], Kl: [132, 224], Kr: [168, 224], Al: [130, 268], Ar: [170, 268],
    El: [104, 130], Er: [196, 130], Wl: [100, 166], Wr: [200, 166]
  };
  var sp = function (o) { return assign({}, SIDE, o); };
  var fp = function (o) { return assign({}, FRONT, o); };
  // seated machine body (used by many machines)
  var SEAT = { hd: [130, 68], S: [130, 100], H: [118, 186], K: [178, 192], A: [186, 258], T: [214, 262], E: [134, 142], W: [150, 180] };
  var sa = function (o) { return assign({}, SEAT, o); };

  var C = {}; // the library, keyed by guide slug

  // ---------------------------------------------------------------- lower body
  C['goblet-squat'] = {
    poses: [sp({ E: [168, 118], W: [184, 98] }),
      sp({ hd: [170, 94], S: [156, 128], H: [122, 200], K: [170, 222], E: [182, 150], W: [198, 128] })],
    tools: [{ t: 'db', p: 'W' }], hl: [['H', 'K']], glow: ['H'], thumb: 1,
    pm: ['quads', 'glutes'], sm: ['abs', 'hamstrings', 'lowerback']
  };
  C.lunge = {
    poses: [sp({ K2: [150, 215], A2: [148, 268], T2: [176, 270], E: [154, 124], W: [156, 160] }),
      sp({ hd: [150, 74], S: [150, 106], H: [146, 194], K: [192, 214], A: [186, 268], T: [214, 270], K2: [112, 244], A2: [76, 262], T2: [90, 270], E: [154, 142], W: [156, 178] })],
    tools: [{ t: 'db', p: 'W' }], hl: [['H', 'K']], glow: ['H'], thumb: 1,
    pm: ['quads', 'glutes'], sm: ['hamstrings', 'calves']
  };
  C['glute-bridge'] = {
    poses: [{ hd: [34, 262], S: [62, 258], H: [132, 258], K: [172, 216], A: [196, 266], T: [224, 268], E: [86, 262], W: [112, 264] },
      { hd: [34, 258], S: [62, 254], H: [132, 214], K: [184, 206], A: [198, 266], T: [226, 268], E: [86, 260], W: [112, 262] }],
    hl: [['H', 'K']], glow: ['H'], thumb: 1, pm: ['glutes'], sm: ['hamstrings', 'abs', 'lowerback']
  };
  C['calf-raise'] = {
    poses: [sp({ E: [166, 120], W: [164, 152] }),
      sp({ hd: [150, 42], S: [150, 74], H: [148, 150], K: [150, 205], A: [152, 258], E: [166, 110], W: [164, 142] })],
    hl: [['K', 'A']], thumb: 1, pm: ['calves'], sm: []
  };
  C.rdl = {
    poses: [sp({ E: [156, 122], W: [158, 160] }),
      sp({ hd: [214, 126], S: [191, 135], H: [118, 170], K: [132, 218], E: [192, 176], W: [192, 214] })],
    tools: [{ t: 'db', p: 'W' }], hl: [['H', 'K'], ['lb0', 'H']], glow: ['H'], thumb: 1,
    pm: ['hamstrings', 'glutes'], sm: ['lowerback', 'back']
  };
  C['leg-press'] = {
    poses: [{ hd: [50, 134], S: [66, 158], H: [112, 206], K: [146, 168], A: [176, 208], T: [190, 214], E: [92, 186], W: [114, 196] },
      { hd: [50, 134], S: [66, 158], H: [112, 206], K: [164, 176], A: [216, 148], T: [230, 154], E: [92, 186], W: [114, 196] }],
    tools: [{ t: 'plate', p: 'A' }], hl: [['H', 'K']], glow: ['H'], thumb: 1,
    eq: '<path class="eq" d="M40 136 L108 218"/><path class="eq" d="M112 232 L250 122" style="stroke-width:4"/>',
    pm: ['quads', 'glutes'], sm: ['hamstrings', 'calves']
  };
  C['leg-extension'] = {
    poses: [sa({ A: [186, 252], T: [210, 256] }), sa({ A: [238, 196], T: [258, 190] })],
    hl: [['H', 'K']], thumb: 1,
    eq: '<rect class="eqf" x="92" y="76" width="14" height="122" rx="6"/><rect class="eqf" x="96" y="198" width="86" height="14" rx="6"/>',
    pm: ['quads'], sm: []
  };
  C['leg-curl'] = {
    poses: [sa({ A: [238, 196], T: [258, 190] }), sa({ A: [176, 252], T: [200, 256] })],
    hl: [['H', 'K']], thumb: 0,
    eq: '<rect class="eqf" x="92" y="76" width="14" height="122" rx="6"/><rect class="eqf" x="96" y="198" width="86" height="14" rx="6"/>',
    pm: ['hamstrings'], sm: ['calves']
  };

  // ---------------------------------------------------------------- push
  C.pushup = {
    poses: [{ hd: [224, 180], S: [200, 190], H: [126, 224], K: [88, 241], A: [50, 258], T: [40, 268], E: [203, 230], W: [205, 268] },
      { hd: [222, 230], S: [198, 238], H: [124, 249], K: [87, 254], A: [50, 262], T: [40, 270], E: [176, 256], W: [205, 268] }],
    hl: [['S', 'ch1'], ['S', 'E']], thumb: 0, floor: 274, pm: ['chest', 'triceps'], sm: ['shoulders', 'abs']
  };
  C['chest-press'] = {
    poses: [sa({ E: [112, 128], W: [152, 114] }), sa({ E: [160, 112], W: [198, 108] })],
    tools: [{ t: 'handle', p: 'W' }], hl: [['S', 'ch1'], ['S', 'E']], thumb: 1,
    eq: '<rect class="eqf" x="92" y="76" width="14" height="122" rx="6"/><rect class="eqf" x="96" y="198" width="86" height="14" rx="6"/>',
    pm: ['chest'], sm: ['shoulders', 'triceps']
  };
  C['db-bench'] = {
    poses: [{ hd: [62, 206], S: [94, 214], H: [170, 216], K: [214, 190], A: [224, 254], T: [250, 260], E: [112, 240], W: [102, 198] },
      { hd: [62, 206], S: [94, 214], H: [170, 216], K: [214, 190], A: [224, 254], T: [250, 260], E: [96, 178], W: [96, 138] }],
    tools: [{ t: 'db', p: 'W' }], hl: [['S', 'ch1'], ['S', 'E']], thumb: 1, floor: 264,
    eq: '<rect class="eqf" x="56" y="226" width="142" height="16" rx="7"/><path class="eq" d="M76 244 L76 262 M180 244 L180 262" style="stroke-width:8"/>',
    pm: ['chest'], sm: ['shoulders', 'triceps']
  };
  C['pec-fly'] = {
    v: 'front',
    poses: [fp({ Hl: [136, 176], Hr: [164, 176], H: [150, 176], Kl: [124, 208], Kr: [176, 208], Al: [128, 258], Ar: [172, 258], El: [84, 100], Wl: [92, 58], Er: [216, 100], Wr: [208, 58] }),
      fp({ Hl: [136, 176], Hr: [164, 176], H: [150, 176], Kl: [124, 208], Kr: [176, 208], Al: [128, 258], Ar: [172, 258], El: [126, 114], Wl: [138, 66], Er: [174, 114], Wr: [162, 66] })],
    tools: [{ t: 'handle', p: 'Wl' }, { t: 'handle', p: 'Wr' }], hl: [['Sl', 'Sr']], glow: ['Sm'], thumb: 1,
    eq: '<rect class="eqf" x="112" y="196" width="76" height="14" rx="6"/><rect class="eqf" x="104" y="76" width="92" height="122" rx="14" style="opacity:.5"/>',
    pm: ['chest'], sm: ['shoulders']
  };
  C['db-shoulder-press'] = {
    v: 'front',
    poses: [fp({ El: [104, 106], Wl: [100, 64], Er: [196, 106], Wr: [200, 64] }),
      fp({ El: [116, 56], Wl: [126, 18], Er: [184, 56], Wr: [174, 18] })],
    tools: [{ t: 'db', p: 'Wl' }, { t: 'db', p: 'Wr' }], hl: [['Sl', 'El'], ['Sr', 'Er']], thumb: 1,
    pm: ['shoulders'], sm: ['triceps', 'abs']
  };
  C['shoulder-press'] = {
    poses: [sa({ E: [124, 142], W: [152, 104] }), sa({ E: [150, 64], W: [152, 28] })],
    tools: [{ t: 'handle', p: 'W' }], hl: [['S', 'E']], thumb: 1,
    eq: '<rect class="eqf" x="92" y="76" width="14" height="122" rx="6"/><rect class="eqf" x="96" y="198" width="86" height="14" rx="6"/>',
    pm: ['shoulders'], sm: ['triceps']
  };
  C['lateral-raise'] = {
    v: 'front',
    poses: [fp({ El: [108, 130], Wl: [106, 168], Er: [192, 130], Wr: [194, 168] }),
      fp({ El: [84, 96], Wl: [48, 90], Er: [216, 96], Wr: [252, 90] })],
    tools: [{ t: 'db', p: 'Wl' }, { t: 'db', p: 'Wr' }], hl: [['Sl', 'El'], ['Sr', 'Er']], thumb: 1,
    pm: ['shoulders'], sm: []
  };
  C['triceps-pushdown'] = {
    poses: [sp({ E: [164, 122], W: [200, 104] }), sp({ E: [164, 122], W: [176, 160] })],
    tools: [{ t: 'handle', p: 'W', cable: [214, 0] }], hl: [['S', 'E']], thumb: 1,
    eq: '<path class="eq" d="M232 276 L232 12" style="stroke-width:10"/>',
    pm: ['triceps'], sm: ['shoulders']
  };

  // ---------------------------------------------------------------- pull
  C['lat-pulldown'] = {
    poses: [sa({ hd: [130, 76], S: [130, 108], E: [152, 62], W: [168, 22] }), sa({ hd: [126, 78], S: [128, 108], E: [104, 136], W: [148, 112] })],
    tools: [{ t: 'handle', p: 'W', cable: [170, 0] }], hl: [['S', 'lb0'], ['S', 'E']], thumb: 1,
    eq: '<rect class="eqf" x="92" y="84" width="14" height="114" rx="6"/><rect class="eqf" x="96" y="198" width="86" height="14" rx="6"/><rect class="eqf" x="150" y="164" width="44" height="14" rx="6"/>',
    pm: ['back'], sm: ['biceps', 'shoulders']
  };
  C['seated-row'] = {
    poses: [{ hd: [140, 84], S: [138, 116], H: [112, 204], K: [176, 198], A: [228, 206], T: [246, 196], E: [176, 140], W: [214, 160] },
      { hd: [128, 84], S: [128, 116], H: [112, 204], K: [176, 198], A: [228, 206], T: [246, 196], E: [110, 150], W: [150, 164] }],
    tools: [{ t: 'handle', p: 'W', cable: [290, 160] }], hl: [['S', 'H'], ['S', 'E']], thumb: 1, floor: 230,
    eq: '<rect class="eqf" x="66" y="212" width="82" height="14" rx="6"/><rect class="eqf" x="236" y="168" width="14" height="56" rx="6"/>',
    pm: ['back'], sm: ['biceps', 'lowerback']
  };
  C['db-row'] = {
    poses: [{ hd: [214, 126], S: [190, 140], H: [110, 170], K: [122, 222], A: [116, 268], T: [146, 270], E: [192, 186], W: [194, 228] },
      { hd: [214, 126], S: [190, 140], H: [110, 170], K: [122, 222], A: [116, 268], T: [146, 270], E: [158, 168], W: [170, 198] }],
    tools: [{ t: 'db', p: 'W' }], hl: [['S', 'H'], ['S', 'E']], thumb: 1,
    pm: ['back'], sm: ['biceps', 'shoulders']
  };
  C['bicep-curl'] = {
    poses: [sp({ E: [156, 124], W: [160, 164] }), sp({ E: [158, 124], W: [182, 92] })],
    tools: [{ t: 'db', p: 'W' }], hl: [['S', 'E']], thumb: 1, pm: ['biceps'], sm: []
  };

  // ---------------------------------------------------------------- core
  C.plank = {
    poses: [{ hd: [222, 194], S: [198, 204], H: [126, 226], K: [88, 240], A: [46, 256], T: [38, 266], E: [196, 262], W: [230, 266] },
      { hd: [222, 192], S: [198, 202], H: [126, 222], K: [88, 238], A: [46, 256], T: [38, 266], E: [196, 262], W: [230, 266] }],
    hl: [['co0', 'co1']], thumb: 0, floor: 272, dur: 2.4, pm: ['abs'], sm: ['shoulders', 'glutes', 'lowerback']
  };
  C.crunch = {
    poses: [{ hd: [40, 252], S: [68, 256], H: [132, 258], K: [176, 214], A: [198, 266], T: [226, 268], E: [50, 230], W: [68, 238] },
      { hd: [98, 210], S: [86, 238], H: [132, 258], K: [176, 214], A: [198, 266], T: [226, 268], E: [92, 212], W: [108, 206] }],
    hl: [['co0', 'co1']], thumb: 1, pm: ['abs'], sm: []
  };

  // ---------------------------------------------------------------- cardio
  var walkA = { K: [168, 214], A: [178, 258], T: [204, 262], K2: [128, 214], A2: [108, 262], T2: [128, 268], E: [130, 124], W: [118, 152], E2: [172, 122], W2: [184, 148] };
  var walkB = { K: [128, 214], A: [108, 262], T: [128, 268], K2: [168, 214], A2: [178, 258], T2: [204, 262], E: [172, 122], W: [184, 148], E2: [130, 124], W2: [118, 152] };
  C.treadmill = {
    poses: [sp(walkA), sp(walkB)], loop: 'cycle', dur: 1.6, hl: [['H', 'K']], glow: ['H'], thumb: 0,
    eq: '<path class="eq" d="M50 280 L250 280" style="stroke-width:10"/><path class="eq" d="M262 280 L262 176 L240 150" style="stroke-width:8"/>',
    pm: ['heart', 'calves'], sm: ['quads', 'hamstrings', 'glutes']
  };
  C.elliptical = {
    poses: [sp(assign({}, walkA, { A: [182, 256], T: [208, 258], A2: [114, 260], T2: [138, 262] })), sp(assign({}, walkB, { A: [114, 260], T: [138, 262], A2: [182, 256], T2: [208, 258] }))],
    loop: 'cycle', dur: 1.8, hl: [['H', 'K']], glow: ['H'], thumb: 0,
    eq: '<path class="eq" d="M40 278 L250 278" style="stroke-width:10"/><path class="eq" d="M236 278 L250 150 L212 134" style="stroke-width:8"/>',
    pm: ['heart', 'quads'], sm: ['glutes', 'hamstrings', 'shoulders']
  };
  (function () {
    var Hh = [118, 178], Sh = [148, 112], Hd = [166, 82], Cc = [170, 238], R = 26, Hb = [214, 134], poses = [];
    for (var i = 0; i < 4; i++) {
      var th = i * Math.PI / 2, A = [Cc[0] + R * Math.cos(th), Cc[1] + R * Math.sin(th)], A2 = [Cc[0] - R * Math.cos(th), Cc[1] - R * Math.sin(th)];
      var K = ik(Hh, A, 66, 66, -1), K2 = ik(Hh, A2, 66, 66, -1), E = ik(Sh, Hb, 44, 44, 1);
      poses.push({ hd: Hd, S: Sh, H: Hh, K: K, A: A, T: [A[0] + 22, A[1] + 3], K2: K2, A2: A2, T2: [A2[0] + 22, A2[1] + 3], E: E, W: Hb });
    }
    C.bike = {
      poses: poses, loop: 'cycle', dur: 2.4, hl: [['H', 'K']], glow: ['H'], thumb: 0,
      eq: '<path class="eq" d="M104 190 L170 238 L212 134" style="stroke-width:8"/><circle class="eq" cx="170" cy="238" r="30" style="stroke-width:5"/><path class="eq" d="M96 184 L136 184" style="stroke-width:12"/>',
      pm: ['heart', 'quads'], sm: ['calves', 'hamstrings', 'glutes']
    };
  })();
  C.rowing = {
    poses: [{ hd: [186, 126], S: [170, 152], H: [132, 214], K: [186, 176], A: [238, 224], T: [250, 228], E: [200, 152], W: [228, 166] },
      { hd: [100, 124], S: [98, 152], H: [96, 214], K: [166, 212], A: [236, 226], T: [250, 228], E: [120, 178], W: [146, 166] }],
    loop: 'cycle', dur: 3, tools: [{ t: 'handle', p: 'W', cable: [284, 170] }], hl: [['H', 'K'], ['S', 'H']], thumb: 0, floor: 236,
    eq: '<path class="eq" d="M40 238 L258 238" style="stroke-width:8"/><rect class="eqf" x="242" y="204" width="12" height="34" rx="5"/>',
    pm: ['heart', 'back'], sm: ['quads', 'biceps', 'hamstrings']
  };
  C.stretch = {
    poses: [sp({ E: [158, 126], W: [160, 160] }), sp({ E: [160, 54], W: [162, 16] })],
    hl: [['S', 'E', 'W']], thumb: 1, dur: 5, pm: [], sm: []
  };

  // ------------------------------------------------------------------ labels, groups
  var LABEL = { chest: 'Chest', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', abs: 'Abs', quads: 'Quads', calves: 'Calves', back: 'Back', lowerback: 'Lower back', glutes: 'Glutes', hamstrings: 'Hamstrings', heart: 'Heart' };
  var GROUP = { chest: 'Chest', shoulders: 'Shoulders', biceps: 'Arms', triceps: 'Arms', abs: 'Core', quads: 'Legs', calves: 'Legs', back: 'Back', lowerback: 'Back', glutes: 'Legs', hamstrings: 'Legs', heart: 'Cardio' };
  var GORDER = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Cardio'];

  // ------------------------------------------------------------------ drawing
  function derive(p, view) {
    if (view === 'front') return p;
    var o = assign({}, p);
    o.ch1 = L(p.S, p.H, 0.38);
    o.co0 = L(p.S, p.H, 0.5); o.co1 = L(p.S, p.H, 0.96);
    o.lb0 = L(p.S, p.H, 0.55);
    return o;
  }
  var f1 = function (n) { return Math.round(n * 10) / 10; };
  var pt = function (a) { return f1(a[0]) + ' ' + f1(a[1]); };
  function chain(p, keys) {
    var parts = [];
    for (var i = 0; i < keys.length; i++) { if (!p[keys[i]]) return null; parts.push((i ? 'L' : 'M') + pt(p[keys[i]])); }
    return parts.join(' ');
  }
  function timing(ex, n) {
    var dur = ex.dur || (ex.loop === 'cycle' ? 2 : 4), vals, kt, ks = [];
    if (n === 2 && ex.loop !== 'cycle') { kt = '0;.42;.52;.94;1'; vals = [0, 1, 1, 0, 0]; ks = ['.45 0 .25 1', '0 0 1 1', '.45 0 .25 1', '0 0 1 1']; }
    else { vals = []; for (var i = 0; i < n; i++) vals.push(i); vals.push(0); var k = []; for (var j = 0; j <= n; j++) k.push(f1(j / n)); kt = k.join(';'); for (var m = 0; m < n; m++) ks.push(n === 2 ? '.45 0 .55 1' : '0 0 1 1'); }
    return { dur: dur, vals: vals, kt: kt, ks: ks.join(';') };
  }
  function anim(attr, values, tm) {
    return '<animate attributeName="' + attr + '" dur="' + tm.dur + 's" repeatCount="indefinite" values="' + values.join(';') + '" keyTimes="' + tm.kt + '" calcMode="spline" keySplines="' + tm.ks + '"/>';
  }
  function pathEl(cls, ds, tm, extra) {
    var s = '<path class="' + cls + '" d="' + ds[0] + '"' + (extra || '') + '>';
    if (tm && ds.length > 1) s += anim('d', tm.vals.map(function (i) { return ds[i]; }), tm);
    return s + '</path>';
  }

  function svgBody(slug, o) {
    var ex = C[slug]; if (!ex) return '';
    var view = ex.v || 'side', animate = o.animate && !reduced && ex.poses.length > 1;
    var poses = ex.poses.map(function (p) { return derive(p, view); });
    var use = animate ? poses : [poses[o.pose != null ? Math.min(o.pose, poses.length - 1) : Math.min(ex.thumb == null ? 1 : ex.thumb, poses.length - 1)]];
    var tm = animate ? timing(ex, poses.length) : null;
    var D = function (keys) { var out = []; for (var i = 0; i < use.length; i++) { var d = chain(use[i], keys); if (!d) return null; out.push(d); } return out; };
    var P = function (cls, keys, extra) { var ds = D(keys); return ds ? pathEl(cls, ds, tm, extra) : ''; };
    var floor = ex.floor || 272, s = '';
    s += '<path class="floor" d="M24 ' + floor + ' L276 ' + floor + '"/>' + (ex.eq || '');
    if (view === 'front') {
      s += P('tor', ['Sm', 'H']) + P('lim', ['Sl', 'Sr']) + P('lim', ['Hl', 'Kl', 'Al']) + P('lim', ['Hr', 'Kr', 'Ar']) + P('lim', ['Sl', 'El', 'Wl']) + P('lim', ['Sr', 'Er', 'Wr']);
    } else {
      s += P('limf', ['H', 'K2', 'A2', 'T2']) + P('limf', ['S', 'E2', 'W2']) + P('tor', ['S', 'H']) + P('lim', ['H', 'K', 'A', 'T']) + P('lim', ['S', 'E', 'W']);
    }
    (ex.hl || []).forEach(function (keys) { s += P('hl', keys, ''); });
    (ex.glow || []).forEach(function (k) {
      var pts = use.map(function (p) { return p[k]; }), cx = pts.map(function (a) { return f1(a[0]); }), cy = pts.map(function (a) { return f1(a[1]); });
      s += '<circle class="glow" r="20" cx="' + cx[0] + '" cy="' + cy[0] + '">' + (tm ? anim('cx', tm.vals.map(function (i) { return cx[i]; }), tm) + anim('cy', tm.vals.map(function (i) { return cy[i]; }), tm) + '<animate attributeName="opacity" dur="1.6s" repeatCount="indefinite" values=".2;.55;.2"/>' : '') + '</circle>';
    });
    var hp = use.map(function (p) { return p.hd; });
    s += '<circle class="hd" r="16" cx="' + f1(hp[0][0]) + '" cy="' + f1(hp[0][1]) + '">' + (tm ? anim('cx', tm.vals.map(function (i) { return f1(hp[i][0]); }), tm) + anim('cy', tm.vals.map(function (i) { return f1(hp[i][1]); }), tm) : '') + '</circle>';
    (ex.tools || []).forEach(function (t) {
      var pts = use.map(function (p) { return p[t.p]; });
      if (t.cable) {
        var ds = pts.map(function (a) { return 'M' + pt(t.cable) + ' L' + pt(a); });
        s += pathEl('eq', ds, tm, ' style="stroke-width:3"');
      }
      var cx = pts.map(function (a) { return f1(a[0]); }), cy = pts.map(function (a) { return f1(a[1]); });
      var cls = t.t === 'db' ? 'wt' : 'hdl', r = t.t === 'db' ? 11 : 8;
      if (t.t === 'plate') {
        var ds2 = pts.map(function (a) { return 'M' + f1(a[0] + 18) + ' ' + f1(a[1] - 30) + ' L' + f1(a[0] + 18) + ' ' + f1(a[1] + 30); });
        s += pathEl('plate', ds2, tm);
      } else {
        s += '<circle class="' + cls + '" r="' + r + '" cx="' + cx[0] + '" cy="' + cy[0] + '">' + (tm ? anim('cx', tm.vals.map(function (i) { return cx[i]; }), tm) + anim('cy', tm.vals.map(function (i) { return cy[i]; }), tm) : '') + '</circle>';
      }
    });
    return s;
  }

  function fig(slug, o) {
    o = o || {};
    var b = svgBody(slug, assign({ animate: true }, o)); if (!b) return '';
    return '<svg class="gpa" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + (o.label || 'Exercise picture') + '"' + (o.style ? ' style="' + o.style + '"' : '') + '>' + b + '</svg>';
  }
  function thumb(slug, o) {
    o = o || {};
    var s = fig(slug, { animate: o.animate !== false, label: 'Picture of ' + (o.name || 'the exercise') }); if (!s) return '<div class="athumb"><span class="muted" style="font-size:22px">·</span></div>';
    return '<div class="athumb">' + s + '</div>';
  }
  function labels(list) { return (list || []).map(function (k) { return LABEL[k] || k; }); }
  function pills(slug) {
    var ex = C[slug]; if (!ex) return '';
    var l = labels(ex.pm); if (!l.length) l = ['Whole body'];
    return l.map(function (x) { return '<span class="mpill">' + x + '</span>'; }).join('');
  }
  function stage(slug, o) {
    o = o || {};
    var s = fig(slug, { animate: true, label: 'Animated picture of ' + (o.name || 'the exercise') + (C[slug] ? ', working ' + labels(C[slug].pm).join(' and ').toLowerCase() : '') });
    if (!s) return '';
    return '<div class="astage">' + s + '<div class="apills">' + pills(slug) + '</div></div>';
  }

  // ------------------------------------------------------------------ muscle maps
  var BODY = '<circle cx="60" cy="22" r="14" class="mbf"/><path class="mb" style="stroke-width:44" d="M60 62 L60 96"/><path class="mb" style="stroke-width:12" d="M36 54 L22 102 L18 142"/><path class="mb" style="stroke-width:12" d="M84 54 L98 102 L102 142"/><path class="mb" style="stroke-width:18" d="M50 122 L46 190 L46 240"/><path class="mb" style="stroke-width:18" d="M70 122 L74 190 L74 240"/>';
  var REG = {
    front: {
      chest: '<ellipse cx="50" cy="68" rx="11" ry="9"/><ellipse cx="70" cy="68" rx="11" ry="9"/>',
      shoulders: '<circle cx="36" cy="56" r="9"/><circle cx="84" cy="56" r="9"/>',
      biceps: '<ellipse cx="29" cy="80" rx="6" ry="14" transform="rotate(14 29 80)"/><ellipse cx="91" cy="80" rx="6" ry="14" transform="rotate(-14 91 80)"/>',
      abs: '<rect x="50" y="82" width="20" height="32" rx="8"/>',
      quads: '<ellipse cx="50" cy="154" rx="9" ry="30"/><ellipse cx="70" cy="154" rx="9" ry="30"/>',
      calves: '<ellipse cx="46" cy="214" rx="7" ry="18"/><ellipse cx="74" cy="214" rx="7" ry="18"/>'
    },
    back: {
      back: '<ellipse cx="60" cy="68" rx="22" ry="12"/><ellipse cx="47" cy="92" rx="9" ry="16"/><ellipse cx="73" cy="92" rx="9" ry="16"/>',
      shoulders: '<circle cx="36" cy="56" r="9"/><circle cx="84" cy="56" r="9"/>',
      triceps: '<ellipse cx="29" cy="80" rx="6" ry="14" transform="rotate(14 29 80)"/><ellipse cx="91" cy="80" rx="6" ry="14" transform="rotate(-14 91 80)"/>',
      lowerback: '<ellipse cx="60" cy="116" rx="13" ry="8"/>',
      glutes: '<ellipse cx="50" cy="136" rx="13" ry="14"/><ellipse cx="70" cy="136" rx="13" ry="14"/>',
      hamstrings: '<ellipse cx="50" cy="170" rx="9" ry="22"/><ellipse cx="70" cy="170" rx="9" ry="22"/>',
      calves: '<ellipse cx="46" cy="214" rx="7" ry="18"/><ellipse cx="74" cy="214" rx="7" ry="18"/>'
    }
  };
  function mapView(view, pm, sm) {
    var s = '<svg viewBox="0 0 120 250" width="104" height="217" role="img" aria-label="' + (view === 'front' ? 'Front' : 'Back') + ' view of the body">' + BODY;
    (sm || []).forEach(function (k) { if (REG[view][k]) s += '<g class="msec">' + REG[view][k] + '</g>'; });
    (pm || []).forEach(function (k) { if (REG[view][k]) s += '<g class="mpri">' + REG[view][k] + '</g>'; });
    return s + '</svg>';
  }
  function map(slug) {
    var ex = C[slug]; if (!ex) return '';
    return '<div class="mapbox"><div class="mapcol">' + mapView('front', ex.pm, ex.sm) + '<span>Front</span></div><div class="mapcol">' + mapView('back', ex.pm, ex.sm) + '<span>Back</span></div></div>' +
      '<div class="mapkey"><span><i class="k1"></i>Main muscles</span><span><i class="k2"></i>Helps out</span></div>';
  }
  function groups(slug) {
    var ex = C[slug], out = [];
    if (!ex) return out;
    (ex.pm || []).forEach(function (k) { var g = GROUP[k]; if (g && out.indexOf(g) < 0) out.push(g); });
    return out;
  }
  function muscleNames(slug) { return C[slug] ? { main: labels(C[slug].pm), help: labels(C[slug].sm) } : { main: [], help: [] }; }

  window.GPAnim = { has: function (s) { return !!C[s]; }, slugs: function () { return Object.keys(C); }, fig: fig, thumb: thumb, stage: stage, map: map, pills: pills, groups: groups, muscles: muscleNames, order: GORDER };
})();
