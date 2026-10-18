import 'dart:math' as math;
import 'dart:typed_data';

import '../channel/fading.dart';
import '../core/rng.dart';
import '../core/units.dart';
import 'analog_fpv.dart';
import 'fhss_control.dart';
import 'lora.dart';
import 'mesh.dart';
import 'ofdm_signals.dart';
import 'signal_spec.dart';
import 'telemetry.dart';
import 'uav_primitives.dart';

const double twoPi = 2 * math.pi;

/// Базовий клас джерела сигналу: додає свої IQ-відліки в спільний буфер.
abstract class SignalSource {
  SignalSource(this.spec, {this.defaults = const {}})
      : rng = Rng(spec.seed),
        fading = Fading(kFactor: 6, rateHz: 1.5, rng: Rng(spec.seed + 7));

  factory SignalSource.fromSpec(SignalSpec spec) => switch (spec.kind) {
        SignalKind.analogFpv => AnalogFpvSignal(spec),
        SignalKind.ofdmVideo => OfdmVideoSignal(spec),
        SignalKind.fhssControl => FhssControlSignal(spec),
        SignalKind.lora => LoraSignal(spec),
        SignalKind.telemetry => TelemetrySignal(spec),
        SignalKind.wifi => WifiSignal(spec),
        SignalKind.bluetooth => FhssControlSignal(spec, defaults: const {
            'channels': 79,
            'spacing': 1e6,
            'dwell': 625e-6,
            'airtime': 0.6,
            'symbolRate': 1e6,
            'deviation': 160e3,
            'period': 1600,
          }),
        SignalKind.mesh => MeshSignal(spec),
        SignalKind.fsk2Horns => Fsk2Horns(spec),
        SignalKind.fhssRandom => FhssRandom(spec),
        SignalKind.fhssRows => FhssRows(spec),
        SignalKind.mfskTrapezoid => FhssRows(spec, defaults: const {
            'rows': 1,
            'shape': 2,
            'pw': 500e3,
            'dwell': 0.02,
            'duty': 0.85,
          }),
        SignalKind.ofdmBlock => OfdmBlock(spec),
        SignalKind.mobileBurst => MobileBurst(spec),
        SignalKind.microwave => MicrowaveTeeth(spec),
        SignalKind.cw => CwTone(spec),
      };

  final SignalSpec spec;
  final Map<String, double> defaults;
  final Rng rng;
  final Fading fading;

  double param(String key, double fallback) =>
      spec.params[key] ?? defaults[key] ?? fallback;

  bool get isFake => spec.fake != FakeMode.none;

  /// Множник смуги: для фейку «не та ширина» смуга помітно інша.
  double get bandwidthScale => spec.fake == FakeMode.wrongBandwidth
      ? param('fakeBandwidthScale', 0.25)
      : 1.0;

  /// Номер пакета для формування даних: у replay-фейку вміст повторюється.
  int dataId(int packet) => spec.fake == FakeMode.replay ? 0 : packet;

  /// Джитер періоду: у фейку «ідеальна періодичність» відсутній.
  double jitter(double value) =>
      spec.fake == FakeMode.perfectPeriod ? 0 : value;

  /// Амплітуда з урахуванням завмирань (корінь із потужності в мВт).
  double amplitudeFor(double dbm) {
    final fade = spec.fake == FakeMode.tooStable ? 1.0 : fading.power;
    return math.sqrt(dbmToMw(dbm) * fade);
  }

  double get amplitude => amplitudeFor(spec.powerDbm);

  /// Амплітуда в момент [t] з урахуванням поведінки «різка зміна потужності»
  /// (параметри powerJumpDb і jumpEvery).
  double ampAt(double t) {
    final jump = param('powerJumpDb', 0);
    if (jump == 0) return amplitude;
    final high = hash01(spec.seed + 77, (t / param('jumpEvery', 8)).floor()) < 0.5;
    return amplitudeFor(spec.powerDbm + (high ? jump : 0));
  }

  void beginRow(double dt) => fading.step(dt);

  /// Додає відліки, що починаються в момент [t] секунд, у буфери [re]/[im].
  void synth(Float64List re, Float64List im, double t, double sampleRate);
}

/// Додає тон із частотною маніпуляцією (FSK): біти задає [bitAt].
void addFsk(
  Float64List re,
  Float64List im, {
  required double t,
  required double sampleRate,
  required double amp,
  required double centerHz,
  required double deviation,
  required double symbolRate,
  required int Function(int symbol) bitAt,
  required double phase,
}) {
  final dt = 1 / sampleRate;
  var ph = phase;
  for (var n = 0; n < re.length; n++) {
    final sym = ((t + n * dt) * symbolRate).floor();
    ph += twoPi * (centerHz + (bitAt(sym) == 1 ? deviation : -deviation)) * dt;
    re[n] += amp * math.cos(ph);
    im[n] += amp * math.sin(ph);
  }
}
