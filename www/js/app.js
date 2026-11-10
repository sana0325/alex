/* FitLife — логіка додатку */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const KEY = 'fitlife_v1';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ---------- сховище ----------
let S = load();
function load() {
  let d = null; try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  return Object.assign({profile:null, log:{}, weights:[], course:[], habitStart:{}, relapses:{}, settings:{music:true, voice:true, vol:0.8, track:0}}, d || {});
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => { const k = dkey(); if (!S.log[k]) S.log[k] = {water:0, tasks:{}, done:false, kcal:0}; return S.log[k]; };
const daysSince = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5));
const dow = () => (new Date().getDay() + 6) % 7; // 0 = понеділок

// ---------- іконки ----------
const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  train:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/></svg>',
  food:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M3 3v8a2 2 0 0 0 2 2M17 21V3c2.5 1 4 4 4 8h-4"/></svg>',
  path:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4-3 7-6.5 7-11a7 7 0 0 0-14 0c0 4.5 3 8 7 11z"/><path d="m9 11 2 2 4-4"/></svg>',
  mind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m6 5 8 7-8 7M18 5v14"/></svg>',
  prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="m18 5-8 7 8 7M6 5v14"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  music:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  mute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><path d="M3 3l18 18"/></svg>',
  voice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  novoice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 19v3H6.5"/></svg>',
};

// ---------- розрахунки ----------
function calc(p) {
  const bmi = p.w / Math.pow(p.h / 100, 2);
  const bmr = 10 * p.w + 6.25 * p.h - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const mult = [1.2, 1.375, 1.55, 1.725][p.act] || 1.375;
  const tdee = bmr * mult;
  let goal = p.goal, note = '';
  if (goal === 'lose' && bmi < 18.5) { goal = 'fit'; note = 'Твій ІМТ нижче норми, тому замість схуднення програма тримає підтримку ваги і набір сили. Порадься з лікарем.'; }
  else if (goal === 'lose' && p.age < 18) { goal = 'fit'; note = 'До 18 років організм росте, тому програма не урізає калорії: харчування на підтримку, а форму покращуємо тренуваннями.'; }
  let kcal = goal === 'lose' ? tdee * 0.82 : goal === 'gain' ? tdee * 1.1 : tdee;
  const floor = p.sex === 'm' ? 1500 : 1300;
  if (kcal < floor) kcal = Math.min(floor, tdee);
  kcal = Math.round(kcal / 10) * 10;
  const refW = bmi > 30 ? 27 * Math.pow(p.h / 100, 2) : p.w; // скоригована вага при ожирінні
  const prot = Math.round(refW * (goal === 'fit' ? 1.6 : goal === 'lose' ? 1.8 : 2.0));
  let fat = Math.round(Math.max(refW * 0.9, kcal * 0.22 / 9));
  const carb = Math.max(50, Math.round((kcal - prot * 4 - fat * 9) / 4));
  const water = Math.min(4, Math.round(p.w * 0.033 * 10) / 10);
  let cat, catc;
  if (bmi < 18.5) { cat = 'Недостатня вага'; catc = 'var(--cyan)'; }
  else if (bmi < 25) { cat = 'Норма'; catc = 'var(--lime)'; }
  else if (bmi < 30) { cat = 'Надмірна вага'; catc = 'var(--sun)'; }
  else { cat = 'Ожиріння'; catc = 'var(--coral)'; }
  return {bmi:Math.round(bmi * 10) / 10, bmr:Math.round(bmr), tdee:Math.round(tdee), kcal, prot, fat, carb, water, cat, catc, goal, note};
}

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(a, r) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function limits(p) {
  const c = new Set(p.conds || []), bmi = p.w / Math.pow(p.h / 100, 2);
  const ban = new Set(), notes = [];
  let cap = 99, minRest = 0, maxRounds = 9, lvl = p.level;
  if (p.level === 0) ban.add('i3');
  if (c.has('heart')) { ['j','i3'].forEach(x => ban.add(x)); cap = 30; minRest = 30; maxRounds = 2;
    notes.push('❤️ Серце/тиск: тренуйся в темпі, при якому можеш говорити. При болю в грудях, запамороченні, сильній задишці — негайно зупинись. Перед початком — дозвіл кардіолога.'); }
  if (c.has('joints')) { ban.add('j'); ban.add('k'); notes.push('🦴 Суглоби: без стрибків і глибоких випадів. Присідай лише в безболісній амплітуді.'); }
  if (c.has('back')) { ban.add('b'); ban.add('j'); notes.push('🧍 Спина: без скручувань і берпі. Акцент на стабілізацію корпусу (планка, «птах-собака», місток).'); }
  if (c.has('wrist')) { ban.add('w'); notes.push('✋ Зап\'ястя/плечі: вправи з упором на руки замінено.'); }
  if (c.has('asthma')) { ban.add('i3'); minRest = Math.max(minRest, 30); notes.push('🫁 Астма: тримай інгалятор поруч, довша розминка, помірна інтенсивність.'); }
  if (c.has('diabetes')) notes.push('🩸 Діабет: контролюй цукор до і після тренування, май під рукою швидкі вуглеводи. Узгодь план з ендокринологом.');
  if (c.has('pregnant')) { ['j','b','s','i3','k'].forEach(x => ban.add(x)); lvl = 0; cap = 30; minRest = 30; maxRounds = 2;
    notes.push('🤰 Вагітність: лише м\'які вправи без положення на спині та стрибків. Обов\'язково узгодь з лікарем.'); }
  if (c.has('injury')) { ban.add('i3'); ban.add('j'); notes.push('🩹 Травма: не навантажуй пошкоджену ділянку. Біль = стоп.'); }
  if (bmi >= 30) { ban.add('j'); notes.push('⚖️ Для твоєї ваги програма без стрибків — бережемо суглоби. Стрибки додамо, коли вага знизиться.'); }
  if (p.age >= 60) { ban.add('j'); ban.add('i3'); }
  return {ban, cap, minRest, maxRounds, lvl, notes};
}
const allowed = (id, L) => { const e = EX[id]; if (!e) return false;
  if (L.ban.has('i3') && e.i === 3) return false;
  for (const f of ['j','k','b','w','s']) if (L.ban.has(f) && e[f]) return false; return true; };

function weekNo() { const p = S.profile; return p ? Math.floor(daysSince(p.start) / 7) : 0; }

function buildWorkout(dayIdx, quick) {
  const p = S.profile, L = limits(p);
  let type = WEEK[dayIdx];
  if (type === 'hiit' && (L.ban.has('i3') || L.ban.has('j'))) type = 'cardio';
  const D = DAYTYPES[type], wk = weekNo();
  const r = rng(dayIdx * 97 + wk * 7919 + 13);
  const safe = ['march','steptouch','chairsq','wallpush','calf','boxing','birddog','superman','stepjack','plank'];
  let pool = shuffle(D.pool.filter(id => allowed(id, L)), r);
  const n = quick ? 4 : D.n;
  for (const s of shuffle(safe, r)) { if (pool.length >= n) break; if (allowed(s, L) && !pool.includes(s)) pool.push(s); }
  const exs = pool.slice(0, n);
  const lv = [{w:30, r:30, n:2}, {w:40, r:20, n:3}, {w:45, r:15, n:3}][L.lvl] || {w:30, r:30, n:2};
  let work = lv.w + Math.min(10, Math.floor(wk / 2) * 5), rest = lv.r, rounds = lv.n + (wk >= 4 && L.lvl > 0 ? 1 : 0);
  if (D.mob) { work = 40; rest = 10; rounds = 1; }
  work = Math.min(work, L.cap); rest = Math.max(rest, L.minRest); rounds = Math.min(rounds, L.maxRounds);
  if (quick) rounds = Math.min(rounds, 2);
  const warm = WARMUP.filter(id => allowed(id, L)).slice(0, D.mob ? 2 : 4);
  const cool = COOLDOWN.filter(id => allowed(id, L)).slice(0, 3);
  return {type, title: quick ? 'Експрес · ' + D.t : D.t, color:D.c, exs, warm, cool, work, rest, rounds, notes:L.notes, rest_day:!!D.rest};
}
function segments(W) {
  const s = [{k:'prep', id:W.warm[0] || W.exs[0], d:10}];
  W.warm.forEach(id => s.push({k:'warm', id, d:30}));
  for (let r = 0; r < W.rounds; r++) {
    W.exs.forEach((id, i) => {
      s.push({k:'work', id, d:W.work, round:r + 1});
      const last = i === W.exs.length - 1;
      if (!(last && r === W.rounds - 1)) s.push({k:'rest', id:last ? W.exs[0] : W.exs[i + 1], d:last ? Math.max(60, W.rest) : W.rest});
    });
  }
  W.cool.forEach(id => s.push({k:'cool', id, d:30}));
  return s;
}
function wKcal(W) {
  const kg = S.profile.w; let k = 0;
  segments(W).forEach(s => { const met = s.k === 'rest' || s.k === 'prep' ? 1.8 : EX[s.id].met; k += met * kg * s.d / 3600; });
  return Math.round(k);
}
const wMin = W => Math.round(segments(W).reduce((a, s) => a + s.d, 0) / 60);

