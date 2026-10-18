import 'dart:math' as math;
import 'dart:typed_data';

import '../core/rng.dart';
import 'ofdm_signals.dart';
import 'signal_source.dart';

/// Форма одного імпульсу вузькосмугової телеметрії.
enum PulseShape {
  /// Одиночний пік (GMSK, мобільний «дзвін»).
  single,

  /// «Ріжки»: подвійний М-подібний пік 2FSK.
  horns,

  /// «Трапеція»: широкий плоский імпульс із дрібними піками (MFSK).
  trapezoid,
}

/// Додає один імпульс шириною [width] з центром [center] заданої форми.
void addPulse(
  Float64List re,
  Float64List im, {
  required double t,
  required double sampleRate,
  required double amp,
  required double center,
  required double width,
  required PulseShape shape,
  required int data,
  required double phase,
}) {
  switch (shape) {
    case PulseShape.horns:
      // Дві частоти ±0,33·W і повільна маніпуляція → два чіткі піки.
      addFsk(re, im,
          t: t,
          sampleRate: sampleRate,
          amp: amp,
          centerHz: center,
          deviation: width * 0.33,
          symbolRate: width * 0.1,
          bitAt: (sym) => hashInt(data, sym) & 1,
          phase: phase);
    case PulseShape.single:
      // Мала девіація і висока швидкість → один округлий пік.
      addFsk(re, im,
          t: t,
          sampleRate: sampleRate,
          amp: amp,
          centerHz: center,
          deviation: width * 0.12,
          symbolRate: width * 0.55,
          bitAt: (sym) => hashInt(data, sym) & 1,
          phase: phase);
    case PulseShape.trapezoid:
      // MFSK: 8 тонів рівномірно по ширині, повільні символи.
      const tones = 8;
      final dt = 1 / sampleRate;
      final symbolRate = width / 40;
      var ph = phase;
      for (var n = 0; n < re.length; n++) {
        final sym = ((t + n * dt) * symbolRate).floor();
        final tone = hashInt(data, sym) % tones;
        final f = center + (tone - (tones - 1) / 2) * width / tones;
        ph += twoPi * f * dt;
        re[n] += amp * math.cos(ph);
        im[n] += amp * math.sin(ph);
      }
  }
}

/// Мітка часу всередині пакета: пакети [k] тривалістю [burst] з періодом
/// [period] і джитером. Повертає (номер пакета, час від його початку) або null.
(int, double)? burstAt(double t, double period, double burst, double jitter, int seed) {
  final k = (t / period).floor();
  for (final i in [k - 1, k]) {
    final start = i * period + (hash01(seed, i) - 0.5) * jitter;
    if (t >= start && t < start + burst) return (i, t - start);
  }
  return null;
}

/// `fsk2_horns`: одиночні імпульси без ППРЧ на одній або кількох частотах
/// (телеметрія Zala, Ланцета, «Орлан без ППРЧ»).
/// Параметри: n, f0..f9 — зсуви частот (Гц), width, burst, period, jitter,
/// continuous (1 — передає безперервно).
class Fsk2Horns extends SignalSource {
  Fsk2Horns(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final n = param('n', 1).round();
    final width = param('width', 200e3) * bandwidthScale;
    final continuous = param('continuous', 0) > 0;
    for (var i = 0; i < n; i++) {
      final seed = spec.seed * 31 + i;
      var data = 0;
      var local = t;
      if (!continuous) {
        final hit = burstAt(t, param('period', 0.25), param('burst', 0.03),
            jitter(param('jitter', 0.05)), seed);
        if (hit == null) continue;
        data = dataId(hit.$1);
        local = hit.$2;
      }
      addPulse(re, im,
          t: local,
          sampleRate: sampleRate,
          amp: ampAt(t),
          center: spec.offsetHz + param('f$i', 0),
          width: width,
          shape: PulseShape.values[param('shape', 1).round()],
          data: data,
          phase: rng.uniform() * twoPi);
    }
  }
}

