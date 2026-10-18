import 'dart:math' as math;
import 'dart:typed_data';

import '../core/rng.dart';
import 'signal_source.dart';

/// Стилізоване аналогове FM-відео: широка смуга, лінія синхроімпульсів
/// на нижньому краї та піднесуча звуку збоку.
class AnalogFpvSignal extends SignalSource {
  AnalogFpvSignal(super.spec);

  static const double _line = 64e-6;
  static const double _sync = 4.7e-6;
  static const double _blank = 10.5e-6;

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final dev = spec.param('deviation', 3.5e6);
    final audioOffset = spec.param('audioOffset', 6.5e6);
    final a = amplitude;
    final aAudio = a * 0.12;
    final dt = 1 / sampleRate;
    var ph = rng.uniform() * twoPi;
    var phA = rng.uniform() * twoPi;
    for (var n = 0; n < re.length; n++) {
      final tau = t + n * dt;
      final lineIdx = (tau / _line).floor();
      final pos = tau - lineIdx * _line;
      double v;
      if (pos < _sync) {
        v = -1.0;
      } else if (pos < _blank) {
        v = -0.7;
      } else {
        final x = (pos - _blank) / (_line - _blank);
        v = -0.55 + 1.45 * _luma(x, lineIdx % 625);
      }
      ph += twoPi * (spec.offsetHz + dev * v) * dt;
      re[n] += a * math.cos(ph);
      im[n] += a * math.sin(ph);
      final fa = spec.offsetHz +
          audioOffset +
          50e3 * math.sin(twoPi * 1e3 * tau);
      phA += twoPi * fa * dt;
      re[n] += aAudio * math.cos(phA);
      im[n] += aAudio * math.sin(phA);
    }
  }

  /// Умовна «картинка»: градієнти, смуги та дрібна деталізація.
  double _luma(double x, int row) {
    final px = (x * 360).floor();
    final base = 0.5 + 0.3 * math.sin(twoPi * (x * 2.5 + row * 0.004));
    final bars = ((px ~/ 45) % 2 == 0) ? 0.12 : -0.12;
    final detail = (hash01(px, row) - 0.5) * 0.3;
    return (base + bars + detail).clamp(0.0, 1.0);
  }
}
