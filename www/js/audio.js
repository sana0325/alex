/* FitLife — аудіо: генеративна епічна музика для тренувань, симфонічний ембієнт для сеансів, голос */
'use strict';

const Audio2 = (() => {
  let ctx = null, master, comp, reverb, revGain, musicBus;
  let sched = null, playing = null, duckLevel = 1, userVol = 0.8;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = userVol;
    musicBus = ctx.createGain(); musicBus.gain.value = 1;
    reverb = ctx.createConvolver(); reverb.buffer = impulse(3.2, 2.2);
    revGain = ctx.createGain(); revGain.gain.value = 0.35;
    musicBus.connect(comp); musicBus.connect(reverb); reverb.connect(revGain); revGain.connect(comp);
    comp.connect(master); master.connect(ctx.destination);
  }
  function impulse(sec, decay) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- інструменти ----------
  function strings(t, midi, dur, vol, out, opts = {}) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = opts.cut || 1800; f.Q.value = 0.7;
    const att = opts.att ?? 0.02, rel = opts.rel ?? 0.12;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur + rel);
    [-7, 0, 7].forEach(det => { const o = ctx.createOscillator(); o.type = opts.wave || 'sawtooth';
      o.frequency.value = hz(midi); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + rel + 0.05); });
    f.connect(g); g.connect(out || musicBus);
  }
  function brass(t, midi, dur, vol) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2600, t + 0.08); f.frequency.linearRampToValueAtTime(1400, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.04); g.gain.linearRampToValueAtTime(vol * 0.7, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    [0, 5].forEach(det => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(midi); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.15); });
    f.connect(g); g.connect(musicBus);
  }
  function lead(t, midi, dur, vol) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(); o.type = 'square'; o2.type = 'sawtooth';
    o.frequency.value = hz(midi); o2.frequency.value = hz(midi + 12); o2.detune.value = 4;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 6; lfo.connect(lg); lg.connect(o.detune);
    const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(f);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus);
    [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.05); });
  }
  function drum(t, f0, f1, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(comp); o.start(t); o.stop(t + dur + 0.02);
  }
  function snare(t, vol, len = 0.18) {
    const s = ctx.createBufferSource(); s.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(f); f.connect(g); g.connect(comp); g.connect(reverb); s.start(t); s.stop(t + len + 0.02);
    drum(t, 220, 120, 0.08, vol * 0.6);
  }
  function crash(t, vol) {
    const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    s.connect(f); f.connect(g); g.connect(comp); g.connect(reverb); s.start(t); s.stop(t + 1.7);
  }
  function bell(t, midi, vol, out) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'sine'; o.frequency.value = hz(midi); o2.frequency.value = hz(midi) * 2.76;
    const g2 = ctx.createGain(); g2.gain.value = 0.15;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + 3.5);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out || musicBus);
    o.start(t); o2.start(t); o.stop(t + 3.6); o2.stop(t + 3.6);
  }

  // ---------- епічні треки для тренувань (оригінальні, згенеровані) ----------
  // chords: [root midi, 'm'|'M'] ; mel: ступені мінорної гами по восьмих (null = пауза, -1 = тримати)
  const MINOR = [0, 2, 3, 5, 7, 8, 10], MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const TRACKS = [
    {id:'storm', t:'Шторм на горизонті', bpm:150, key:50, steps:6,
      prog:[[0,'m'],[8,'M'],[3,'M'],[10,'M'],[0,'m'],[5,'m'],[7,'M'],[7,'M']],
      mel:[4,-1,4,5,-1,4, 2,-1,-1,0,-1,null, 3,-1,4,5,-1,7, 6,-1,-1,4,-1,null,
           4,-1,2,0,-1,2, 3,-1,-1,4,-1,5, 4,-1,3,2,-1,1, 2,-1,-1,-1,-1,null]},
    {id:'board', t:'На абордаж!', bpm:160, key:52, steps:6,
      prog:[[0,'m'],[0,'m'],[10,'M'],[10,'M'],[8,'M'],[3,'M'],[7,'M'],[7,'M']],
      mel:[0,2,3,4,-1,4, 4,-1,3,2,-1,null, 0,2,3,5,-1,5, 4,-1,-1,-1,-1,null,
           7,-1,6,5,-1,4, 3,-1,4,5,-1,null, 4,-1,3,2,-1,3, 4,-1,-1,-1,-1,null]},
    {id:'island', t:'Острів скарбів', bpm:128, key:45, steps:8,
      prog:[[0,'m'],[10,'M'],[8,'M'],[7,'M'],[0,'m'],[3,'M'],[5,'m'],[7,'M']],
      mel:[0,-1,0,2,3,-1,2,0, 4,-1,-1,-1,3,-1,null,null, 5,-1,4,3,2,-1,3,4, 4,-1,-1,-1,null,null,null,null,
           7,-1,7,6,5,-1,4,3, 2,-1,-1,-1,3,-1,4,-1, 5,-1,4,-1,3,-1,1,-1, 0,-1,-1,-1,null,null,null,null]},
    {id:'legion', t:'Легіон', bpm:140, key:48, steps:8,
      prog:[[0,'m'],[0,'m'],[5,'m'],[5,'m'],[8,'M'],[10,'M'],[7,'M'],[7,'M']],
      mel:[4,-1,-1,4,5,-1,4,-1, 2,-1,-1,-1,null,null,null,null, 3,-1,-1,3,4,-1,3,-1, 1,-1,-1,-1,null,null,null,null,
           4,-1,5,-1,7,-1,-1,-1, 6,-1,5,-1,4,-1,-1,-1, 3,-1,2,-1,1,-1,2,-1, 4,-1,-1,-1,-1,-1,null,null]},
  ];
  const deg = (key, d, scale = MINOR) => key + 12 + Math.floor(d / 7) * 12 + scale[((d % 7) + 7) % 7];
  const triad = (root, q) => q === 'm' ? [0, 3, 7].map(x => root + x) : [0, 4, 7].map(x => root + x);

  function playWorkout(idx) {
    init(); if (!ctx) return; stop();
    const tr = TRACKS[((idx % TRACKS.length) + TRACKS.length) % TRACKS.length];
    const stepDur = 60 / tr.bpm / (tr.steps === 6 ? 2 : 2); // восьма
    let step = 0, nextT = ctx.currentTime + 0.1;
    const total = tr.prog.length * tr.steps;
    playing = {type:'workout', track:tr};
    sched = setInterval(() => {
      while (nextT < ctx.currentTime + 0.25) {
        const s = step % total, bar = Math.floor(s / tr.steps), b = s % tr.steps;
        const [r, q] = tr.prog[bar]; const root = tr.key + r; const ch = triad(root, q);
        const cycle = Math.floor(step / total);
        // галоп низьких струнних
        const acc = tr.steps === 6 ? (b === 0 || b === 3) : (b % 2 === 0);
        strings(nextT, root - 12 + (b === 5 || b === 7 ? 7 : 0), stepDur * 0.9, acc ? 0.10 : 0.06, null, {cut: 900, att: 0.005, rel: 0.05});
        // акорди духових на початку такту
        if (b === 0) ch.forEach(m => brass(nextT, m + 12, stepDur * (tr.steps === 6 ? 2.6 : 3.5), 0.035));
        if (tr.steps === 6 && b === 3 && bar % 2 === 1) ch.forEach(m => brass(nextT, m + 12, stepDur * 2.2, 0.03));
        // барабани (тайко-стиль)
        if (b === 0) drum(nextT, 120, 40, 0.5, 0.9);
        if (tr.steps === 6 ? b === 3 : b === 4) { drum(nextT, 110, 45, 0.4, 0.6); snare(nextT, 0.28); }
        if (tr.steps === 8 && (b === 6 || b === 7) && bar % 2 === 1) drum(nextT, 180, 90, 0.18, 0.45);
        if (tr.steps === 6 && b === 5 && bar % 2 === 1) snare(nextT, 0.18, 0.1);
        if (s === 0) crash(nextT, cycle === 0 ? 0.12 : 0.18);
        // мелодія — з другого проходу; на першому лише ритм-секція
        if (cycle % 3 !== 0) {
          const d = tr.mel[s % tr.mel.length];
          if (d !== null && d !== -1) {
            let len = 1; while (tr.mel[(s + len) % tr.mel.length] === -1 && len < 6) len++;
            lead(nextT, deg(tr.key, d) + (cycle % 3 === 2 ? 12 : 0), stepDur * len * 0.98, 0.07);
            if (cycle % 3 === 2) strings(nextT, deg(tr.key, d), stepDur * len, 0.03, null, {cut: 2500});
          }
        }
        nextT += stepDur; step++;
      }
    }, 50);
  }

  // ---------- симфонічний ембієнт для сеансів ----------
  const MOODS = {
    dawn:  {key:48, sc:MAJOR, prog:[[0,'M'],[9,'m'],[5,'M'],[7,'M']], bar:8},
    deep:  {key:50, sc:MINOR, prog:[[0,'m'],[8,'M'],[3,'M'],[10,'M']], bar:9},
    hero:  {key:50, sc:MAJOR, prog:[[0,'M'],[7,'M'],[9,'m'],[5,'M']], bar:6},
    night: {key:45, sc:MAJOR, prog:[[0,'M'],[2,'M'],[7,'M'],[0,'M']], bar:10},
  };
  function playAmbient(mood) {
    init(); if (!ctx) return; stop();
    const M = MOODS[mood] || MOODS.dawn; let i = 0, nextT = ctx.currentTime + 0.1;
    playing = {type:'ambient', mood};
    // тихий шум хвиль
    const s = ctx.createBufferSource(); s.buffer = noise(); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
    const g = ctx.createGain(); g.gain.value = 0.025;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(); lfo.start();
    playing.nodes = [s, lfo];
    sched = setInterval(() => {
      while (nextT < ctx.currentTime + 1) {
        const [r, q] = M.prog[i % M.prog.length], root = M.key + r, ch = triad(root, q);
        strings(nextT, root - 12, M.bar, 0.05, null, {att: 2.5, rel: 3, cut: 600});
        ch.forEach((m, k) => strings(nextT + k * 0.3, m + 12, M.bar - 0.5, 0.03, null, {att: 3, rel: 3.5, cut: 1400}));
        strings(nextT + 1, ch[2] + 24, M.bar - 2, 0.012, null, {att: 3, rel: 3, cut: 3000, wave: 'triangle'});
        // челеста-арпеджіо
        for (let k = 0; k < 4; k++) if (Math.random() < 0.65) {
          const note = ch[Math.floor(Math.random() * 3)] + 24 + (Math.random() < 0.3 ? 12 : 0);
          bell(nextT + 1 + k * (M.bar / 4) + Math.random() * 0.4, note, 0.04);
        }
        nextT += M.bar; i++;
      }
    }, 300);
  }

  function stop() {
    if (sched) { clearInterval(sched); sched = null; }
    if (playing && playing.nodes) playing.nodes.forEach(n => { try { n.stop(); } catch (e) {} });
    if (ctx && musicBus) {
      // плавне глушіння вже запланованих нот
      const old = musicBus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { try { old.disconnect(); } catch (e) {} }, 1500);
      musicBus = ctx.createGain(); musicBus.gain.value = duckLevel;
      musicBus.connect(comp); musicBus.connect(reverb);
    }
    playing = null;
  }
  function duck(on) {
    duckLevel = on ? 0.35 : 1;
    if (ctx && musicBus) musicBus.gain.setTargetAtTime(duckLevel, ctx.currentTime, 0.3);
  }
  function setVolume(v) { userVol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }
  function beep(type = 'tick') {
    init(); if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = type === 'go' ? 1320 : type === 'end' ? 660 : 880;
    const d = type === 'go' ? 0.35 : 0.12;
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
  }
  return { init, playWorkout, playAmbient, stop, duck, setVolume, beep, TRACKS, get playing() { return playing; } };
})();