/// `fhss_random`: ППРЧ «дощиком» — імпульси у випадкових місцях одного чи
/// кількох піддіапазонів, рядів не утворюють, можуть перекриватися (Орлан).
/// Параметри: nseg, lo0/hi0.. (Гц від центру сигналу), dwell, density,
/// duty, width, shape.
class FhssRandom extends SignalSource {
  FhssRandom(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final nseg = param('nseg', 1).round();
    final dwell = param('dwell', 3e-3);
    final density = param('density', 2.0);
    final duty = param('duty', 0.6);
    const lanes = 4;
    for (var j = 0; j < lanes; j++) {
      // Кожна «доріжка» має свій зсув у часі — імпульси перекриваються.
      final shift = hash01(spec.seed + 101 * j) * dwell;
      final k = ((t - shift) / dwell).floor();
      if (hash01(spec.seed + 7 * j, k) >= density / lanes) continue;
      final pos = t - shift - k * dwell;
      if (pos > duty * dwell) continue;
      final seg = hashInt(spec.seed + j, k) % nseg;
      final lo = param('lo$seg', -1e6), hi = param('hi$seg', 1e6);
      final f = lo + hash01(spec.seed + 13 * j + 5, k) * (hi - lo);
      addPulse(re, im,
          t: pos,
          sampleRate: sampleRate,
          amp: ampAt(t),
          center: spec.offsetHz + f,
          width: param('width', 150e3) * bandwidthScale,
          shape: PulseShape.values[param('shape', 1).round()],
          data: dataId(k * lanes + j),
          phase: rng.uniform() * twoPi);
    }
  }
}

/// `fhss_rows` / `mfsk_trapezoid`: ППРЧ на фіксованій сітці каналів —
/// на водоспаді рівні вертикальні пунктирні стовпці (SuperCam, Елерон).
/// Параметри: rows, step, dwell, duty, pw, shape, firstWeight, uneven,
/// modeEvery + single (перемикання між одиночним піком і ППРЧ).
class FhssRows extends SignalSource {
  FhssRows(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final rows = param('rows', 10).round();
    final step = param('step', 500e3);
    final dwell = param('dwell', 6e-3);
    final duty = param('duty', 0.7);
    final k = (t / dwell).floor();
    final pos = t - k * dwell;
    if (pos > duty * dwell) return;

    double center;
    final modeEvery = param('modeEvery', 0);
    if (modeEvery > 0 && (t / modeEvery).floor().isEven) {
      center = param('single', 0); // режим одиночного піка
    } else {
      // Нерівномірність: деякі стрибки пропускаються.
      if (hash01(spec.seed + 3, k) < param('uneven', 0)) return;
      final firstWeight = param('firstWeight', 1);
      final pick = hash01(spec.seed, k) * (rows - 1 + firstWeight);
      final r = pick < firstWeight ? 0 : (pick - firstWeight).floor() + 1;
      center = (r.clamp(0, rows - 1) - (rows - 1) / 2) * step;
    }
    addPulse(re, im,
        t: pos,
        sampleRate: sampleRate,
        amp: ampAt(t),
        center: spec.offsetHz + center,
        width: param('pw', 150e3) * bandwidthScale,
        shape: PulseShape.values[param('shape', 0).round()],
        data: dataId(k),
        phase: rng.uniform() * twoPi);
  }
}

/// `ofdm_block`: цифрове відео. Форма П-подібна або «бугор», опції поділу
/// навпіл і нерівномірності, TDMA-маска 16 слотів, стрибки частоти та зміна
/// ширини в повітрі.
class OfdmBlock extends SignalSource {
  OfdmBlock(super.spec, {super.defaults});

