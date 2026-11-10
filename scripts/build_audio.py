#!/usr/bin/env python3
"""FitLife: озвучення нейронним голосом (edge-tts, uk-UA) + оркестрова музика (MIDI -> FluidSynth)
+ зведення сеансів/аудіокниг з приглушенням музики під голос.
Використання: build_audio.py content.json OUT_DIR CACHE_DIR SOUNDFONT
"""
import asyncio, hashlib, json, os, random, subprocess, sys
import numpy as np
import mido

CONTENT, OUT, CACHE, SF2 = sys.argv[1:5]
SR = 44100
VOICES = {'m': 'uk-UA-OstapNeural', 'f': 'uk-UA-PolinaNeural'}
os.makedirs(CACHE, exist_ok=True)
for d in ('s', 'b', 'c', 'm'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
C = json.load(open(CONTENT, encoding='utf-8'))


# ------------------------------------------------------------------ TTS
def key(*a):
    return hashlib.md5('|'.join(map(str, a)).encode()).hexdigest()

async def tts_one(sem, text, voice, rate, pitch):
    import edge_tts
    path = os.path.join(CACHE, key(text, voice, rate, pitch) + '.mp3')
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return path
    async with sem:
        for attempt in range(6):
            try:
                tmp = path + '.part'
                await edge_tts.Communicate(text, voice, rate=rate, pitch=pitch).save(tmp)
                if os.path.getsize(tmp) > 500:
                    os.replace(tmp, path)
                    return path
            except Exception as e:
                print('tts retry', attempt, e, text[:40], flush=True)
            await asyncio.sleep(2 + attempt * 3)
    raise RuntimeError('TTS failed: ' + text[:60])

def tts_batch(items):
    """items: list of (text, voicekey, rate, pitch) -> list of paths"""
    async def run():
        sem = asyncio.Semaphore(5)
        return await asyncio.gather(*[tts_one(sem, t, VOICES[v], r, p) for t, v, r, p in items])
    return asyncio.run(run())


# ------------------------------------------------------------------ audio io
def load(path, ch=2):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, ch).copy()

def save_mp3(x, path, br='64k', ch=2, af=None):
    x = np.clip(x, -1, 1).astype(np.float32)
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', str(x.shape[1]), '-ar', str(SR), '-i', '-']
    if af:
        cmd += ['-af', af]
    cmd += ['-ac', str(ch), '-b:a', br, path]
    subprocess.run(cmd, input=x.tobytes(), check=True)

def rms(x):
    return float(np.sqrt(np.mean(x ** 2)) + 1e-9)

def voice_fx(path, hypno):
    """Голос: легка реверберація для сеансів, нормалізація."""
    v = load(path, 2)
    # прибрати тишу на краях
    a = np.abs(v).max(axis=1)
    idx = np.where(a > 0.01)[0]
    if len(idx):
        v = v[max(0, idx[0] - 800): idx[-1] + 2000]
    v = v / max(1e-6, np.abs(v).max()) * 0.85
    if hypno:
        out = v.copy()
        for d, g in ((0.045, 0.22), (0.09, 0.14), (0.16, 0.08)):
            n = int(d * SR)
            out[n:] += v[:-n] * g
        v = out / max(1e-6, np.abs(out).max()) * 0.85
    return v


