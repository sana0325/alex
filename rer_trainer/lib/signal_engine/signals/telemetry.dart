import 'dart:typed_data';

import '../core/rng.dart';
import 'signal_source.dart';

/// Телеметрія: вузькі короткі пакети на фіксованій частоті з невеликим
/// джитером періоду.
class TelemetrySignal extends SignalSource {
  TelemetrySignal(super.spec);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final period = param('period', 0.4);
    final burst = param('burst', 0.02);
    final jit = jitter(param('jitter', 0.06));

    final k = (t / period).floor();
    int? active;
    double start = 0;
    for (final i in [k - 1, k]) {
      final s = i * period + (hash01(spec.seed, i) - 0.5) * jit;
      if (t >= s && t < s + burst) {
        active = i;
        start = s;
      }
    }
    if (active == null) return;

    final data = dataId(active);
    addFsk(
      re,
      im,
      t: t - start,
      sampleRate: sampleRate,
      amp: amplitude,
      centerHz: spec.offsetHz,
      deviation: param('deviation', 25e3) * bandwidthScale,
      symbolRate: param('symbolRate', 9600),
      bitAt: (sym) => hashInt(data, sym) & 1,
      phase: rng.uniform() * twoPi,
    );
  }
}