/* ---------- Голос: нативний Android TTS (через міст) або Web Speech ---------- */
const Voice = (() => {
  let enabled = true, cbs = {}, uid = 0, ukVoice = null;
  const native = () => window.AndroidBridge && typeof AndroidBridge.speak === 'function';
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    ukVoice = vs.find(v => /uk/i.test(v.lang)) || vs.find(v => /ru|pl/i.test(v.lang) && false) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  window.__ttsDone = id => { const f = cbs[id]; delete cbs[id]; if (!Object.keys(cbs).length) Audio2.duck(false); f && f(); };
  function say(text, onEnd, opts = {}) {
    if (!enabled) { onEnd && setTimeout(onEnd, 50); return; }
    const id = 'u' + (++uid); cbs[id] = onEnd;
    Audio2.duck(true);
    const rate = opts.rate || 0.92, pitch = opts.pitch || 1;
    // запобіжник: якщо рушій мовлення не відповів — продовжуємо
    const guard = () => setTimeout(() => cbs[id] && window.__ttsDone(id), 2500 + text.length * 120);
    if (native()) { try { AndroidBridge.speak(text, id, rate, pitch); guard(); return; } catch (e) {} }
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'uk-UA'; u.rate = rate; u.pitch = pitch;
      if (ukVoice) u.voice = ukVoice;
      u.onend = u.onerror = () => window.__ttsDone(id);
      speechSynthesis.speak(u);
      guard();
    } else setTimeout(() => window.__ttsDone(id), 800 + text.length * 70);
  }
  function stop() {
    cbs = {}; Audio2.duck(false);
    if (native()) { try { AndroidBridge.stopSpeak(); } catch (e) {} }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  return { say, stop, set enabled(v) { enabled = v; if (!v) stop(); }, get enabled() { return enabled; },
    get hasUk() { if (native()) { try { return AndroidBridge.hasUkrainian(); } catch (e) { return true; } } return !!ukVoice; } };
})();
