import 'dart:math' as math;
import 'dart:typed_data';

import '../core/rng.dart';
import 'signal_source.dart';

/// LoRa-подібний chirp: преамбула з однакових висхідних «пилок»,
/// синхрослово з низхідних і символи даних — зсунуті «пилки».
class LoraSignal extends SignalSource {
  LoraSignal(super.spec);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final bw = param('bandwidth', 125e3) * bandwidthScale;
    final sf = param('sf', 11).round();
    final chips = 1 << sf;
    final ts = chips / bw;
    final period = param('period', 2.0);
    final preamble = param('preamble', 8).round();
    final payload = param('payload', 16).round();
    final packetLen = (preamble + 2 + payload) * ts;

    final k = (t / period).floor();
    final start = k * period + hash01(spec.seed, k) * jitter(period * 0.2);
    if (t < start || t >= start + packetLen) return;

    final data = dataId(k);
    final a = amplitude;
    final dt = 1 / sampleRate;
    var ph = rng.uniform() * twoPi;
    for (var n = 0; n < re.length; n++) {
      final pos = t + n * dt - start;
      final sym = (pos / ts).floor();
      final frac = pos / ts - sym;
      double f;
      if (sym < preamble) {
        f = frac;
      } else if (sym < preamble + 2) {
        f = 1 - frac;
      } else {
        final value = hashInt(data, sym) % chips;
        f = (frac + value / chips) % 1;
      }
      ph += twoPi * (spec.offsetHz - bw / 2 + f * bw) * dt;
      re[n] += a * math.cos(ph);
      im[n] += a * math.sin(ph);
    }
  }
}