# ------------------------------------------------------------------ MIDI helpers
PPQ = 480
class Song:
    def __init__(self, bpm):
        self.mid = mido.MidiFile(ticks_per_beat=PPQ)
        self.ev = {}  # ch -> list (tick, msg)
        self.bpm = bpm
    def prog(self, ch, program, vol=100, rev=90, cho=30, pan=64):
        e = self.ev.setdefault(ch, [])
        if ch != 9:
            e.append((0, mido.Message('program_change', channel=ch, program=program)))
        for cc, v in ((7, vol), (91, rev), (93, cho), (10, pan), (11, 127)):
            e.append((0, mido.Message('control_change', channel=ch, control=cc, value=v)))
    def note(self, ch, t, dur, n, vel):
        if not (0 <= n <= 127):
            return
        t, dur = int(t), max(10, int(dur))
        e = self.ev.setdefault(ch, [])
        e.append((t, mido.Message('note_on', channel=ch, note=n, velocity=max(1, min(127, int(vel))))))
        e.append((t + dur, mido.Message('note_off', channel=ch, note=n, velocity=0)))
    def cc(self, ch, t, c, v):
        self.ev.setdefault(ch, []).append((int(t), mido.Message('control_change', channel=ch, control=c, value=int(max(0, min(127, v))))))
    def ramp(self, ch, t0, t1, v0, v1, c=11, steps=24):
        for i in range(steps + 1):
            self.cc(ch, t0 + (t1 - t0) * i / steps, c, v0 + (v1 - v0) * i / steps)
    def write(self, path):
        tr0 = mido.MidiTrack()
        tr0.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm), time=0))
        self.mid.tracks.append(tr0)
        for ch, ev in self.ev.items():
            tr = mido.MidiTrack()
            ev.sort(key=lambda x: (x[0], 0 if x[1].type == 'note_off' else 1))
            last = 0
            for t, m in ev:
                tr.append(m.copy(time=t - last)); last = t
            self.mid.tracks.append(tr)
        self.mid.save(path)

def render(mid, wav, gain=0.55):
    subprocess.run(['fluidsynth', '-ni', '-q', '-g', str(gain), '-r', str(SR),
                    '-o', 'synth.reverb.room-size=0.85', '-o', 'synth.reverb.width=1.0', '-o', 'synth.reverb.level=0.6',
                    '-F', wav, SF2, mid], check=True, stdout=subprocess.DEVNULL)

MAJ, MIN = [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]
def triad(root, q):
    return [root, root + (3 if q == 'm' else 4), root + 7]


