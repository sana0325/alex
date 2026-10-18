import 'dart:math' as math;
import 'dart:typed_data';

import '../core/rng.dart';
import 'signal_source.dart';

/// Телеметрія: вузькі короткі пакети на фіксованій частоті з невеликим
/// джитером періоду.
class TelemetrySignal extends SignalSource {
  TelemetrySignal(super.spec);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final period = spec.param('period', 0.4);
    final burst = spec.param('burst', 0.02);
    final jitter = spec.param('jitter', 0.04);
    final symbolRate = spec.param('symbolRate', 9600);
    final dev = spec.param('deviation', 25e3);

    final k = (t / period).floor();
    int? active;
    for (final i in [k - 1, k]) {
      final start = i * period + (hash01(spec.seed, i) - 0.5) * jitter;
      if (t >= start && t < start + burst) active = i;
    }
    if (active == null) return;

    final a = amplitude;
    final dt = 1 / sampleRate;
    var ph = rng.uniform() * twoPi;
    for (var n = 0; n < re.length; n++) {
      final sym = ((t + n * dt) * symbolRate).floor();
      final bit = hashInt(active, sym) & 1;
      ph += twoPi * (spec.offsetHz + (bit == 1 ? dev : -dev)) * dt;
      re[n] += a * math.cos(ph);
      im[n] += a * math.sin(ph);
    }
  }
}