// ---------- UI-хелпери ----------
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); }
function ring(pct, color, size = 120, sw = 12) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="rgba(255,255,255,.08)" stroke-width="${sw}" fill="none"/>
  <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}" style="filter:drop-shadow(0 0 6px ${color});transition:stroke-dashoffset .6s"/></svg>`;
}
function confetti() {
  const c = document.createElement('canvas'); c.className = 'conf'; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
  const x = c.getContext('2d'), cols = ['#c6ff3d','#3df5ff','#8b5cff','#ff5c7a','#ffd23d'];
  const ps = Array.from({length:140}, () => ({x:c.width / 2, y:c.height / 2, vx:(Math.random() - .5) * 16, vy:-Math.random() * 18 - 4, s:Math.random() * 8 + 4, c:cols[Math.floor(Math.random() * 5)], r:Math.random() * 6}));
  let f = 0; (function tick() { x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += .1; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 140) requestAnimationFrame(tick); else c.remove(); })();
}
function vib(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} }
let wakeLock = null;
async function keepAwake(on) {
  try { window.AndroidBridge && AndroidBridge.keepAwake(!!on); } catch (e) {}
  try { if (on && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); else if (!on && wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}
function overlay(html, cls = '') {
  const o = document.createElement('div'); o.className = 'ov ' + cls; o.innerHTML = html; document.body.appendChild(o);
  overlays.push(o); return o;
}
const overlays = [];
function closeOverlay(o) { o = o || overlays[overlays.length - 1]; if (!o) return; if (o._onclose) o._onclose(); o.remove(); overlays.splice(overlays.indexOf(o), 1); }
// кнопка «назад» Android
window.appBack = () => { if (overlays.length) { closeOverlay(); return true; } if (tab !== 'home' && S.profile) { go('home'); return true; } return false; };

// ---------- ЗВУК З ФАЙЛІВ (нейронний голос + оркестр), запасний варіант — синтез ----------
const Snd = (() => {
  const M = window.AUDIO_MANIFEST || null;
  const music = new Audio(); music.loop = true; music.preload = 'auto';
  const voice = new Audio(); voice.preload = 'auto';
  let vol = 0.8, usingSynth = false;
  const mv = () => vol * 0.75;
  voice.onended = voice.onerror = () => { music.volume = mv(); };
  return {
    get ok() { return !!M; }, M,
    setVol(v) { vol = v; music.volume = mv(); Audio2.setVolume(v); },
    music(i) {
      if (!M || !M.tracks.length) { usingSynth = true; Audio2.playWorkout(i); return; }
      music.src = 'audio/m/' + M.tracks[((i % M.tracks.length) + M.tracks.length) % M.tracks.length] + '.mp3';
      music.volume = mv(); music.currentTime = 0; music.play().catch(() => {});
    },
    stopMusic() { music.pause(); if (usingSynth) { Audio2.stop(); usingSynth = false; } },
    get playing() { return !music.paused || usingSynth && !!Audio2.playing; },
    cue(name, text) {
      if (!S.settings.voice) return;
      if (!M) { Voice.say(text); return; }
      voice.pause(); voice.src = 'audio/c/' + name + '.mp3';
      music.volume = mv() * 0.3; voice.play().catch(() => { music.volume = mv(); });
    },
    stopVoice() { voice.pause(); music.volume = mv(); Voice.stop(); },
  };
})();

// ---------- SPLASH ----------
function splash() {
  app.innerHTML = `<div class="splash">
    <div class="ring-logo"><b>⚡</b></div>
    <div>
      <div class="h wm"><span>Welcome,</span><span class="grad">my</span><span class="grad">friend</span></div>
      <div class="h7 ua" style="margin-top:14px">Вітаю, мій друже 👋</div>
      <p class="mut" style="margin-top:14px;opacity:0;animation:up .9s 1s forwards">Тренування вдома без тренажерів, харчування, відновлення тіла і розуму — під тебе.</p>
    </div>
    <div style="opacity:0;animation:up .9s 1.2s forwards">
      <button class="btn w" id="go">Почати шлях ${I.next.replace('<svg', '<svg width="20"')}</button>
      <p class="dim" style="font-size:11.5px;text-align:center;margin-top:12px">Додаток не замінює консультацію лікаря.</p>
    </div></div>`;
  $('#go').onclick = () => { Audio2.init(); Audio2.beep('go'); Snd.cue('welcome', CUES.welcome); onboarding(0); };
}

// ---------- ОНБОРДИНГ ----------
const draft = {name:'', sex:'m', age:30, h:178, w:80, goal:'lose', act:1, level:0, conds:[], habits:[], smokeDay:15, smokePrice:100, ready:false};
function onboarding(step) {
  if (S.profile && step === 0 && !draft._loaded) { Object.assign(draft, S.profile); draft._loaded = true; }
  const steps = [stName, stBody, stSize, stGoal, stLevel, stHealth, stHabits, stDone];
  const total = steps.length;
  const v = steps[step]();
  app.innerHTML = `<div class="ob">
    <div class="row between"><button class="ic" id="bk" ${step ? '' : 'style="visibility:hidden"'}>${I.back}</button><span class="tag">Крок ${step + 1} / ${total}</span><span style="width:44px"></span></div>
    <div class="prog"><i style="width:${(step + 1) / total * 100}%"></i></div>
    ${v.html}
    <div class="foot"><button class="btn w" id="nx">${v.btn || 'Далі'}</button></div></div>`;
  $('#bk').onclick = () => onboarding(step - 1);
  v.bind && v.bind();
  $('#nx').onclick = () => { if (v.ok && !v.ok()) return; if (step < total - 1) onboarding(step + 1); else finish(); };
}
function optGroup(sel, key, multi, red) {
  document.querySelectorAll(sel + ' .opt').forEach(b => b.onclick = () => {
    const val = b.dataset.v;
    if (multi) { const a = draft[key]; if (val === 'none') draft[key] = [];
      else { const i = a.indexOf(val); i >= 0 ? a.splice(i, 1) : a.push(val); }
      document.querySelectorAll(sel + ' .opt').forEach(x => x.classList.toggle('on', x.dataset.v === 'none' ? !draft[key].length : draft[key].includes(x.dataset.v)));
    } else { draft[key] = isNaN(+val) ? val : +val; document.querySelectorAll(sel + ' .opt').forEach(x => x.classList.toggle('on', x === b)); }
    vib(10);
  });
}
const opt = (v, e, t, sub, on, red) => `<button class="opt ${on ? 'on' : ''} ${red ? 'red' : ''}" data-v="${v}"><span class="e">${e}</span><span>${t}${sub ? `<small>${sub}</small>` : ''}</span></button>`;

function stName() { return {
  html:`<h2 class="h">Як тебе звати?</h2><p class="mut">Щоб я міг звертатися до тебе на ім'я.</p>
    <div class="field"><input class="inp" id="nm" placeholder="Твоє ім'я" value="${esc(draft.name)}" maxlength="24" autocomplete="off"></div>`,
  bind(){ $('#nm').oninput = e => draft.name = e.target.value.trim(); },
  ok(){ if (!draft.name) { toast('Введи ім\'я'); return false; } return true; } }; }
function stBody() { return {
  html:`<h2 class="h">Привіт, ${esc(draft.name)}!</h2><p class="mut">Трохи про тебе.</p>
    <div class="opts two" id="sx">${opt('m','👨','Чоловік','',draft.sex==='m')}${opt('f','👩','Жінка','',draft.sex==='f')}</div>
    <div class="field"><label>Вік</label><input class="inp" id="ag" type="number" inputmode="numeric" min="14" max="90" value="${draft.age}"></div>`,
  bind(){ optGroup('#sx','sex'); $('#ag').oninput = e => draft.age = +e.target.value; },
  ok(){ if (!(draft.age >= 14 && draft.age <= 90)) { toast('Вік від 14 до 90'); return false; } return true; } }; }
function stSize() {
  const upd = () => { const b = draft.w / Math.pow(draft.h / 100, 2); const c = calc(draft);
    $('#bmi').innerHTML = isFinite(b) && b > 0 ? `ІМТ <b style="color:${c.catc}">${c.bmi}</b> · <span style="color:${c.catc}">${c.cat}</span>` : ''; };
  return {
  html:`<h2 class="h">Зріст і вага</h2><p class="mut">Підберемо навантаження під твою вагову категорію.</p>
    <div class="row"><div class="field" style="flex:1"><label>Зріст, см</label><input class="inp" id="hh" type="number" inputmode="numeric" value="${draft.h}"></div>
    <div class="field" style="flex:1"><label>Вага, кг</label><input class="inp" id="ww" type="number" inputmode="decimal" value="${draft.w}"></div></div>
    <div class="card sp" id="bmi" style="text-align:center;font-size:18px"></div>`,
  bind(){ $('#hh').oninput = e => { draft.h = +e.target.value; upd(); }; $('#ww').oninput = e => { draft.w = +e.target.value; upd(); }; upd(); },
  ok(){ if (!(draft.h > 120 && draft.h < 230 && draft.w > 35 && draft.w < 250)) { toast('Перевір зріст і вагу'); return false; } return true; } }; }
function stGoal() { return {
  html:`<h2 class="h">Твоя ціль</h2><p class="mut">Що для тебе зараз головне?</p>
    <div class="opts" id="gl">${opt('lose','🔥','Схуднути','Спалити жир, зберегти м\'язи',draft.goal==='lose')}
    ${opt('fit','⚡','Форма і здоров\'я','Витривалість, енергія, тонус',draft.goal==='fit')}
    ${opt('gain','💪','Набрати м\'язи','Сила і об\'єм',draft.goal==='gain')}</div>`,
  bind(){ optGroup('#gl','goal'); } }; }
function stLevel() { return {
  html:`<h2 class="h">Активність</h2><p class="mut">Скільки ти рухаєшся зараз?</p>
    <div class="opts" id="ac">${opt(0,'🛋️','Мало','Сидяча робота, без спорту',draft.act===0)}${opt(1,'🚶','Трохи','Прогулянки, 1–2 тренування',draft.act===1)}
    ${opt(2,'🏃','Середньо','3–5 тренувань на тиждень',draft.act===2)}${opt(3,'🪖','Багато','Фізична робота / служба',draft.act===3)}</div>
    <div class="field"><label>Рівень підготовки</label></div>
    <div class="opts" id="lv" style="margin-top:0">${opt(0,'🌱','Новачок','Віджимаюсь до 10 разів',draft.level===0)}${opt(1,'🔥','Середній','10–25 віджимань',draft.level===1)}${opt(2,'🏆','Досвідчений','25+ віджимань, тренуюсь давно',draft.level===2)}</div>`,
  bind(){ optGroup('#ac','act'); optGroup('#lv','level'); } }; }
function stHealth() { return {
  html:`<h2 class="h">Здоров'я</h2><p class="mut">Є якісь захворювання чи обмеження? Особливо — проблеми з серцем для кардіо. Програма підлаштується.</p>
    <div class="opts" id="hc">${CONDITIONS.map(c => opt(c.id, c.icon, c.t, '', draft.conds.includes(c.id), true)).join('')}
    ${opt('none','✅','Нічого з цього','',!draft.conds.length)}</div>
    <div class="note">При хронічних хворобах, після операцій чи у вагітності — перед стартом обов'язково порадься з лікарем.</div>`,
  bind(){ optGroup('#hc','conds',true); } }; }
function stHabits() {
  const sm = () => draft.habits.includes('smoke') ? `<div class="card sp"><div class="row"><div class="field" style="flex:1;margin:0"><label>Сигарет/день</label><input class="inp" id="sd" type="number" value="${draft.smokeDay}"></div><div class="field" style="flex:1;margin:0"><label>Ціна пачки, грн</label><input class="inp" id="sp" type="number" value="${draft.smokePrice}"></div></div></div>` : '';
  return {
  html:`<h2 class="h">Звички</h2><p class="mut">Чесно: що тягне тебе назад? Це бачиш лише ти. Для кожної звички буде фізична і психологічна програма відновлення.</p>
    <div class="opts" id="hb">${HABITS.map(h => opt(h.id, h.icon, h.t, '', draft.habits.includes(h.id), true)).join('')}
    ${opt('none','🌿','Шкідливих звичок немає','',!draft.habits.length)}</div><div id="smx">${sm()}</div>`,
  bind(){ const b = () => { $('#smx').innerHTML = sm(); const sd = $('#sd'), sp = $('#sp');
      if (sd) { sd.oninput = e => draft.smokeDay = +e.target.value; sp.oninput = e => draft.smokePrice = +e.target.value; } };
    optGroup('#hb','habits',true); document.querySelectorAll('#hb .opt').forEach(x => x.addEventListener('click', b)); b(); } }; }
function stDone() {
  const c = calc(draft);
  return { btn:'Я готовий стати на правильний шлях 🚀',
  html:`<h2 class="h">Твій план <span class="grad">готовий</span></h2>
    <div class="bento"><div class="card"><span class="tag">Калорії/день</span><div class="h big">${c.kcal}</div></div>
    <div class="card"><span class="tag">ІМТ</span><div class="h big" style="color:${c.catc}">${c.bmi}</div><small style="color:${c.catc}">${c.cat}</small></div>
    <div class="card"><span class="tag">Білок</span><div class="h big">${c.prot}<small style="font-size:14px"> г</small></div></div>
    <div class="card"><span class="tag">Вода</span><div class="h big">${c.water}<small style="font-size:14px"> л</small></div></div></div>
    ${c.note ? `<div class="warn">${c.note}</div>` : ''}
    <div class="card sp"><b>Програма включає:</b><p class="mut" style="margin-top:6px">• Тренування вдома 6 днів/тиждень з урахуванням здоров'я<br>• Харчування з порціями в грамах<br>${draft.habits.length ? '• Програму відновлення: ' + draft.habits.map(h => RECOVERY[h].t).join(', ') + '<br>' : ''}• 30-денний психологічний курс<br>• Сеанси розслаблення під симфонічну музику<br>• Бібліотеку</p></div>` };
}
function finish() {
  const old = S.profile;
  S.profile = Object.assign({}, draft, {start: old ? old.start : new Date().toISOString()});
  delete S.profile._loaded;
  S.profile.habits.forEach(h => { if (!S.habitStart[h]) S.habitStart[h] = new Date().toISOString(); });
  if (!S.weights.length || !old) S.weights.push([dkey(), S.profile.w]);
  save(); confetti(); Audio2.beep('go');
  Snd.cue('ready', CUES.ready);
  main('home');
}

// ---------- ГОЛОВНИЙ ЕКРАН ----------
let tab = 'home';
function main(t) {
  tab = t || tab;
  app.innerHTML = `<div class="scroll" id="sc"></div>
    <nav>${[['home','Головна'],['train','Тренування'],['food','Їжа'],['path','Шлях'],['mind','Розум']].map(([k, n]) =>
      `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${I[k]}<span>${n}</span></button>`).join('')}</nav>`;
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => { vib(8); go(b.dataset.t); });
  ({home, train, food, path, mind})[tab]();
  $('#sc').scrollTop = 0;
}
function go(t) { main(t); }
function header(title, sub) {
  return `<div class="row between"><div><span class="tag"><span class="dot"></span>${sub}</span><div class="h" style="font-size:28px;margin-top:6px">${title}</div></div>
    <div class="row" style="gap:8px;flex:none">${S.profile.habits.length ? '<button class="sosbtn" id="sos">SOS</button>' : ''}<button class="ic" id="prof">${I.user}</button></div></div>`;
}
function bindHeader() { const b = $('#prof'); if (b) b.onclick = openProfile; const sos = $('#sos'); if (sos) sos.onclick = openSOS; }

function home() {
  const p = S.profile, c = calc(p), t = today(), W = buildWorkout(dow());
  const h = new Date().getHours(), greet = h < 6 ? 'Доброї ночі' : h < 12 ? 'Доброго ранку' : h < 18 ? 'Доброго дня' : 'Доброго вечора';
  const glasses = Math.round(c.water / 0.25), q = QUOTES[new Date().getDate() % QUOTES.length];
  const streak = (() => { let n = 0; const d = new Date(); if (!(S.log[dkey(d)] || {}).done) d.setDate(d.getDate() - 1);
    while ((S.log[dkey(d)] || {}).done) { n++; d.setDate(d.getDate() - 1); } return n; })();
  const doneWeek = Object.entries(S.log).filter(([k, v]) => v.done && daysSince(k) < 7).length;
  $('#sc').innerHTML = header(`${greet},<br><span class="grad">${esc(p.name)}</span>`, new Date().toLocaleDateString('uk-UA', {weekday:'long', day:'numeric', month:'long'})) + `
    <div class="card sp" style="background:linear-gradient(135deg,${W.color}22,transparent 60%),var(--card)">
      <span class="tag"><span class="dot" style="background:${W.color};box-shadow:0 0 12px ${W.color}"></span>Сьогодні · Тиждень ${weekNo() + 1}</span>
      <div class="h" style="font-size:26px;margin:10px 0 4px">${W.title}</div>
      <p class="mut">${W.rest_day ? 'Легка розтяжка + прогулянка 30–40 хв' : `${W.exs.length} вправ · ${W.rounds} кола · ~${wMin(W)} хв · ~${wKcal(W)} ккал`}</p>
      <div class="row" style="margin-top:16px;gap:10px">
        <button class="btn" id="start" style="flex:1">${t.done ? '✓ Виконано · Ще раз' : 'Почати'} ${I.play.replace('<svg', '<svg width="18"')}</button>
        <button class="btn ghost sm" id="quick" style="height:58px">⚡ 10 хв</button></div>
    </div>
    <div class="bento">
      <div class="card"><span class="tag">Серія</span><div class="h big">${streak}<small style="font-size:14px"> 🔥</small></div><small class="mut">днів поспіль</small></div>
      <div class="card"><span class="tag">Тиждень</span><div class="h big">${doneWeek}<small style="font-size:14px">/6</small></div><small class="mut">тренувань</small></div>
      <div class="card span2"><div class="row between"><span class="tag">💧 Вода · ${(t.water * 0.25).toFixed(2)} / ${c.water} л</span><button class="ic" id="wplus" style="width:38px;height:38px">${I.plus}</button></div>
        <div class="water" id="wat">${Array.from({length:glasses}, (_, i) => `<b class="${i < t.water ? 'f' : ''}" data-i="${i}"></b>`).join('')}</div></div>
      <div class="card span2"><div class="row">
        <div class="ringwrap">${ring(1, 'var(--lime)')}<div class="c"><div><div class="h" style="font-size:22px">${c.kcal}</div><small class="mut">норма ккал</small></div></div></div>
        <div style="flex:1">${macro('Білки', c.prot, 'var(--coral)')}${macro('Жири', c.fat, 'var(--sun)')}${macro('Вуглеводи', c.carb, 'var(--cyan)')}</div></div>
        ${t.kcal ? `<div class="pill" style="display:inline-block;margin-top:6px">🔥 Спалено на тренуваннях сьогодні: ~${t.kcal} ккал</div>` : ''}</div>
    </div>
    ${p.habits.length ? `<div class="card sp"><span class="tag">Шлях свободи</span><div class="row" style="flex-wrap:wrap;gap:10px;margin-top:10px">
      ${p.habits.map(hb => `<div class="pill" style="font-size:14px">${RECOVERY[hb].icon} <b>${daysSince(S.habitStart[hb])}</b> дн.</div>`).join('')}</div></div>` : ''}
    <div class="card sp"><div class="row between"><span class="tag">⚖️ Вага</span><button class="btn ghost sm" id="addw">+ Записати</button></div>${weightChart()}</div>
    <div class="card sp" style="background:linear-gradient(135deg,rgba(139,92,255,.25),transparent),var(--card)"><span class="tag">Думка дня</span><div class="h7" style="font-size:19px;margin-top:8px;line-height:1.35">«${q}»</div></div>`;
  bindHeader();
  $('#start').onclick = () => W.rest_day ? startWorkout(W) : startWorkout(W);
  $('#quick').onclick = () => startWorkout(buildWorkout(dow() === 6 ? 0 : dow(), true));
  $('#wplus').onclick = () => { t.water++; save(); vib(15); home(); if (t.water === glasses) { toast('💧 Норму води виконано!'); confetti(); } };
  document.querySelectorAll('#wat b').forEach(b => b.onclick = () => { const i = +b.dataset.i; t.water = t.water === i + 1 ? i : i + 1; save(); home(); });
  $('#addw').onclick = addWeight;
}
const macro = (n, g, c) => `<div style="margin:4px 0 10px"><div class="row between" style="font-size:13px"><b>${n}</b><span class="mut">${g} г</span></div><div class="bar"><i style="width:100%;background:${c}"></i></div></div>`;
function weightChart() {
  const w = S.weights.slice(-20); if (!w.length) return '';
  const last = w[w.length - 1][1], first = w[0][1], diff = Math.round((last - first) * 10) / 10;
  if (w.length < 2) return `<div class="h big" style="margin-top:6px">${last} <small style="font-size:14px">кг</small></div>`;
  const min = Math.min(...w.map(x => x[1])) - 1, max = Math.max(...w.map(x => x[1])) + 1, W = 320, H = 100;
  const pts = w.map((x, i) => [i / (w.length - 1) * W, H - (x[1] - min) / (max - min) * H]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<div class="row" style="margin-top:6px;gap:10px"><span class="h big">${last}</span><span class="pill" style="color:${diff <= 0 ? 'var(--lime)' : 'var(--sun)'}">${diff > 0 ? '+' : ''}${diff} кг</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H + 10}" preserveAspectRatio="none"><defs><linearGradient id="gw" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c6ff3d" stop-opacity=".35"/><stop offset="1" stop-color="#c6ff3d" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${W} ${H + 10} L0 ${H + 10}Z" fill="url(#gw)"/><path d="${d}" fill="none" stroke="#c6ff3d" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
}
function addWeight() {
  const o = overlay(`<div class="in"><div class="row between"><div class="h" style="font-size:26px">Вага сьогодні</div><button class="ic" id="cx">${I.x}</button></div>
    <div class="field"><input class="inp" id="nw" type="number" inputmode="decimal" step="0.1" value="${S.weights.length ? S.weights[S.weights.length - 1][1] : S.profile.w}"></div>
    <button class="btn w sp" id="sv">Зберегти</button><p class="mut sp" style="font-size:13px">Зважуйся зранку натще, 1–2 рази на тиждень. Вага коливається щодня — дивись на тренд.</p></div>`);
  $('#cx', o).onclick = () => closeOverlay(o);
  $('#sv', o).onclick = () => { const v = +$('#nw', o).value; if (!(v > 30 && v < 260)) return toast('Перевір значення');
    const k = dkey(); const i = S.weights.findIndex(x => x[0] === k); i >= 0 ? S.weights[i][1] = v : S.weights.push([k, v]);
    S.profile.w = v; save(); closeOverlay(o); main('home'); toast('Збережено ✓'); };
}

// ---------- ТРЕНУВАННЯ ----------
let selDay = null;
function train() {
  if (selDay === null) selDay = dow();
  const W = buildWorkout(selDay), days = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const mon = new Date(); mon.setDate(mon.getDate() - dow());
  const done = i => { const d = new Date(mon); d.setDate(mon.getDate() + i); return (S.log[dkey(d)] || {}).done; };
  $('#sc').innerHTML = header('Тренування', 'Вдома · без тренажерів') + `
    <div class="week">${days.map((d, i) => `<button data-d="${i}" class="${i === selDay ? 'on' : ''} ${done(i) ? 'done' : ''}">${d}<i style="background:${DAYTYPES[WEEK[i]].c}"></i></button>`).join('')}</div>
    <div class="card sp" style="background:linear-gradient(135deg,${W.color}26,transparent 60%),var(--card)">
      <span class="tag">${days[selDay]}${selDay === dow() ? ' · Сьогодні' : ''}</span>
      <div class="h" style="font-size:26px;margin:8px 0 6px">${W.title}</div>
      <div class="row" style="flex-wrap:wrap;gap:8px"><span class="pill">⏱ ~${wMin(W)} хв</span><span class="pill">🔥 ~${wKcal(W)} ккал</span><span class="pill">🔁 ${W.rounds} кола</span><span class="pill">${W.work}с / ${W.rest}с</span></div>
      ${W.rest_day ? '<p class="mut sp">День відновлення: легка розтяжка нижче + обов\'язкова прогулянка 30–40 хвилин на свіжому повітрі.</p>' : ''}
      <button class="btn w sp" id="st">Почати тренування ${I.play.replace('<svg', '<svg width="18"')}</button>
    </div>
    ${W.notes.length ? `<div class="warn">${W.notes.join('<br><br>')}</div>` : ''}
    <div class="card sp"><span class="tag">Розминка</span>${W.warm.map(id => exRow(id, '30 с')).join('')}</div>
    <div class="card sp"><span class="tag">Основна частина × ${W.rounds}</span>${W.exs.map(id => exRow(id, W.work + ' с')).join('')}</div>
    <div class="card sp"><span class="tag">Заминка</span>${W.cool.map(id => exRow(id, '30 с')).join('')}</div>
    <div class="card sp"><span class="tag">🎵 Музика для тренувань</span>
      ${Audio2.TRACKS.map((t, i) => `<button class="chk ${S.settings.track === i ? 'on' : ''}" data-tr="${i}"><i>${S.settings.track === i ? '♪' : ''}</i><span style="text-decoration:none;color:var(--tx)">${t.t} <small class="mut">· ${t.bpm} BPM</small></span></button>`).join('')}
      <button class="btn ghost sm sp" id="prev">${Snd.playing ? '■ Зупинити' : '▶ Прослухати'}</button></div>
    <p class="dim" style="font-size:12px;margin-top:14px;text-align:center">Програма прогресує: кожні 2 тижні час роботи зростає. Тиждень ${weekNo() + 1}.</p>`;
  bindHeader();
  document.querySelectorAll('.week button').forEach(b => b.onclick = () => { selDay = +b.dataset.d; train(); });
  document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => exInfo(b.dataset.ex));
  document.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { S.settings.track = +b.dataset.tr; save(); if (Snd.playing) Snd.music(S.settings.track); train(); });
  $('#prev').onclick = () => { if (Snd.playing) Snd.stopMusic(); else Snd.music(S.settings.track); train(); };
  $('#st').onclick = () => { Snd.stopMusic(); startWorkout(W); };
}
const exRow = (id, d) => `<button class="exl" data-ex="${id}" style="width:100%;text-align:left"><div class="em">${EX[id].e}</div><div style="flex:1"><b>${EX[id].n}</b><small>${EX[id].m}</small></div><span class="pill">${d}</span></button>`;
function exInfo(id) {
  const e = EX[id];
  const o = overlay(`<div class="in"><div class="row between"><span class="tag">${e.m}</span><button class="ic" id="cx">${I.x}</button></div>
    <div class="figbox" id="fgx"></div>
    <div class="h" style="font-size:28px">${e.n}</div><p style="font-size:17px;margin-top:12px">${e.d}</p>
    <div class="row sp" style="flex-wrap:wrap;gap:8px"><span class="pill">Інтенсивність ${'●'.repeat(e.i)}${'○'.repeat(3 - e.i)}</span>${e.j ? '<span class="pill">Стрибки</span>' : '<span class="pill">Без стрибків</span>'}</div>
    <button class="btn ghost w sp" id="say">${I.voice.replace('<svg', '<svg width="20"')} Прослухати техніку</button></div>`);
  const fig = Figure.mount($('#fgx', o), id);
  o._onclose = () => { fig.stop(); Snd.stopVoice(); };
  $('#cx', o).onclick = () => closeOverlay(o);
  $('#say', o).onclick = () => { const v = S.settings.voice; S.settings.voice = true; Snd.cue('ex_' + id + '_how', e.n + '. ' + e.d); S.settings.voice = v; };
}

