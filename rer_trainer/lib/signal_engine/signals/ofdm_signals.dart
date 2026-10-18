import 'dart:math' as math;
import 'dart:typed_data';

import 'package:fftea/fftea.dart';

import '../core/rng.dart';
import 'signal_source.dart';

/// Формує OFDM: сотні QPSK-піднесучих, обернене БПФ, циклічний префікс.
/// На спектрі дає характерну «пласку плиту» з рівним верхом.
class OfdmModulator {
  OfdmModulator(this.size)
      : _fft = FFT(size),
        _buf = Float64x2List(size);

  final int size;
  final FFT _fft;
  final Float64x2List _buf;

  void add(
    Float64List re,
    Float64List im, {
    required double amp,
    required double offsetHz,
    required double bandwidthHz,
    required double sampleRate,
    required Rng rng,
  }) {
    final spacing = sampleRate / size;
    final m = math.max(2, (bandwidthHz / spacing).round()).clamp(2, size - 2);
    final first = (offsetHz / spacing).round() - m ~/ 2;
    final a = amp / math.sqrt(2 * m);
    final cp = size ~/ 8;
    var n = 0;
    var start = rng.nextInt(size + cp);
    while (n < re.length) {
      _buf.fillRange(0, size, Float64x2.zero());
      for (var k = 0; k < m; k++) {
        if (k == m ~/ 2) continue; // нульова центральна піднесуча
        final bin = ((first + k) % size + size) % size;
        // Спряження на вході: conj(FFT(conj(X))) = N · IFFT(X).
        _buf[bin] = Float64x2(rng.uniform() < 0.5 ? a : -a,
            rng.uniform() < 0.5 ? a : -a);
      }
      _fft.inPlaceFft(_buf);
      for (var i = start; i < size + cp && n < re.length; i++, n++) {
        final c = _buf[(i - cp) % size];
        re[n] += c.x;
        im[n] -= c.y;
      }
      start = 0;
    }
  }
}

/// Цифрове відео: суцільні OFDM-кадри з короткими паузами.
class OfdmVideoSignal extends SignalSource {
  OfdmVideoSignal(super.spec);

  final OfdmModulator _mod = OfdmModulator(256);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final frame = param('frame', 1 / 60);
    final duty = param('duty', 0.9);
    if ((t / frame) % 1 > duty) return;
    _mod.add(re, im,
        amp: amplitude,
        offsetHz: spec.offsetHz,
        bandwidthHz: param('bandwidth', 18e6) * bandwidthScale,
        sampleRate: sampleRate,
        rng: rng);
  }
}

/// Wi-Fi: OFDM-пакети різної тривалості з паузами та маяки кожні 102,4 мс.
class WifiSignal extends SignalSource {
  WifiSignal(super.spec);

  final OfdmModulator _mod = OfdmModulator(256);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final load = param('load', 0.12);
    final slot = param('slot', 4e-3);
    final beacon = (t % 0.1024) < 0.4e-3;
    final busy = hash01(spec.seed, (t / slot).floor()) < load;
    if (!beacon && !busy) return;
    _mod.add(re, im,
        amp: amplitude,
        offsetHz: spec.offsetHz,
        bandwidthHz: param('bandwidth', 16.6e6) * bandwidthScale,
        sampleRate: sampleRate,
        rng: rng);
  }
}