  final OfdmModulator _mod = OfdmModulator(256);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final mask = param('mask', 0).round();
    if (mask != 0) {
      final frame = param('frame', 0.056);
      final slot = frame / 16;
      final pos = t % frame;
      final i = (pos / slot).floor().clamp(0, 15);
      if ((mask >> i) & 1 == 0 || pos - i * slot > slot * 0.75) return;
    }
    final burstEvery = param('burstEvery', 0);
    if (burstEvery > 0 && hash01(spec.seed, (t / burstEvery).floor()) > param('load', 0.3)) {
      return;
    }
    var offset = spec.offsetHz;
    final hopEvery = param('hopEvery', 0);
    if (hopEvery > 0) {
      offset += (hash01(spec.seed, (t / hopEvery).floor()) - 0.5) * param('hopSpan', 10e6);
    }
    var bw = param('bandwidth', 8e6);
    final widthEvery = param('widthEvery', 0);
    if (widthEvery > 0 && (t / widthEvery).floor().isOdd) bw = param('widthAlt', bw);
    _mod.add(re, im,
        amp: ampAt(t),
        offsetHz: offset,
        bandwidthHz: bw * bandwidthScale,
        sampleRate: sampleRate,
        rng: rng,
        bump: param('bump', 0) > 0,
        notch: param('notch', 0),
        unevenRatio: param('unevenRatio', 0),
        unevenDb: param('unevenDb', 0));
  }
}

/// `mobile_burst`: мобільний зв'язок — одиночний «дзвін» 300–350 кГц
/// з «плаваючою» шириною; буває група з 3 піків (виклик).
class MobileBurst extends SignalSource {
  MobileBurst(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    // Абонент то з'являється, то зникає.
    final call = param('call', 3.0);
    if (hash01(spec.seed, (t / call).floor()) > param('activeProb', 0.7)) return;
    // TDMA-кадр GSM: передача лише в одному слоті з восьми.
    if ((t % 4.615e-3) > 1.2e-3 && param('continuous', 0) == 0) return;
    final n = param('n', 1).round();
    final w = param('width', 320e3) *
        (1 + param('float', 0.12) * math.sin(t * 2.1 + spec.seed));
    for (var i = 0; i < n; i++) {
      addPulse(re, im,
          t: t,
          sampleRate: sampleRate,
          amp: ampAt(t),
          center: spec.offsetHz + (i - (n - 1) / 2) * param('spacing', 400e3),
          width: w,
          shape: PulseShape.single,
          data: (t * 1000).floor() + i,
          phase: rng.uniform() * twoPi);
    }
  }
}

/// `microwave_teeth`: мікрохвильовка — нерегулярні «зубці» біля 2450 МГц.
class MicrowaveTeeth extends SignalSource {
  MicrowaveTeeth(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    // Магнетрон працює півперіоду мережі 50 Гц.
    if ((t * 50) % 1 > 0.5) return;
    final teeth = param('teeth', 7).round();
    final span = param('span', 16e6);
    final dt = 1 / sampleRate;
    final a = ampAt(t);
    for (var i = 0; i < teeth; i++) {
      if (hash01(spec.seed + i, (t * 8).floor()) < 0.35) continue;
      final f0 = spec.offsetHz + (hash01(spec.seed * 7 + i) - 0.5) * span;
      final dev = 150e3 + hash01(i, 3) * 400e3;
      var ph = rng.uniform() * twoPi;
      for (var n = 0; n < re.length; n++) {
        final f = f0 + dev * math.sin(twoPi * 2000 * (t + n * dt) + i);
        ph += twoPi * f * dt;
        re[n] += a * math.cos(ph);
        im[n] += a * math.sin(ph);
      }
    }
  }
}

/// `cw`: немодульована несуча (наприклад, у смузі подавлення навігації).
class CwTone extends SignalSource {
  CwTone(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final dt = 1 / sampleRate;
    final a = ampAt(t);
    var ph = rng.uniform() * twoPi;
    for (var n = 0; n < re.length; n++) {
      ph += twoPi * spec.offsetHz * dt;
      re[n] += a * math.cos(ph);
      im[n] += a * math.sin(ph);
    }
  }
}
