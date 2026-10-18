import 'dart:math' as math;
import 'dart:typed_data';

import '../channel/fading.dart';
import '../core/rng.dart';
import '../core/units.dart';
import 'analog_fpv.dart';
import 'fhss_control.dart';
import 'signal_spec.dart';
import 'telemetry.dart';

const double twoPi = 2 * math.pi;

/// Базовий клас джерела сигналу: додає свої IQ-відліки в спільний буфер.
abstract class SignalSource {
  SignalSource(this.spec)
      : rng = Rng(spec.seed),
        fading = Fading(kFactor: 6, rateHz: 1.5, rng: Rng(spec.seed + 7));

  factory SignalSource.fromSpec(SignalSpec spec) => switch (spec.kind) {
        SignalKind.analogFpv => AnalogFpvSignal(spec),
        SignalKind.fhssControl => FhssControlSignal(spec),
        SignalKind.telemetry => TelemetrySignal(spec),
      };

  final SignalSpec spec;
  final Rng rng;
  final Fading fading;

  /// Амплітуда з урахуванням завмирань (корінь із потужності в мВт).
  double get amplitude => math.sqrt(dbmToMw(spec.powerDbm) * fading.power);

  void beginRow(double dt) => fading.step(dt);

  /// Додає відліки, що починаються в момент [t] секунд, у буфери [re]/[im].
  void synth(Float64List re, Float64List im, double t, double sampleRate);
}
