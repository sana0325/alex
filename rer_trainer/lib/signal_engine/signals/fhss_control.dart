import 'dart:math' as math;
import 'dart:typed_data';

import '../core/rng.dart';
import 'signal_source.dart';

/// Узагальнений канал керування зі стрибками частоти (FHSS):
/// короткі вузькосмугові FSK-пакети на псевдовипадкових каналах.
class FhssControlSignal extends SignalSource {
  FhssControlSignal(super.spec);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final channels = spec.param('channels', 60).round();
    final spacing = spec.param('spacing', 0.5e6);
    final dwell = spec.param('dwell', 8e-3);
    final airtime = spec.param('airtime', 0.7);
    final symbolRate = spec.param('symbolRate', 250e3);
    final dev = spec.param('deviation', 120e3);
    final period = spec.param('period', 80).round();

    final hop = (t / dwell).floor();
    if (t - hop * dwell > airtime * dwell) return;

    final ch = hashInt(spec.seed, hop % period) % channels;
    final fc = spec.offsetHz + (ch - (channels - 1) / 2) * spacing;
    final a = amplitude;
    final dt = 1 / sampleRate;
    var ph = rng.uniform() * twoPi;
    for (var n = 0; n < re.length; n++) {
      final sym = ((t + n * dt) * symbolRate).floor();
      final bit = hashInt(hop, sym) & 1;
      ph += twoPi * (fc + (bit == 1 ? dev : -dev)) * dt;
      re[n] += a * math.cos(ph);
      im[n] += a * math.sin(ph);
    }
  }
}