// ---------- ПЛЕЄР ТРЕНУВАННЯ ----------
function startWorkout(W) {
  const segs = segments(W); let i = 0, left = segs[0].d, paused = false, timer = null, startT = Date.now();
  const names = {prep:'Приготуйся', warm:'Розминка', work:'Робота', rest:'Відпочинок', cool:'Заминка'};
  const cols = {prep:'var(--sun)', warm:'var(--cyan)', work:W.color, rest:'var(--vio)', cool:'var(--cyan)'};
  const o = overlay(`<div class="in player"><div class="row between"><button class="ic" id="cx">${I.x}</button>
      <span class="tag" id="ph"></span><div class="row" style="gap:8px"><button class="ic" id="mu"></button><button class="ic" id="vo"></button></div></div>
    <div class="figbox" id="fg"></div>
    <div class="tline"><span class="phase" id="pn"></span><span class="h" id="tm" style="font-size:54px"></span><span class="mut" style="font-weight:800">сек</span></div>
    <div class="seek" style="height:8px;margin-top:2px"><i id="rc" style="width:0"></i></div>
    <div class="h" id="nm" style="font-size:22px;text-align:center;margin-top:12px"></div><p class="mut" id="ds" style="text-align:center;margin-top:6px;font-size:14px;min-height:40px"></p>
    <div class="nextup" id="nu"></div>
    <div class="bar" style="margin:16px 0 18px"><i id="tp" style="background:linear-gradient(90deg,var(--lime),var(--cyan));width:0"></i></div>
    <div class="pctl"><button class="ic" id="pv">${I.prev}</button><button class="ic main" id="pp">${I.pause}</button><button class="ic" id="nx">${I.next}</button></div></div>`);
  const setIcons = () => { $('#mu', o).innerHTML = S.settings.music ? I.music : I.mute; $('#vo', o).innerHTML = S.settings.voice ? I.voice : I.novoice; };
  setIcons(); keepAwake(true); Voice.enabled = S.settings.voice;
  if (S.settings.music) Snd.music(S.settings.track);
  let fig = null, figId = null;
  function show(announce) {
    const s = segs[i], e = EX[s.id], nxt = segs.slice(i + 1).find(x => x.k !== 'rest');
    $('#ph', o).textContent = s.round ? `Коло ${s.round} / ${W.rounds}` : names[s.k];
    $('#pn', o).textContent = names[s.k]; $('#pn', o).style.color = cols[s.k];
    if (figId !== s.id) { fig && fig.stop(); fig = Figure.mount($('#fg', o), s.id, {speed: s.k === 'rest' ? .6 : 1}); figId = s.id; }
    $('#fg', o).style.opacity = s.k === 'rest' ? .45 : 1;
    $('#nm', o).textContent = s.k === 'rest' ? 'Далі: ' + e.n : e.n;
    $('#ds', o).textContent = s.k === 'rest' ? 'Відновлюй дихання. Вода — маленькими ковтками.' : e.d;
    $('#rc', o).style.background = cols[s.k];
    $('#nu', o).innerHTML = nxt ? `<span style="font-size:28px">${EX[nxt.id].e}</span><div><small class="mut">Наступна</small><div><b>${EX[nxt.id].n}</b></div></div><span class="pill" style="margin-left:auto">${nxt.d} с</span>` : '<b>🏁 Фініш близько!</b>';
    tick(true);
    if (announce) {
      if (s.k === 'rest') Snd.cue('ex_' + s.id + '_next', 'Відпочинок. Далі — ' + e.n);
      else if (s.k === 'prep') Snd.cue('prep', CUES.prep);
      else if (s.k === 'work') { Snd.cue('ex_' + s.id + '_go', e.n + '. Вперед!'); Audio2.beep('go'); vib(200); }
      else Snd.cue('ex_' + s.id + '_name', e.n);
    }
  }
  function tick(noDec) {
    if (!noDec) left--;
    const s = segs[i];
    if (left <= 0) { if (i < segs.length - 1) { i++; left = segs[i].d; show(true); return; } finishW(); return; }
    if (!noDec && left <= 3) { Audio2.beep('tick'); vib(40); }
    if (!noDec && s.k === 'work' && left === Math.floor(s.d / 2) && s.d >= 30) Snd.cue('half', CUES.half);
    $('#tm', o).textContent = left;
    $('#rc', o).style.width = (100 * (1 - left / s.d)) + '%';
    const done = segs.slice(0, i).reduce((a, x) => a + x.d, 0) + (s.d - left), tot = segs.reduce((a, x) => a + x.d, 0);
    $('#tp', o).style.width = (done / tot * 100) + '%';
  }
  function loop() { clearInterval(timer); timer = setInterval(() => { if (!paused) tick(); }, 1000); }
  function finishW() {
    clearInterval(timer); Snd.stopMusic(); fig && fig.stop(); keepAwake(false); window.appPause = null;
    const kc = wKcal(W), mins = Math.round((Date.now() - startT) / 60000), t = today();
    t.done = true; t.kcal = (t.kcal || 0) + kc; save();
    confetti(); Audio2.beep('go'); Snd.cue('finish', CUES.finish);
    $('.in', o).innerHTML = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;text-align:center">
      <div style="font-size:90px">🏆</div><div class="h" style="font-size:36px;margin-top:10px">Виконано!</div>
      <p class="mut" style="margin-top:8px">Ще один голос за нову версію тебе.</p>
      <div class="bento"><div class="card"><span class="tag">Час</span><div class="h big">${mins}<small style="font-size:14px"> хв</small></div></div>
      <div class="card"><span class="tag">Спалено</span><div class="h big">~${kc}<small style="font-size:14px"> ккал</small></div></div></div>
      <button class="btn w sp" id="ok">Готово</button></div>`;
    $('#ok', o).onclick = () => { closeOverlay(o); main(tab); };
  }
  o._onclose = () => { clearInterval(timer); Snd.stopMusic(); Snd.stopVoice(); fig && fig.stop(); keepAwake(false); window.appPause = null; };
  window.appPause = () => { if (!paused) $('#pp', o).click(); };
  $('#cx', o).onclick = () => closeOverlay(o);
  $('#pp', o).onclick = () => { paused = !paused; $('#pp', o).innerHTML = paused ? I.play : I.pause;
    if (paused) { Snd.stopMusic(); Snd.stopVoice(); } else if (S.settings.music) Snd.music(S.settings.track); };
  $('#nx', o).onclick = () => { if (i < segs.length - 1) { i++; left = segs[i].d; show(true); } else finishW(); };
  $('#pv', o).onclick = () => { if (i > 0) i--; left = segs[i].d; show(true); };
  $('#mu', o).onclick = () => { S.settings.music = !S.settings.music; save(); setIcons(); S.settings.music && !paused ? Snd.music(S.settings.track) : Snd.stopMusic(); };
  $('#vo', o).onclick = () => { S.settings.voice = !S.settings.voice; save(); Voice.enabled = S.settings.voice; setIcons(); };
  show(true); loop();
}

// ---------- ХАРЧУВАННЯ ----------
let foodDay = 0;
function food() {
  const p = S.profile, c = calc(p);
  const plan = MEALS[foodDay].map(m => ({t:m.t, it:Object.entries(m.it)}));
  const base = plan.reduce((a, m) => a + m.it.reduce((b, [k, g]) => b + FOOD[k][1] * g / 100, 0), 0);
  const f = c.kcal / base;
  const round = (k, g) => k === 'egg' ? Math.max(55, Math.round(g * f / 55) * 55) : Math.max(5, Math.round(g * f / 5) * 5);
  const goalTxt = {lose:'Дефіцит ~18% для спалювання жиру', fit:'Підтримка ваги та енергії', gain:'Профіцит ~10% для росту м\'язів'}[c.goal];
  $('#sc').innerHTML = header('Харчування', goalTxt) + `
    <div class="card sp"><div class="row">
      <div class="ringwrap">${ring(1, 'var(--lime)')}<div class="c"><div><div class="h" style="font-size:24px">${c.kcal}</div><small class="mut">ккал/день</small></div></div></div>
      <div style="flex:1">${macro('Білки', c.prot, 'var(--coral)')}${macro('Жири', c.fat, 'var(--sun)')}${macro('Вуглеводи', c.carb, 'var(--cyan)')}</div></div>
      <div class="row sp" style="flex-wrap:wrap;gap:8px"><span class="pill">Обмін у спокої ${c.bmr}</span><span class="pill">Витрата ${c.tdee}</span><span class="pill">💧 ${c.water} л</span></div></div>
    ${c.note ? `<div class="warn">${c.note}</div>` : ''}
    ${p.conds.includes('diabetes') ? '<div class="warn">🩸 Діабет: обирай продукти з низьким глікемічним індексом (гречка, бобові, овочі), уникай солодких напоїв. Розподіл вуглеводів узгодь з ендокринологом.</div>' : ''}
    <div class="seg" id="fd">${['День A','День B','День C'].map((d, i) => `<button class="${i === foodDay ? 'on' : ''}" data-i="${i}">${d}</button>`).join('')}</div>
    ${plan.map(m => { let kc = 0, pr = 0;
      const rows = m.it.map(([k, g]) => { const gg = round(k, g), F = FOOD[k]; kc += F[1] * gg / 100; pr += F[2] * gg / 100;
        return `<tr><td>${F[0]}</td><td>${k === 'egg' ? Math.round(gg / 55) + ' шт' : gg + ' г'}</td></tr>`; }).join('');
      return `<div class="card sp"><div class="hdr"><b class="h7" style="font-size:17px">${m.t}</b><span class="pill">${Math.round(kc)} ккал · ${Math.round(pr)} г білка</span></div><table class="food">${rows}</table></div>`; }).join('')}
    <div class="card sp"><span class="tag">Правила</span><p style="margin-top:8px">• Ваги круп і макаронів — <b>в сухому вигляді</b>, м'ясо — у сирому.<br>• Білок у кожному прийомі їжі.<br>• Остання їжа — за 2–3 год до сну.<br>• Овочі можна їсти більше — майже не впливають на калорії.<br>• Склянка води перед кожним прийомом їжі.<br>${c.goal === 'lose' ? '• Худнення 0,5–1% ваги на тиждень — оптимальний темп.' : c.goal === 'gain' ? '• Набір 0,25–0,5 кг на тиждень — більше піде в жир.' : '• Тримай вагу ±1 кг і прогресуй у тренуваннях.'}</p></div>
    <p class="dim" style="font-size:12px;margin-top:14px;text-align:center">Розрахунок: формула Міффліна–Сан Жеора × коефіцієнт активності.</p>`;
  bindHeader();
  document.querySelectorAll('#fd button').forEach(b => b.onclick = () => { foodDay = +b.dataset.i; food(); });
}

// ---------- ШЛЯХ (відновлення + курс) ----------
let pathSel = null;
function path() {
  const p = S.profile, t = today();
  if (pathSel && !p.habits.includes(pathSel)) pathSel = null;
  if (!pathSel && p.habits.length) pathSel = p.habits[0];
  const R = pathSel ? RECOVERY[pathSel] : null, days = pathSel ? daysSince(S.habitStart[pathSel]) : 0;
  let html = header('Шлях', 'Фізичне і психологічне відновлення');
  if (p.habits.length) {
    html += `<div class="seg">${p.habits.map(h => `<button data-h="${h}" class="${h === pathSel ? 'on' : ''}">${RECOVERY[h].icon} ${HABITS.find(x => x.id === h).t.split(/[ /]/)[0]}</button>`).join('')}</div>
    <div class="card sp" style="background:linear-gradient(135deg,rgba(198,255,61,.18),transparent 60%),var(--card);text-align:center">
      <span class="tag">${R.t}</span><div class="h" style="font-size:72px;margin-top:6px" >${days}</div><div class="mut">днів на шляху</div>
      ${pathSel === 'smoke' ? `<div class="row" style="justify-content:center;gap:8px;margin-top:12px"><span class="pill">🚭 ${days * p.smokeDay} сигарет не викурено</span><span class="pill">💰 ${Math.round(days * p.smokeDay / 20 * p.smokePrice)} грн</span></div>` : ''}
      <button class="btn ghost sm sp" id="rl">Був зрив — почати заново</button></div>
    ${R.warn ? `<div class="warn">${R.warn}</div>` : ''}
    <div class="card sp"><span class="tag">Сьогодні · чек-лист</span>${R.tasks.map((x, i) => { const on = (t.tasks[pathSel] || []).includes(i);
      return `<button class="chk ${on ? 'on' : ''}" data-tk="${i}"><i>${on ? '✓' : ''}</i><span>${x}</span></button>`; }).join('')}</div>
    <div class="card sp"><span class="tag">Що відбувається з тілом</span><div class="tl">${R.body.map(([a, b], i) => `<div class="${days >= [0, 3, 14, 30, 365][i] ? 'ok' : ''}"><b>${a}</b><div class="mut" style="font-size:14px">${b}</div></div>`).join('')}</div></div>
    <div class="card sp"><span class="tag">Програма</span>${R.phases.map(([a, b]) => `<div style="margin-top:12px"><b class="h7">${a}</b><p class="mut" style="font-size:14px;margin-top:4px">${b}</p></div>`).join('')}</div>`;
  } else {
    html += `<div class="card sp"><b>Шкідливих звичок не відмічено 💪</b><p class="mut" style="margin-top:6px">Якщо захочеш попрацювати над звичкою — додай її в профілі. Психологічний курс нижче корисний для всіх.</p></div>`;
  }
  const cd = S.course.length;
  html += `<div class="card sp"><div class="hdr"><span class="tag">🧠 Курс «Новий шлях» · 30 днів</span><span class="pill">${cd}/30</span></div>
    <div class="bar"><i style="width:${cd / 30 * 100}%;background:linear-gradient(90deg,var(--vio),var(--cyan))"></i></div>
    ${MINDCOURSE.map((x, i) => { const on = S.course.includes(i), next = !on && i === firstOpen();
      return (on || next || i < firstOpen() + 1) ? `<button class="chk ${on ? 'on' : ''}" data-c="${i}"><i>${on ? '✓' : i + 1}</i><span>${x}</span></button>` : ''; }).join('')}
    ${firstOpen() < 29 ? `<p class="dim" style="font-size:12.5px;margin-top:8px">Нові завдання відкриваються по мірі виконання.</p>` : ''}</div>
    <div class="card sp"><span class="tag">Служби допомоги (Україна)</span>${helplines()}</div>`;
  $('#sc').innerHTML = html; bindHeader();
  document.querySelectorAll('[data-h]').forEach(b => b.onclick = () => { pathSel = b.dataset.h; path(); });
  document.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => { const a = t.tasks[pathSel] = t.tasks[pathSel] || [], k = +b.dataset.tk;
    const j = a.indexOf(k); j >= 0 ? a.splice(j, 1) : a.push(k); save(); vib(12);
    if (a.length === R.tasks.length) { confetti(); toast('Всі завдання дня виконано! 🔥'); } path(); });
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const k = +b.dataset.c, j = S.course.indexOf(k);
    j >= 0 ? S.course.splice(j, 1) : S.course.push(k); save(); vib(12); if (j < 0) toast('День ' + (k + 1) + ' виконано ✓'); path(); });
  const rl = $('#rl'); if (rl) rl.onclick = () => relapse(pathSel);
}
const firstOpen = () => { for (let i = 0; i < 30; i++) if (!S.course.includes(i)) return i; return 30; };
const helplines = () => `<p style="margin-top:8px;font-size:14px;line-height:1.8">
  🚑 Екстрена медична допомога: <b>103</b> (з мобільного — 112)<br>
  📞 Гаряча лінія МОЗ: <b>0 800 505 201</b><br>
  💬 Lifeline Ukraine (психологічна підтримка, ветерани): <b>7333</b><br>
  <span class="dim" style="font-size:12px">Перевіряй актуальність номерів на офіційних сайтах.</span></p>`;
function relapse(h) {
  const o = overlay(`<div class="in"><div class="row between"><div class="h" style="font-size:26px">Зрив — не кінець</div><button class="ic" id="cx">${I.x}</button></div>
    <p style="font-size:17px;margin-top:16px">Майже кожен, хто звільнився, мав зриви. Важливо не те, що ти впав, а те, що встаєш <b>прямо зараз</b>.</p>
    <div class="card sp"><b>Дай відповідь собі:</b><p class="mut" style="margin-top:6px">1. Що сталось перед зривом (місце, люди, емоція)?<br>2. Чи був я голодний, злий, самотній або втомлений?<br>3. Що я зроблю інакше наступного разу?</p></div>
    <p class="mut sp">Твій попередній рекорд — <b style="color:var(--tx)">${daysSince(S.habitStart[h])} днів</b>. Ти вже знаєш, що можеш.</p>
    <button class="btn coral w sp" id="rs">Почати новий відлік</button><button class="btn ghost w sp" id="cn">Скасувати</button></div>`);
  $('#cx', o).onclick = $('#cn', o).onclick = () => closeOverlay(o);
  $('#rs', o).onclick = () => { (S.relapses[h] = S.relapses[h] || []).push([S.habitStart[h], new Date().toISOString()]);
    S.habitStart[h] = new Date().toISOString(); save(); closeOverlay(o); path(); toast('Новий старт. Ти зможеш 💪'); };
}

// ---------- SOS ----------
function openSOS() {
  const o = overlay(`<div class="in" style="text-align:center"><div class="row between"><span class="tag" style="color:var(--coral)">SOS · Тяга</span><button class="ic" id="cx">${I.x}</button></div>
    <div class="h" style="font-size:28px;margin-top:16px">Тяга — це хвиля.<br><span class="grad">Вона пройде.</span></div>
    <p class="mut" style="margin-top:8px">Дихай разом з колом. 10 хвилин — і стане легше.</p>
    <div class="breath" id="br">Вдих</div><div class="h" id="sst" style="font-size:40px">10:00</div>
    <div class="card sp" style="text-align:left"><b>Зроби одне з цього прямо зараз:</b><p class="mut" style="margin-top:6px">💧 Випий склянку холодної води<br>🏃 20 присідань або вийди на вулицю<br>📞 Подзвони другу / побратиму<br>🚿 Вмийся холодною водою<br>🧠 Нагадай собі: навіщо ти почав?</p></div>
    <button class="btn vio w sp" id="ses">🎧 Сеанс «Звільнення від тяги»</button>
    <div class="card sp" style="text-align:left">${helplines()}</div></div>`);
  let sec = 600, ph = 0; const br = $('#br', o);
  const phs = [['Вдих', 4, 1.25], ['Затримка', 7, 1.25], ['Видих', 8, .8]];
  let pl = 0;
  const step = () => { const [n, d, s] = phs[ph % 3]; br.textContent = n; br.style.transitionDuration = d + 's'; br.style.transform = `scale(${s})`; pl = setTimeout(() => { ph++; step(); }, d * 1000); };
  step();
  const iv = setInterval(() => { sec--; $('#sst', o).textContent = `${Math.floor(sec / 60)}:${pad(sec % 60)}`; if (sec <= 0) { clearInterval(iv); $('#sst', o).textContent = 'Ти впорався! 🏆'; confetti(); } }, 1000);
  o._onclose = () => { clearInterval(iv); clearTimeout(pl); };
  $('#cx', o).onclick = () => closeOverlay(o);
  $('#ses', o).onclick = () => { closeOverlay(o); playSession(SESSIONS.find(s => s.id === 'craving')); };
}

// ---------- РОЗУМ: гіпнотерапія, практики, аудіокниги ----------
const ttl = s => { const x = s.replace('Гіпноз: ', ''); return x[0].toUpperCase() + x.slice(1); };
const fmt = t => `${Math.floor(t / 60)}:${pad(Math.floor(t % 60))}`;
function sessCard(s) {
  const d = Snd.ok && Snd.M.sessions[s.id] ? ' · ' + Math.round(Snd.M.sessions[s.id].dur / 60) + ' хв' : '';
  return `<button class="sess" data-s="${s.id}"><div class="sw" style="background:radial-gradient(circle at 30% 30%,${s.c},#0000 75%),var(--card2)">${I.play.replace('<svg', '<svg width="22" style="color:#fff"')}</div>
    <div style="flex:1"><b class="h7" style="font-size:15.5px">${ttl(s.t)}</b><div class="mut" style="font-size:13px">${s.sub.split(' · ')[0]}${d} · ${s.voice === 'f' ? 'жіночий голос' : 'чоловічий голос'}</div></div></button>`;
}
function mind() {
  const hy = SESSIONS.filter(s => s.hypno), pr = SESSIONS.filter(s => !s.hypno);
  $('#sc').innerHTML = header('Розум', 'Гіпнотерапія · Практики · Аудіокниги') + `
    <div class="card sp" style="background:linear-gradient(135deg,rgba(61,245,255,.16),rgba(139,92,255,.28)),var(--card)">
      <span class="tag">🌀 Гіпнотерапія</span>
      <p style="margin-top:8px;font-size:14px">Повні сеанси самогіпнозу: занурення в транс, сходи вглиб, навіювання, якір і вихід. Голос веде тебе під оркестрову музику.</p>
      <p class="mut" style="margin-top:6px;font-size:12.5px">🎧 Навушники · сядь або ляж · не слухай за кермом. При епілепсії, психозі чи важкій депресії — спершу порадься з лікарем.</p></div>
    ${hy.map(sessCard).join('')}
    <div class="h" style="font-size:20px;margin-top:24px">Короткі практики</div>
    ${pr.map(sessCard).join('')}
    <div class="row between" style="margin-top:26px"><div class="h" style="font-size:20px">Аудіокниги</div><span class="tag">${I.book.replace('<svg', '<svg width="16"')} ${BOOKS.length}</span></div>
    <div class="bento">${BOOKS.map(b => `<button class="book" data-b="${b.id}" style="background:linear-gradient(160deg,${b.c}40,transparent 70%),var(--card)"><span class="e">${b.e}</span><div><b class="h7" style="font-size:15px;line-height:1.2;display:block">${b.t}</b><small class="mut">${b.ch.length} розділи${Snd.ok ? ' · 🎧 ' + Math.round(Snd.M.books[b.id].reduce((x, y) => x + y, 0) / 60) + ' хв' : ''}</small></div></button>`).join('')}</div>
    <div class="card sp"><span class="tag">Рекомендуємо прочитати</span>${READLIST.map(([t, a, d]) => `<div class="exl"><div class="em">📖</div><div><b>${t}</b><small>${a} · ${d}</small></div></div>`).join('')}</div>`;
  bindHeader();
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => playSession(SESSIONS.find(s => s.id === b.dataset.s)));
  document.querySelectorAll('[data-b]').forEach(b => b.onclick = () => openBook(BOOKS.find(x => x.id === b.dataset.b)));
}

// аудіоплеєр для сеансів і книг
function mediaPlayer(o, src, onTime, onEnd) {
  const au = new Audio(src); au.preload = 'auto'; au.volume = Math.min(1, S.settings.vol + 0.2);
  const pp = $('#pp', o), bar = $('#sp', o), tm = $('#tt', o);
  const upd = () => { if (au.duration) { bar.style.width = (au.currentTime / au.duration * 100) + '%'; tm.textContent = fmt(au.currentTime) + ' / ' + fmt(au.duration); } onTime && onTime(au.currentTime); };
  au.ontimeupdate = upd;
  au.onplay = () => pp.innerHTML = I.pause; au.onpause = () => pp.innerHTML = I.play;
  au.onended = () => { pp.innerHTML = I.play; onEnd && onEnd(); };
  au.onerror = () => { tm.textContent = 'Не вдалося відкрити аудіо'; };
  pp.onclick = () => au.paused ? au.play().catch(() => {}) : au.pause();
  $('#sk', o).onclick = e => { const r = e.currentTarget.getBoundingClientRect(); if (au.duration) au.currentTime = (e.clientX - r.left) / r.width * au.duration; };
  $('#rw', o).onclick = () => au.currentTime = Math.max(0, au.currentTime - 15);
  $('#fw', o).onclick = () => au.currentTime = Math.min(au.duration || 0, au.currentTime + 15);
  au.play().catch(() => {});
  return au;
}
const ctlHtml = `<div class="seek" id="sk"><i id="sp" style="width:0;background:linear-gradient(90deg,var(--cyan),var(--vio))"></i></div>
  <div class="row between" style="margin-top:6px"><small class="mut" id="tt">0:00</small><small class="mut">±15 с</small></div>
  <div class="pctl" style="margin-top:14px"><button class="ic" id="rw">${I.prev}</button><button class="ic main" id="pp">${I.pause}</button><button class="ic" id="fw">${I.next}</button></div>`;

function playSession(s) {
  const meta = Snd.ok && Snd.M.sessions[s.id];
  const o = overlay(`<div class="in player" style="text-align:center"><div class="row between"><button class="ic" id="cx">${I.x}</button><span class="tag">${s.hypno ? '🌀 Гіпнотерапія' : 'Практика'}</span><span style="width:44px"></span></div>
    <div class="h" style="font-size:24px;margin-top:12px">${ttl(s.t)}</div>
    <div class="orb" style="--oc:${s.c};margin:22px auto 14px"></div>
    <div class="sub" id="sb">${meta ? 'Влаштуйся зручно…' : 'Знайди зручне положення…'}</div>
    <div style="margin-top:auto">${meta ? ctlHtml : `<div class="bar" style="margin:18px 0"><i id="sp" style="width:0;background:${s.c}"></i></div><div class="pctl"><button class="ic main" id="pp">${I.pause}</button></div>`}</div></div>`);
  const sub = $('#sb', o);
  const show = txt => { if (sub.dataset.t === txt) return; sub.dataset.t = txt; sub.style.opacity = 0; setTimeout(() => { sub.textContent = txt; sub.style.opacity = 1; }, 350); };
  if (meta) {
    const L = meta.lines;
    const au = mediaPlayer(o, 'audio/s/' + s.id + '.mp3', t => {
      let cur = null; for (const l of L) { if (t >= l[0] - .2) cur = l; else break; }
      show(cur ? cur[2] : 'Влаштуйся зручно…');
    }, () => { show('✨ Сеанс завершено'); });
    o._onclose = () => { au.pause(); au.src = ''; };
    $('#cx', o).onclick = () => closeOverlay(o);
    return;
  }
  // запасний варіант: синтез мовлення
  let idx = 0, running = true, to = null;
  Audio2.playAmbient(s.mood); keepAwake(true); Voice.enabled = true;
  function next() {
    if (!running) return;
    if (idx >= s.lines.length) { show('✨ Сеанс завершено'); setTimeout(() => { if (running) Audio2.stop(); }, 8000); return; }
    const [txt, pause] = s.lines[idx]; show(txt);
    $('#sp', o).style.width = ((idx + 1) / s.lines.length * 100) + '%';
    Voice.say(txt, () => { if (running) to = setTimeout(next, pause * 1000); }, {rate:0.82, pitch:0.95});
    idx++;
  }
  to = setTimeout(next, 3500);
  o._onclose = () => { running = false; clearTimeout(to); Voice.stop(); Audio2.stop(); keepAwake(false); Voice.enabled = S.settings.voice; };
  $('#cx', o).onclick = () => closeOverlay(o);
  $('#pp', o).onclick = () => { running = !running; $('#pp', o).innerHTML = running ? I.pause : I.play;
    if (running) { Audio2.playAmbient(s.mood); idx = Math.max(0, idx - 1); next(); } else { clearTimeout(to); Voice.stop(); Audio2.stop(); } };
}

function openBook(b, ci = 0, autoplay = false) {
  const [t, txt] = b.ch[ci];
  const audio = Snd.ok && Snd.M.books[b.id];
  const o = overlay(`<div class="in reader"><div class="row between"><button class="ic" id="cx">${I.back}</button><span class="tag">${b.t} · ${ci + 1}/${b.ch.length}</span><span style="width:44px"></span></div>
    <div style="font-size:50px;margin-top:18px">${b.e}</div><div class="h" style="font-size:27px;margin-top:8px">${t}</div>
    ${audio ? `<div class="card sp" id="apl" style="${autoplay ? '' : 'display:none'}">${ctlHtml}</div>
      <button class="btn vio w sp" id="lis" style="${autoplay ? 'display:none' : ''}">🎧 Слухати аудіокнигу</button>` : `<button class="btn ghost w sp" id="rd">${I.voice.replace('<svg', '<svg width="20"')} Прочитати вголос</button>`}
    ${txt.split(/(?<=\.)\s(?=[А-ЯІЇЄҐA-Z])/).reduce((acc, s, i) => { const k = Math.floor(i / 3); acc[k] = (acc[k] || '') + s + ' '; return acc; }, []).map(p => `<p>${p}</p>`).join('')}
    <div class="row sp" style="gap:10px;margin-top:30px">${ci > 0 ? `<button class="btn ghost" id="pv" style="flex:1">← Назад</button>` : ''}
    ${ci < b.ch.length - 1 ? `<button class="btn" id="nx" style="flex:1">Далі →</button>` : `<button class="btn" id="fin" style="flex:1">Завершити ✓</button>`}</div></div>`);
  let au = null;
  const start = () => { $('#apl', o).style.display = ''; $('#lis', o).style.display = 'none';
    au = mediaPlayer(o, `audio/b/${b.id}_${ci}.mp3`, null, () => { if (ci < b.ch.length - 1) { closeOverlay(o); openBook(b, ci + 1, true); } else { toast('Аудіокнигу завершено 📚'); } }); };
  if (audio) { $('#lis', o).onclick = start; if (autoplay) start(); }
  else { let reading = false; $('#rd', o).onclick = () => { Voice.enabled = true; if (reading) { Voice.stop(); reading = false; return; } reading = true; Voice.say(t + '. ' + txt, () => reading = false, {rate:0.9}); }; }
  o._onclose = () => { if (au) { au.pause(); au.src = ''; } Voice.stop(); Voice.enabled = S.settings.voice; };
  $('#cx', o).onclick = () => closeOverlay(o);
  const nx = $('#nx', o), pv = $('#pv', o), fin = $('#fin', o);
  const playing = () => au && !au.paused;
  if (nx) nx.onclick = () => { const p = playing(); closeOverlay(o); openBook(b, ci + 1, p); };
  if (pv) pv.onclick = () => { const p = playing(); closeOverlay(o); openBook(b, ci - 1, p); };
  if (fin) fin.onclick = () => { closeOverlay(o); confetti(); toast('Книгу прочитано 📚'); };
}

// ---------- ПРОФІЛЬ ----------
function openProfile() {
  const p = S.profile, c = calc(p);
  const o = overlay(`<div class="in"><div class="row between"><div class="h" style="font-size:26px">Профіль</div><button class="ic" id="cx">${I.x}</button></div>
    <div class="card sp"><div class="h7" style="font-size:20px">${esc(p.name)}</div><p class="mut">${p.sex === 'm' ? 'Чоловік' : 'Жінка'} · ${p.age} р. · ${p.h} см · ${p.w} кг · ІМТ ${c.bmi}</p>
      <p class="mut" style="font-size:13px;margin-top:4px">Почав ${new Date(p.start).toLocaleDateString('uk-UA')} · Тиждень ${weekNo() + 1}</p></div>
    <div class="card sp">
      <div class="row between"><span>🎵 Музика на тренуваннях</span><button class="tgl ${S.settings.music ? 'on' : ''}" id="tm"></button></div>
      <div class="row between" style="margin-top:14px"><span>🗣️ Голосові підказки</span><button class="tgl ${S.settings.voice ? 'on' : ''}" id="tv"></button></div>
      <div style="margin-top:14px"><span>🔊 Гучність музики</span><input type="range" class="slider" id="vl" min="0" max="1" step="0.05" value="${S.settings.vol}"></div>
      <button class="btn ghost sm sp" id="tst">Перевірити голос</button>
    </div>
    <button class="btn w sp" id="ed">Змінити дані / цілі / звички</button>
    <button class="btn ghost w sp" id="rs" style="color:var(--coral)">Скинути все</button>
    <p class="dim" style="font-size:12px;margin-top:20px;text-align:center">FitLife 1.0 · Дані зберігаються лише на цьому пристрої.<br>Додаток не є медичною порадою.</p></div>`);
  $('#cx', o).onclick = () => closeOverlay(o);
  $('#tm', o).onclick = e => { S.settings.music = !S.settings.music; e.target.classList.toggle('on'); save(); };
  $('#tv', o).onclick = e => { S.settings.voice = !S.settings.voice; Voice.enabled = S.settings.voice; e.target.classList.toggle('on'); save(); };
  $('#vl', o).oninput = e => { S.settings.vol = +e.target.value; Snd.setVol(S.settings.vol); save(); };
  $('#tst', o).onclick = () => { const v = S.settings.voice; S.settings.voice = true; Snd.cue('welcome', CUES.welcome); S.settings.voice = v; };
  $('#ed', o).onclick = () => { closeOverlay(o); draft._loaded = false; onboarding(0); };
  let armed = false;
  $('#rs', o).onclick = e => { if (!armed) { armed = true; e.target.textContent = 'Натисни ще раз для підтвердження'; return; }
    try { localStorage.removeItem(KEY); } catch (er) {} S = load(); closeOverlay(o); splash(); };
}

// ---------- старт ----------
Audio2.setVolume && (function(){ try { Voice.enabled = S.settings.voice; } catch (e) {} })();
if (S.profile) main('home'); else splash();
document.addEventListener('click', () => { Audio2.init(); try { Snd.setVol(S.settings.vol); } catch (e) {} }, {once:true});