# ------------------------------------------------------------------ ambient (сеанси)
MOODS = {
    'dawn':  dict(key=60, bpm=62, prog=[(0, 'M'), (9, 'm'), (5, 'M'), (7, 'M'), (0, 'M'), (4, 'm'), (5, 'M'), (7, 'M')], scale=MAJ),
    'deep':  dict(key=62, bpm=56, prog=[(0, 'm'), (8, 'M'), (3, 'M'), (10, 'M'), (0, 'm'), (5, 'm'), (8, 'M'), (7, 'M')], scale=MIN),
    'hero':  dict(key=62, bpm=64, prog=[(0, 'M'), (7, 'M'), (9, 'm'), (5, 'M'), (0, 'M'), (7, 'M'), (5, 'M'), (7, 'M')], scale=MAJ),
    'night': dict(key=57, bpm=52, prog=[(0, 'M'), (2, 'M'), (9, 'm'), (5, 'M'), (0, 'M'), (2, 'M'), (5, 'M'), (4, 'M')], scale=MAJ),
}
def ambient(mood, seconds, path_wav, seed=1):
    M = MOODS[mood]; rnd = random.Random(seed)
    s = Song(M['bpm'])
    bar = PPQ * 4
    chord_len = bar * 2
    secs_per_chord = 60 / M['bpm'] * 8
    n = int(seconds / secs_per_chord) + 2
    s.prog(0, 49, 100, 110, 40, 64)   # slow strings
    s.prog(1, 42, 92, 100, 20, 40)    # cello
    s.prog(2, 46, 70, 100, 20, 88)    # harp
    s.prog(3, 73, 78, 110, 20, 74)    # flute
    s.prog(4, 52, 70, 120, 50, 54)    # choir
    s.prog(5, 60, 72, 110, 20, 70)    # french horn
    s.prog(6, 8, 60, 120, 40, 96)     # celesta
    s.prog(7, 89, 60, 110, 60, 64)    # warm pad
    melody_last = M['key'] + 12
    for i in range(n):
        t = i * chord_len
        r, q = M['prog'][i % len(M['prog'])]
        root = M['key'] + r
        ch = triad(root, q)
        sec = (i // 8) % 4   # змінюємо фактуру кожні 8 акордів
        # струнні — завжди
        for k, nn in enumerate([ch[0], ch[1] + 12, ch[2], ch[0] + 12]):
            s.note(0, t + k * 20, chord_len - 30, nn, 58 + rnd.randint(-4, 4))
        s.note(7, t, chord_len, ch[0] - 12, 40); s.note(7, t, chord_len, ch[2] - 12, 34)
        s.note(1, t, chord_len - 40, root - 24, 62)
        s.ramp(0, t, t + chord_len // 2, 70, 112); s.ramp(0, t + chord_len // 2, t + chord_len, 112, 80)
        if sec in (1, 2, 3) or mood == 'night':
            # арфа: повільне арпеджіо вверх-вниз
            arp = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12]
            step = PPQ // 2 if mood != 'night' else PPQ
            k = 0
            for tt in range(0, chord_len, step):
                s.note(2, t + tt, step * 3, arp[k % len(arp)], 38 + rnd.randint(0, 10)); k += 1
        if sec in (2, 3) and mood != 'night':
            # проста мелодія флейти зі звуків гами
            for j in range(4):
                if rnd.random() < 0.8:
                    cands = [x for x in range(M['key'] + 10, M['key'] + 26) if (x - M['key']) % 12 in M['scale']]
                    chord_tones = [x for x in cands if x % 12 in [c % 12 for c in ch]]
                    pool = chord_tones if j % 2 == 0 else cands
                    nxt = min(pool, key=lambda x: abs(x - melody_last) + rnd.random() * 4)
                    melody_last = nxt
                    s.note(3, t + j * bar // 2, bar // 2 - 40, nxt, 50 + rnd.randint(0, 8))
        if sec == 3 or (sec == 1 and mood in ('hero', 'deep')):
            for nn in ch:
                s.note(4, t + 100, chord_len - 200, nn + 12, 42)
        if mood == 'hero' and sec in (1, 3):
            s.note(5, t, bar, ch[0], 58); s.note(5, t, bar, ch[2], 52)
        if mood in ('night', 'dawn') and rnd.random() < 0.5:
            for j in range(3):
                s.note(6, t + rnd.randint(0, chord_len - PPQ), PPQ * 2, rnd.choice(ch) + 24, 34)
    mid = path_wav.replace('.wav', '.mid')
    s.write(mid); render(mid, path_wav, 0.6)


# ------------------------------------------------------------------ епічні треки для тренувань
TRACKS = [
    dict(id='storm', bpm=150, key=50, steps=6, prog=[(0, 'm'), (8, 'M'), (3, 'M'), (10, 'M'), (0, 'm'), (5, 'm'), (7, 'M'), (7, 'M')],
         mel=[4, -1, 4, 5, -1, 4, 2, -1, -1, 0, -1, None, 3, -1, 4, 5, -1, 7, 6, -1, -1, 4, -1, None,
              4, -1, 2, 0, -1, 2, 3, -1, -1, 4, -1, 5, 4, -1, 3, 2, -1, 1, 2, -1, -1, -1, -1, None]),
    dict(id='board', bpm=160, key=52, steps=6, prog=[(0, 'm'), (0, 'm'), (10, 'M'), (10, 'M'), (8, 'M'), (3, 'M'), (7, 'M'), (7, 'M')],
         mel=[0, 2, 3, 4, -1, 4, 4, -1, 3, 2, -1, None, 0, 2, 3, 5, -1, 5, 4, -1, -1, -1, -1, None,
              7, -1, 6, 5, -1, 4, 3, -1, 4, 5, -1, None, 4, -1, 3, 2, -1, 3, 4, -1, -1, -1, -1, None]),
    dict(id='island', bpm=128, key=45, steps=8, prog=[(0, 'm'), (10, 'M'), (8, 'M'), (7, 'M'), (0, 'm'), (3, 'M'), (5, 'm'), (7, 'M')],
         mel=[0, -1, 0, 2, 3, -1, 2, 0, 4, -1, -1, -1, 3, -1, None, None, 5, -1, 4, 3, 2, -1, 3, 4, 4, -1, -1, -1, None, None, None, None,
              7, -1, 7, 6, 5, -1, 4, 3, 2, -1, -1, -1, 3, -1, 4, -1, 5, -1, 4, -1, 3, -1, 1, -1, 0, -1, -1, -1, None, None, None, None]),
    dict(id='legion', bpm=140, key=48, steps=8, prog=[(0, 'm'), (0, 'm'), (5, 'm'), (5, 'm'), (8, 'M'), (10, 'M'), (7, 'M'), (7, 'M')],
         mel=[4, -1, -1, 4, 5, -1, 4, -1, 2, -1, -1, -1, None, None, None, None, 3, -1, -1, 3, 4, -1, 3, -1, 1, -1, -1, -1, None, None, None, None,
              4, -1, 5, -1, 7, -1, -1, -1, 6, -1, 5, -1, 4, -1, -1, -1, 3, -1, 2, -1, 1, -1, 2, -1, 4, -1, -1, -1, -1, -1, None, None]),
]
def deg(key, d):
    return key + 12 + (d // 7) * 12 + MIN[d % 7]

def epic(tr, path_wav):
    s = Song(tr['bpm'])
    E = PPQ // 2        # восьма
    st = tr['steps']; bar = E * st
    s.prog(0, 48, 100, 70, 10, 50)   # strings ensemble (остинато)
    s.prog(1, 43, 110, 60, 0, 64)    # contrabass
    s.prog(2, 42, 105, 60, 0, 44)    # cello
    s.prog(3, 61, 100, 80, 10, 76)   # brass section
    s.prog(4, 60, 112, 90, 10, 60)   # french horns (мелодія)
    s.prog(5, 56, 100, 90, 10, 70)   # trumpets
    s.prog(6, 52, 90, 110, 40, 64)   # choir
    s.prog(7, 47, 115, 70, 0, 64)    # timpani
    s.prog(9, 0, 115, 50, 0, 64)     # drums
    s.prog(8, 44, 80, 90, 20, 84)    # tremolo strings
    # форма: intro4 | A8 | B8 | C8 | break4 | B8 | C8 | A8 | outro4  (у 8-тактових блоках прогресії)
    form = [('I', 4), ('A', 8), ('B', 8), ('C', 8), ('X', 4), ('B', 8), ('C', 8), ('A', 8), ('C', 8), ('O', 4)]
    if st == 6:  # 6/8 такти короткі — подвоюємо середину, щоб трек тривав ~2.5 хв
        form = form[:-1] + [('A', 8), ('B', 8), ('C', 8), ('X', 4), ('B', 8), ('C', 8), ('O', 4)]
    barno = 0
    P = len(tr['prog']); mel = tr['mel']
    for sec, nb in form:
        for b in range(nb):
            t0 = barno * bar
            r, q = tr['prog'][barno % P]
            root = tr['key'] + r; ch = triad(root, q)
            accent = (lambda k: k in (0, 3)) if st == 6 else (lambda k: k % 2 == 0)
            # остинато: контрабас + віолончель + струнні «галоп»
            for k in range(st):
                tt = t0 + k * E
                if sec != 'O' or b < 2:
                    v = 100 if accent(k) else 72
                    s.note(1, tt, E * 0.8, root - 24, v)
                    s.note(2, tt, E * 0.8, root - 12 + (7 if k == st - 1 else 0), v - 6)
                    if sec != 'I' or b >= 2:
                        s.note(0, tt, E * 0.7, [ch[0], ch[2], ch[1] + 12][k % 3], v - 14)
            # литаври і барабани
            if sec != 'X':
                s.note(7, t0, E * 2, root - 12, 110)
                if st == 6:
                    s.note(7, t0 + 3 * E, E, root - 12 + 7, 85)
            if sec in ('A', 'B', 'C'):
                s.note(9, t0, E, 36, 115)
                half = 3 * E if st == 6 else 4 * E
                s.note(9, t0 + half, E, 38, 100); s.note(9, t0 + half, E, 41, 90)
                if b % 2 == 1:
                    for k, n in enumerate((45, 43, 41)):
                        s.note(9, t0 + bar - (3 - k) * E // 1, E, n, 95 + k * 8)
                if b == 0:
                    s.note(9, t0, bar * 2, 49, 110)
            # мідні акорди
            if sec in ('A', 'B', 'C'):
                for n in ch:
                    s.note(3, t0, E * (st // 2) - 20, n + 12, 92)
                if st == 6 and b % 2 == 1:
                    for n in ch:
                        s.note(3, t0 + 3 * E, E * 2, n + 12, 84)
            # мелодія: валторни (B), труби + валторни октавою нижче (C)
            if sec in ('B', 'C'):
                base = (barno % P) * st
                for k in range(st):
                    d = mel[(base + k) % len(mel)]
                    if d is None or d == -1:
                        continue
                    ln = 1
                    while ln < 6 and mel[(base + k + ln) % len(mel)] == -1:
                        ln += 1
                    note = deg(tr['key'], d)
                    if sec == 'B':
                        s.note(4, t0 + k * E, E * ln - 15, note, 100)
                        s.note(0, t0 + k * E, E * ln - 15, note + 12, 70)
                    else:
                        s.note(5, t0 + k * E, E * ln - 15, note + 12, 104)
                        s.note(4, t0 + k * E, E * ln - 15, note, 96)
            if sec == 'C':
                for n in ch:
                    s.note(6, t0, bar - 20, n + 12, 78)
            if sec == 'X':
                for n in ch:
                    s.note(8, t0, bar - 10, n + 12, 60 + b * 15)
                s.ramp(8, t0, t0 + bar, 60, 120)
                if b == nb - 1:
                    for k in range(st):
                        s.note(9, t0 + k * E, E, 38, 60 + k * 10)
            if sec == 'O' and b == 0:
                for n in ch:
                    s.note(3, t0, bar * 3, n + 12, 100); s.note(6, t0, bar * 3, n + 12, 90)
                s.note(9, t0, bar * 2, 49, 120); s.note(7, t0, bar, root - 12, 120)
            barno += 1
    mid = path_wav.replace('.wav', '.mid')
    s.write(mid); render(mid, path_wav, 0.5)


# ------------------------------------------------------------------ зведення
def duck_env(voice_mono, depth):
    a = np.abs(voice_mono)
    w = int(0.25 * SR)
    # грубий детектор голосу: ковзний максимум через reshape
    pad = (-len(a)) % w
    blk = np.pad(a, (0, pad)).reshape(-1, w).max(axis=1)
    act = (blk > 0.02).astype(np.float32)
    act = np.maximum(act, np.roll(act, 1)); act = np.maximum(act, np.roll(act, -1))
    env = np.repeat(act, w)[:len(a)]
    k = int(0.35 * SR)
    kern = np.ones(k, dtype=np.float32) / k
    env = np.convolve(env, kern, mode='same')
    return 1 - depth * np.clip(env, 0, 1)

def mix(voice_items, mood, seed, tail, music_rms=0.05, depth=0.5, hypno=False, intro=6.0):
    """voice_items: [(path, pause_after, text)] -> stereo, timeline"""
    parts, tl, t = [], [], intro
    for p, pause, text in voice_items:
        v = voice_fx(p, hypno)
        parts.append((t, v)); tl.append([round(t, 2), round(t + len(v) / SR, 2), text])
        t += len(v) / SR + pause
    total = t + tail
    n = int(total * SR)
    voice = np.zeros((n, 2), np.float32)
    for st, v in parts:
        i = int(st * SR); voice[i:i + len(v)] += v[:max(0, n - i)]
    vr = rms(voice[np.abs(voice).max(axis=1) > 0.02]) if np.any(np.abs(voice) > 0.02) else 0.1
    voice *= 0.13 / vr
    wav = os.path.join(CACHE, f'bed_{mood}_{seed}_{int(total)}.wav')
    if not os.path.exists(wav):
        ambient(mood, total + 6, wav, seed)
    m = load(wav)
    if len(m) < n:
        m = np.concatenate([m, np.zeros((n - len(m), 2), np.float32)])
    m = m[:n]
    m *= music_rms / rms(m)
    fi, fo = int(4 * SR), int(min(8, tail) * SR)
    m[:fi] *= np.linspace(0, 1, fi)[:, None]
    m[-fo:] *= np.linspace(1, 0, fo)[:, None]
    m *= duck_env(voice.mean(axis=1), depth)[:, None]
    out = m + voice
    pk = np.abs(out).max()
    if pk > 0.95:
        out *= 0.95 / pk
    return out, tl, total


def main():
    man = {'sessions': {}, 'books': {}, 'tracks': [], 'cues': True}
    # 1) підказки тренувань
    ex = C['exercises']
    items, names = [], []
    for k, e in ex.items():
        for kind, text in (('name', e['n'] + '.'), ('go', e['n'] + '. Вперед!'), ('next', 'Відпочинок. Далі — ' + e['n'] + '.'),
                           ('how', e['n'] + '. ' + e['d'])):
            items.append((text, 'm', '+0%', '+0Hz')); names.append(f'ex_{k}_{kind}')
    for k, text in C['cues'].items():
        items.append((text, 'm', '+0%', '+0Hz')); names.append(k)
    print('cues TTS', len(items), flush=True)
    for nm, p in zip(names, tts_batch(items)):
        out = os.path.join(OUT, 'c', nm + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-af', 'loudnorm=I=-15:TP=-1.5:LRA=7', '-ac', '1', '-ar', '24000', '-b:a', '40k', out], check=True)

    # 2) музика тренувань
    for tr in TRACKS:
        wav = os.path.join(CACHE, f'track_{tr["id"]}_v3.wav')
        if not os.path.exists(wav):
            print('render track', tr['id'], flush=True)
            epic(tr, wav)
        out = os.path.join(OUT, 'm', tr['id'] + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-14:TP=-1:LRA=9,afade=t=out:st=0:d=0',
                        '-b:a', '112k', out], check=True)
        man['tracks'].append(tr['id'])

    # 3) сеанси
    for si, s in enumerate(C['sessions']):
        hyp = s['hypno']
        rate, pitch = ('-14%', '-3Hz') if hyp else ('-8%', '-1Hz')
        paths = tts_batch([(l[0], s['voice'], rate, pitch) for l in s['lines']])
        print('mix session', s['id'], flush=True)
        tail = 40 if s['id'] == 'h_sleep' else 12
        out, tl, total = mix([(p, l[1], l[0]) for p, l in zip(paths, s['lines'])], s['mood'], si + 7, tail,
                             music_rms=0.06 if hyp else 0.055, depth=0.45, hypno=hyp)
        save_mp3(out, os.path.join(OUT, 's', s['id'] + '.mp3'), '64k')
        man['sessions'][s['id']] = {'dur': round(total, 1), 'lines': tl}

    # 4) аудіокниги
    for bi, b in enumerate(C['books']):
        durs = []
        for ci, (title, text) in enumerate(b['ch']):
            p = tts_batch([(title + '. ' + text, 'm', '-4%', '+0Hz')])[0]
            out, tl, total = mix([(p, 0, title)], 'dawn', 40 + bi * 5 + ci, 6, music_rms=0.03, depth=0.4, intro=3.0)
            save_mp3(out, os.path.join(OUT, 'b', f'{b["id"]}_{ci}.mp3'), '56k')
            durs.append(round(total, 1))
        man['books'][b['id']] = durs
        print('book', b['id'], durs, flush=True)

    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    # маніфест також як JS (для file:// без fetch)
    with open(os.path.join(OUT, 'manifest.js'), 'w', encoding='utf-8') as f:
        f.write('window.AUDIO_MANIFEST=' + json.dumps(man, ensure_ascii=False) + ';')
    print('DONE')

if __name__ == '__main__':
    main()
