/* FitLife — анімована фігурка, що показує техніку кожної вправи.
   Кінематична модель: кути суглобів -> координати, автоматичне «приземлення» на підлогу. */
'use strict';

const Figure = (() => {
  const G = 150;                       // рівень підлоги у viewBox 0 0 200 170
  const L = {torso:46, neck:7, head:10, ua:24, fa:23, th:32, sh:32, foot:9};
  const rad = d => d * Math.PI / 180;
  const dir = a => [Math.sin(rad(a)), Math.cos(rad(a))];          // 0 = вниз, + = вперед
  const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];

  const STAND = {t:0, an1:6, an2:10, af1:-6, af2:-2, ln1:2, ln2:2, lf1:-2, lf2:-2};
  const P = (o) => Object.assign({}, STAND, o);
  // профіль «вид спереду»
  const FSTAND = {front:1, t:0, ra1:8, ra2:6, la1:8, la2:6, rl1:4, rl2:3, ll1:4, ll2:3};
  const F = (o) => Object.assign({}, FSTAND, o);

  // висока планка / упори
  const PLANK = {t:69, an1:0, an2:0, af1:0, af2:0, ln1:-69, ln2:-69, lf1:-69, lf2:-69};
  const QUAD = {t:72, an1:0, an2:0, af1:0, af2:0, ln1:2, ln2:-92, lf1:-2, lf2:-92};
  const SUP = {t:-90, an1:90, an2:90, af1:90, af2:90, ln1:150, ln2:20, lf1:150, lf2:20};   // на спині, коліна зігнуті
  const PRONE = {t:90, an1:100, an2:100, af1:100, af2:100, ln1:-90, ln2:-90, lf1:-90, lf2:-90};

  // Опис вправ: seq — ключові пози, dur — секунд на перехід, anchor — точка, що не зсувається
  const D = {
    march:   {seq:[P({ln1:75, ln2:-5, af1:45, af2:80, an1:-30, an2:-15}), P({lf1:75, lf2:-5, an1:45, an2:80, af1:-30, af2:-15})], dur:.55, anchor:'hip'},
    armcirc: {seq:[60,150,240,330,420].map(a => P({an1:a, an2:a, af1:a, af2:a})), dur:.45, loop:1},
    hipcirc: {seq:[P({t:-7, dx:-5, an1:-25, an2:40, af1:-25, af2:40}), P({t:7, dx:5, an1:-25, an2:40, af1:-25, af2:40})], dur:.9, anchor:'none'},
    twist:   {seq:[P({an1:80, an2:80, af1:-60, af2:-60}), P({an1:-60, an2:-60, af1:80, af2:80})], dur:.7},
    stepjack:{seq:[F({}), F({rl1:24, rl2:24, ra1:160, ra2:165, la1:160, la2:165}), F({}), F({ll1:24, ll2:24, ra1:160, ra2:165, la1:160, la2:165})], dur:.45, anchor:'hip'},
    jacks:   {seq:[F({}), F({rl1:17, rl2:17, ll1:17, ll2:17, ra1:165, ra2:172, la1:165, la2:172})], dur:.38, jump:12, anchor:'hip'},
    squat:   {seq:[P({an1:15, an2:20}), P({t:36, ln1:95, ln2:-26, lf1:95, lf2:-26, an1:90, an2:90, af1:90, af2:90})], dur:1},
    sumo:    {seq:[F({rl1:20, rl2:20, ll1:20, ll2:20, ra1:30, ra2:-55, la1:30, la2:-55}), F({rl1:72, rl2:-14, ll1:72, ll2:-14, ra1:30, ra2:-55, la1:30, la2:-55})], dur:1, anchor:'hip'},
    chairsq: {seq:[P({an1:20, an2:25}), P({t:32, ln1:86, ln2:-14, lf1:86, lf2:-14, an1:90, an2:90, af1:90, af2:90})], dur:1.1, props:[{type:'chair', at:'hip', dx:-26}]},
    lunge:   {seq:[P({an1:-15, an2:55, af1:-15, af2:55}), P({t:4, ln1:90, ln2:0, lf1:-18, lf2:-82, an1:-15, an2:55, af1:-15, af2:55})], dur:1, anchor:'farFoot'},
    revlunge:{seq:[P({an1:-15, an2:55, af1:-15, af2:55}), P({t:4, ln1:90, ln2:0, lf1:-18, lf2:-82, an1:-15, an2:55, af1:-15, af2:55})], dur:1, anchor:'foot'},
    sidelunge:{seq:[F({rl1:22, rl2:22, ll1:22, ll2:22, ra1:30, ra2:-55, la1:30, la2:-55}), F({t:8, dx:12, rl1:58, rl2:-12, ll1:36, ll2:36, ra1:30, ra2:-55, la1:30, la2:-55})], dur:1, anchor:'hip'},
    bridge:  {seq:[SUP, Object.assign({}, SUP, {t:-116, ln1:116, ln2:0, lf1:116, lf2:0})], dur:1},
    bridge1: {seq:[Object.assign({}, SUP, {lf1:160, lf2:160}), Object.assign({}, SUP, {t:-116, ln1:116, ln2:0, lf1:116, lf2:116})], dur:1},
    wallsit: {seq:[P({t:0, ln1:90, ln2:0, lf1:90, lf2:0, an1:90, an2:90, af1:90, af2:90}), P({t:-2, ln1:90, ln2:0, lf1:90, lf2:0, an1:85, an2:85, af1:85, af2:85})], dur:1.6, props:[{type:'wall', at:'hip', dx:-8}]},
    calf:    {seq:[P({}), P({fn:30, ff:30})], dur:.8, anchor:'toe'},
    kickback:{seq:[QUAD, Object.assign({}, QUAD, {ln1:-105, ln2:175})], dur:.8, anchor:'hand'},
    hydrant: {seq:[QUAD, Object.assign({}, QUAD, {ln1:-55, ln2:-95, wide:1})], dur:.8, anchor:'hand'},
    jumpsq:  {seq:[P({}), P({t:40, ln1:98, ln2:-28, lf1:98, lf2:-28, an1:-40, an2:-30, af1:-40, af2:-30}), P({an1:170, an2:175, af1:170, af2:175, ln2:-8, lf2:-8, fn:40, ff:40, lift:24})], dur:.45},
    stepup:  {seq:[P({}), P({ln1:70, ln2:-6, af1:40, af2:70, an1:-25, an2:-10, lift:2}), P({lift:24, dx:22, an1:6, af1:-6})], dur:.8, anchor:'farFoot', props:[{type:'box', at:'toe', dx:22, w:40, h:24, fixed:1}]},
    pushup:  {seq:[PLANK, Object.assign({}, PLANK, {t:77, ln1:-77, ln2:-77, lf1:-77, lf2:-77, an1:-62, an2:-4, af1:-62, af2:-4})], dur:.9, anchor:'foot'},
    kneepush:{seq:[{t:54, an1:0, an2:0, af1:0, af2:0, ln1:-54, ln2:-100, lf1:-54, lf2:-100}, {t:70, an1:-70, an2:0, af1:-70, af2:0, ln1:-70, ln2:-100, lf1:-70, lf2:-100}], dur:.9, anchor:'knee'},
    inclpush:{seq:[{t:43, an1:0, an2:0, af1:0, af2:0, ln1:-43, ln2:-43, lf1:-43, lf2:-43}, {t:50, an1:-60, an2:0, af1:-60, af2:0, ln1:-50, ln2:-50, lf1:-50, lf2:-50}], dur:.9, anchor:'foot', props:[{type:'table', at:'hand', h:'auto', w:44}]},
    wallpush:{seq:[P({t:20, an1:72, an2:72, af1:72, af2:72, fn:60, ff:60}), P({t:30, an1:35, an2:105, af1:35, af2:105, fn:55, ff:55})], dur:1, props:[{type:'wall', at:'hand', dx:4}]},
    dips:    {seq:[P({t:0, ln1:80, ln2:-2, lf1:80, lf2:-2, an1:-12, an2:-12, af1:-12, af2:-12}), P({t:4, ln1:96, ln2:-8, lf1:96, lf2:-8, an1:-75, an2:-8, af1:-75, af2:-8})], dur:.9, anchor:'foot', props:[{type:'box', at:'hand', h:'auto', w:40, dx:-14}]},
    pike:    {seq:[{t:138, an1:0, an2:0, af1:0, af2:0, ln1:-42, ln2:-42, lf1:-42, lf2:-42}, {t:150, an1:-55, an2:8, af1:-55, af2:8, ln1:-42, ln2:-42, lf1:-42, lf2:-42}], dur:.9, anchor:'foot'},
    superman:{seq:[PRONE, Object.assign({}, PRONE, {t:80, an1:110, an2:112, af1:110, af2:112, ln1:-80, ln2:-78, lf1:-80, lf2:-78})], dur:1},
    taps:    {seq:[PLANK, Object.assign({}, PLANK, {an1:125, an2:200})], dur:.6, anchor:'foot'},
    plank:   {seq:[{t:82, an1:0, an2:90, af1:0, af2:90, ln1:-82, ln2:-82, lf1:-82, lf2:-82}, {t:80, an1:0, an2:90, af1:0, af2:90, ln1:-80, ln2:-80, lf1:-80, lf2:-80}], dur:1.6, anchor:'foot'},
    sideplank:{seq:[{t:78, an1:0, an2:90, af1:180, af2:180, ln1:-78, ln2:-78, lf1:-78, lf2:-78}, {t:86, an1:0, an2:90, af1:170, af2:170, ln1:-86, ln2:-86, lf1:-86, lf2:-86}], dur:1.3, anchor:'foot'},
    deadbug: {seq:[{t:-90, an1:180, an2:180, af1:180, af2:180, ln1:180, ln2:90, lf1:180, lf2:90}, {t:-90, an1:265, an2:265, af1:180, af2:180, ln1:180, ln2:90, lf1:100, lf2:100}], dur:1.1},
    birddog: {seq:[QUAD, Object.assign({}, QUAD, {an1:98, an2:98, lf1:-98, lf2:-98})], dur:1.1, anchor:'knee'},
    crunch:  {seq:[Object.assign({}, SUP, {an1:120, an2:120, af1:120, af2:120}), Object.assign({}, SUP, {t:-58, an1:110, an2:110, af1:110, af2:110})], dur:.9},
    bicycle: {seq:[{t:-72, an1:225, an2:135, af1:225, af2:135, ln1:160, ln2:85, lf1:100, lf2:100}, {t:-72, an1:225, an2:135, af1:225, af2:135, ln1:100, ln2:100, lf1:160, lf2:85}], dur:.7},
    legraise:{seq:[{t:-90, an1:90, an2:90, af1:90, af2:90, ln1:98, ln2:98, lf1:98, lf2:98}, {t:-90, an1:90, an2:90, af1:90, af2:90, ln1:178, ln2:178, lf1:178, lf2:178}], dur:1.1},
    climber: {seq:[Object.assign({}, PLANK, {ln1:50, ln2:-45}), Object.assign({}, PLANK, {lf1:50, lf2:-45})], dur:.35, anchor:'hand'},
    hollow:  {seq:[{t:-68, an1:255, an2:255, af1:255, af2:255, ln1:104, ln2:104, lf1:104, lf2:104}, {t:-74, an1:262, an2:262, af1:262, af2:262, ln1:98, ln2:98, lf1:98, lf2:98}], dur:1.2},
    highknee:{seq:[P({ln1:92, ln2:-5, af1:50, af2:95, an1:-35, an2:-10}), P({lf1:92, lf2:-5, an1:50, an2:95, af1:-35, af2:-10})], dur:.3, jump:6, anchor:'hip'},
    buttkick:{seq:[P({ln1:-8, ln2:-165, af1:45, af2:90, an1:-30, an2:-10}), P({lf1:-8, lf2:-165, an1:45, an2:90, af1:-30, af2:-10})], dur:.3, jump:5, anchor:'hip'},
    burpee:  {seq:[P({}), P({t:62, ln1:112, ln2:-34, lf1:112, lf2:-34, an1:12, an2:12, af1:12, af2:12}), PLANK,
                   P({t:62, ln1:112, ln2:-34, lf1:112, lf2:-34, an1:12, an2:12, af1:12, af2:12}), P({an1:170, an2:178, af1:170, af2:178, fn:40, ff:40, lift:22})], dur:.5, anchor:'hand0'},
    skater:  {seq:[F({dx:-22, rl1:2, rl2:2, ll1:-22, ll2:-62, ra1:-30, ra2:-50, la1:55, la2:60, t:-6}), F({dx:22, ll1:2, ll2:2, rl1:-22, rl2:-62, la1:-30, la2:-50, ra1:55, ra2:60, t:6})], dur:.55, jump:10, anchor:'none'},
    boxing:  {seq:[P({ln1:16, ln2:6, lf1:-16, lf2:-6, an1:90, an2:90, af1:30, af2:160, t:6}), P({ln1:16, ln2:6, lf1:-16, lf2:-6, an1:30, an2:160, af1:90, af2:90, t:10})], dur:.35, anchor:'hip'},
    steptouch:{seq:[F({dx:-12, rl1:14, rl2:14, ll1:2, ll2:2, ra1:60, ra2:100, la1:20, la2:20}), F({dx:12, ll1:14, ll2:14, rl1:2, rl2:2, la1:60, la2:100, ra1:20, ra2:20})], dur:.5, anchor:'none'},
    childpose:{seq:[{t:112, an1:92, an2:92, af1:92, af2:92, ln1:62, ln2:-92, lf1:62, lf2:-92}, {t:118, an1:95, an2:95, af1:95, af2:95, ln1:62, ln2:-92, lf1:62, lf2:-92}], dur:2, anchor:'knee'},
    catcow:  {seq:[Object.assign({}, QUAD, {arch:-9, h:-28}), Object.assign({}, QUAD, {arch:12, h:40})], dur:1.6, anchor:'hand'},
    hamstr:  {seq:[{t:15, an1:60, an2:70, af1:60, af2:70, ln1:90, ln2:90, lf1:90, lf2:90}, {t:62, an1:95, an2:95, af1:95, af2:95, ln1:90, ln2:90, lf1:90, lf2:90}], dur:1.8, anchor:'foot'},
    quadstr: {seq:[P({ln1:-6, ln2:-160, an1:-28, an2:-20, af1:80, af2:85}), P({ln1:-12, ln2:-165, an1:-34, an2:-24, af1:85, af2:90, t:3})], dur:1.6, anchor:'farFoot'},
    chest:   {seq:[P({an1:-35, an2:-35, af1:-35, af2:-35}), P({t:-6, an1:-58, an2:-58, af1:-58, af2:-58})], dur:1.5},
    breath:  {seq:[P({an1:5, an2:8, af1:-5, af2:-2}), P({t:-3, an1:170, an2:175, af1:170, af2:175, fn:70, ff:70})], dur:2.2},
  };

  function lerp(a, b, f) {
    const o = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const va = a[k] ?? (b.front ? FSTAND[k] : STAND[k]) ?? 0, vb = b[k] ?? (a.front ? FSTAND[k] : STAND[k]) ?? 0;
      o[k] = typeof va === 'number' ? va + (vb - va) * f : vb;
    }
    return o;
  }

  // Кінематика, вид збоку
  function side(p) {
    const hip = [0, 0];
    const up = [Math.sin(rad(p.t)), -Math.cos(rad(p.t))];
    const sh = add(hip, up, L.torso);
    const hd = add(sh, [Math.sin(rad(p.t + (p.h || 0))), -Math.cos(rad(p.t + (p.h || 0)))], L.neck + L.head);
    const limb = (o, a1, a2, l1, l2) => { const m = add(o, dir(a1), l1); return [m, add(m, dir(a2), l2)]; };
    const [en, hn] = limb(sh, p.an1, p.an2, L.ua, L.fa), [ef, hf] = limb(sh, p.af1, p.af2, L.ua, L.fa);
    const [kn, an] = limb(hip, p.ln1, p.ln2, L.th, L.sh), [kf, af] = limb(hip, p.lf1, p.lf2, L.th, L.sh);
    const tn = add(an, dir(p.fn ?? p.ln2 + 90), L.foot), tf = add(af, dir(p.ff ?? p.lf2 + 90), L.foot);
    // контрольна точка вигину спини (кішка-корова)
    const mid = [(hip[0] + sh[0]) / 2, (hip[1] + sh[1]) / 2], perp = [up[1], -up[0]];
    const arch = p.arch || 0, ctrl = [mid[0] - perp[0] * arch, mid[1] - perp[1] * arch];
    return {front:0, hip, sh, hd, ctrl, en, hn, ef, hf, kn, an, kf, af, tn, tf};
  }
  // Кінематика, вид спереду
  function front(p) {
    const hip = [0, 0], up = [Math.sin(rad(p.t)), -Math.cos(rad(p.t))], side = [-up[1], up[0]];
    const neck = add(hip, up, L.torso);
    const shR = add(neck, side, 13), shL = add(neck, side, -13), hpR = add(hip, side, 7), hpL = add(hip, side, -7);
    const hd = add(neck, up, L.neck + L.head);
    const dR = a => [Math.sin(rad(a)), Math.cos(rad(a))], dL = a => [-Math.sin(rad(a)), Math.cos(rad(a))];
    const limb = (o, d1, d2, l1, l2) => { const m = add(o, d1, l1); return [m, add(m, d2, l2)]; };
    const [eR, hR] = limb(shR, dR(p.ra1), dR(p.ra2), L.ua, L.fa), [eL, hL] = limb(shL, dL(p.la1), dL(p.la2), L.ua, L.fa);
    const [kR, aR] = limb(hpR, dR(p.rl1), dR(p.rl2), L.th, L.sh), [kL, aL] = limb(hpL, dL(p.ll1), dL(p.ll2), L.th, L.sh);
    return {front:1, hip, neck, hd, shR, shL, hpR, hpL, eR, hR, eL, hL, kR, aR, kL, aL};
  }
  function lowest(k) {
    const pts = k.front
      ? [[k.aR, 3], [k.aL, 3], [k.hd, 10], [k.hR, 2], [k.hL, 2], [k.kR, 3], [k.kL, 3]]
      : [[k.tn, 1.5], [k.tf, 1.5], [k.an, 2.5], [k.af, 2.5], [k.kn, 4], [k.kf, 4], [k.hn, 2.5], [k.hf, 2.5], [k.en, 3], [k.ef, 3],
         [k.hd, 10], [k.sh, 5], [k.hip, 5]];
    return Math.max(...pts.map(([p, r]) => p[1] + r));
  }
  const anchorPt = (k, a) => k.front ? k.hip : ({foot:k.an, farFoot:k.af, toe:k.tn, hand:k.hn, hand0:k.an, knee:k.kn, hip:k.hip}[a] || k.an);

  function place(k, dx, dy) {
    const o = {};
    for (const [n, v] of Object.entries(k)) o[n] = Array.isArray(v) ? [v[0] + dx, v[1] + dy] : v;
    return o;
  }

  function draw(k, props) {
    const ln = (a, b, w, c, op = 1) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
    const NEAR = '#c6ff3d', FAR = '#7c9c2c', BODY = '#f4f5fa';
    let s = props || '';
    if (k.front) {
      s += ln(k.hpL, k.kL, 7, NEAR) + ln(k.kL, k.aL, 6.5, NEAR) + ln(k.hpR, k.kR, 7, NEAR) + ln(k.kR, k.aR, 6.5, NEAR);
      s += `<path d="M${k.hpL[0]},${k.hpL[1]} L${k.hpR[0]},${k.hpR[1]} L${k.shR[0]},${k.shR[1]} L${k.shL[0]},${k.shL[1]}Z" fill="${BODY}" stroke="${BODY}" stroke-width="6" stroke-linejoin="round"/>`;
      s += ln(k.shL, k.eL, 6, NEAR) + ln(k.eL, k.hL, 5.5, NEAR) + ln(k.shR, k.eR, 6, NEAR) + ln(k.eR, k.hR, 5.5, NEAR);
      s += ln(k.neck, k.hd, 5, BODY) + `<circle cx="${k.hd[0]}" cy="${k.hd[1]}" r="${L.head}" fill="${BODY}"/>`;
    } else {
      s += ln(k.hip, k.kf, 7, FAR) + ln(k.kf, k.af, 6.5, FAR) + ln(k.af, k.tf, 5, FAR);
      s += ln(k.sh, k.ef, 6, FAR) + ln(k.ef, k.hf, 5.5, FAR);
      s += `<path d="M${k.hip[0].toFixed(1)},${k.hip[1].toFixed(1)} Q${k.ctrl[0].toFixed(1)},${k.ctrl[1].toFixed(1)} ${k.sh[0].toFixed(1)},${k.sh[1].toFixed(1)}" stroke="${BODY}" stroke-width="12" stroke-linecap="round" fill="none"/>`;
      s += ln(k.sh, k.hd, 5, BODY) + `<circle cx="${k.hd[0].toFixed(1)}" cy="${k.hd[1].toFixed(1)}" r="${L.head}" fill="${BODY}"/>`;
      s += ln(k.hip, k.kn, 7.5, NEAR) + ln(k.kn, k.an, 7, NEAR) + ln(k.an, k.tn, 5.5, NEAR);
      s += ln(k.sh, k.en, 6.5, NEAR) + ln(k.en, k.hn, 6, NEAR);
    }
    return s;
  }

  function propSvg(defs, kA) {
    if (!defs) return '';
    return defs.map(d => {
      const p = d.at === 'toe' ? kA.tn : d.at === 'hand' ? (kA.front ? kA.hR : kA.hn) : kA.hip;
      const x = p[0] + (d.dx || 0);
      if (d.type === 'wall') return `<rect x="${x}" y="10" width="8" height="${G - 10}" rx="2" fill="rgba(255,255,255,.12)"/>`;
      if (d.type === 'chair') return `<rect x="${x - 2}" y="${G - 36}" width="30" height="5" rx="2" fill="rgba(255,255,255,.18)"/><rect x="${x - 2}" y="${G - 70}" width="5" height="70" rx="2" fill="rgba(255,255,255,.18)"/><rect x="${x + 24}" y="${G - 36}" width="4" height="36" fill="rgba(255,255,255,.18)"/>`;
      const h = d.h === 'auto' ? Math.max(8, G - p[1] - 2.5) : d.h, w = d.w || 36;
      return `<rect x="${x - w / 2}" y="${G - h}" width="${w}" height="${h}" rx="4" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.2)"/>`;
    }).join('');
  }

  function mount(el, id, opts = {}) {
    const def = D[id] || D.march;
    const kin = p => p.front ? front(p) : side(p);
    // опорна поза A — визначає центрування
    const kA0 = kin(def.seq[0]);
    const lowA = lowest(kA0);
    const xs = Object.values(kA0).filter(Array.isArray).map(v => v[0]);
    const offX = 100 - (Math.min(...xs) + Math.max(...xs)) / 2;
    const kA = place(kA0, offX, G - lowA - (def.seq[0].lift || 0));
    const anc = def.anchor || 'foot';
    const ancX = anchorPt(kA, anc)[0];
    const props = propSvg(def.props, kA);
    el.innerHTML = `<svg viewBox="0 -22 200 187" style="width:100%;height:100%;overflow:visible">
      <defs><filter id="fg"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="sh"><stop offset="0" stop-color="#c6ff3d" stop-opacity=".35"/><stop offset="1" stop-color="#c6ff3d" stop-opacity="0"/></radialGradient></defs>
      <rect x="18" y="${G + 1}" width="164" height="5" rx="2.5" fill="rgba(139,92,255,.35)"/>
      <ellipse id="shd" cx="100" cy="${G + 3}" rx="50" ry="6" fill="url(#sh)"/>
      <g id="fig" filter="url(#fg)"></g></svg>`;
    const g = el.querySelector('#fig'), shd = el.querySelector('#shd');
    const seq = def.seq, n = seq.length, durMs = (def.dur || 1) * 1000 / (opts.speed || 1);
    let raf = 0, t0 = performance.now() - (opts.at || 0) * durMs, stopped = false;
    const ease = f => .5 - .5 * Math.cos(Math.PI * f);
    function frame(now) {
      if (stopped) return;
      const tt = (now - t0) / durMs, i = Math.floor(tt) % n, f = ease(tt % 1);
      const a = seq[i], b = def.loop && i === n - 1 ? seq[0] : seq[(i + 1) % n];
      let p = (def.loop && i === n - 1) ? a : lerp(a, b, f);
      let k = kin(p);
      const jump = (def.jump || 0) * Math.sin(Math.PI * (tt % 1));
      const lift = (p.lift || 0) + jump;
      let dy = G - lowest(k) - lift;
      let dx;
      if (anc === 'none') dx = offX + (p.dx || 0);
      else { const ap = anchorPt(k, anc); dx = ancX - ap[0] + (p.dx || 0); }
      if (def.props && def.props.some(q => q.fixed) && p.lift) dy = G - lowest(k) - p.lift;
      k = place(k, dx, dy);
      g.innerHTML = draw(k, '') ;
      if (!g.dataset.p) { g.insertAdjacentHTML('beforebegin', `<g>${props}</g>`); g.dataset.p = 1; }
      shd.setAttribute('cx', k.hip[0].toFixed(1)); shd.setAttribute('rx', (46 - Math.min(30, lift)).toFixed(1));
      if (opts.at === undefined) raf = requestAnimationFrame(frame);
    }
    if (opts.at !== undefined) frame(performance.now()); else raf = requestAnimationFrame(frame);
    return {stop() { stopped = true; cancelAnimationFrame(raf); }};
  }
  return {mount, has: id => !!D[id]};
})();
