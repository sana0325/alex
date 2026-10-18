import 'dart:typed_data';

import 'ofdm_signals.dart';
import 'signal_source.dart';

/// Mesh-мережа з TDMA: усі вузли на одній частоті, кожен передає у своєму
/// часовому слоті. Рівень кожного сплеску залежить від відстані до вузла.
///
/// Параметри: `n` — кількість вузлів, `p<i>` — рівень вузла i (дБм),
/// `a<i>` — 1, якщо вузол працює, 0 — якщо вийшов з ладу.
class MeshSignal extends SignalSource {
  MeshSignal(super.spec);

  final OfdmModulator _mod = OfdmModulator(256);

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final n = param('n', 5).round();
    if (n <= 0) return;
    final frame = param('frame', 0.08);
    final slot = frame / n;
    final pos = t % frame;
    final i = (pos / slot).floor().clamp(0, n - 1);
    if (pos - i * slot > slot * 0.85) return; // захисний інтервал
    if (param('a$i', 1) < 0.5) return;
    _mod.add(re, im,
        amp: amplitudeFor(param('p$i', spec.powerDbm)),
        offsetHz: spec.offsetHz,
        bandwidthHz: param('bandwidth', 8e6) * bandwidthScale,
        sampleRate: sampleRate,
        rng: rng);
  }
}
