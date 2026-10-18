import '../core/rng.dart';
import '../signals/signal_spec.dart';
import 'scene_config.dart';

/// Типові навчальні сцени для кожного типу сигналу. Якщо передано [rng],
/// потужність, частота й «зерно» сигналу випадково змінюються — так
/// будуються завдання режиму «Ідентифікація».
SceneConfig sceneFor(SignalKind kind, {Rng? rng}) {
  double vary(double base, double spread) =>
      rng == null ? base : base + (rng.uniform() - 0.5) * 2 * spread;
  final seed = rng == null ? 5 : 1 + rng.nextInt(100000);

  SignalSpec spec(double offset, double power, [Map<String, double> p = const {}]) =>
      SignalSpec(
        id: kind.name,
        kind: kind,
        offsetHz: offset,
        powerDbm: power,
        seed: seed,
        params: p,
      );

  switch (kind) {
    case SignalKind.analogFpv:
      return SceneConfig(
        centerHz: 5800e6,
        sampleRate: 40e6,
        signals: [spec(vary(-3e6, 6e6), vary(-58, 6))],
      );
    case SignalKind.ofdmVideo:
      return SceneConfig(
        centerHz: 5760e6,
        sampleRate: 40e6,
        signals: [
          spec(vary(0, 5e6), vary(-60, 6), {
            'bandwidth': rng == null ? 18e6 : (rng.uniform() < 0.5 ? 10e6 : 18e6),
          }),
        ],
      );
    case SignalKind.fhssControl:
      return SceneConfig(
        centerHz: 2440e6,
        sampleRate: 40e6,
        signals: [spec(0, vary(-62, 6))],
      );
    case SignalKind.lora:
      return SceneConfig(
        centerHz: 868.1e6,
        sampleRate: 0.25e6,
        fftSize: 256,
        timeScale: 0.02,
        noiseDensityDbmHz: -160,
        signals: [
          spec(vary(0, 30e3), vary(-108, 4), {
            'sf': 12,
            'bandwidth': 125e3,
            'period': 0.55,
            'preamble': 6,
            'payload': 6,
          }),
        ],
      );
    case SignalKind.telemetry:
      return SceneConfig(
        centerHz: 433.9e6,
        sampleRate: 2e6,
        noiseDensityDbmHz: -158,
        signals: [
          spec(vary(0, 500e3), vary(-95, 6), {'period': 0.25, 'burst': 0.025}),
        ],
      );
    case SignalKind.wifi:
      return SceneConfig(
        centerHz: 2437e6,
        sampleRate: 40e6,
        signals: [spec(vary(0, 6e6), vary(-60, 6))],
      );
    case SignalKind.bluetooth:
      return SceneConfig(
        centerHz: 2441e6,
        sampleRate: 40e6,
        signals: [spec(0, vary(-62, 5))],
      );
    case SignalKind.mesh:
      return SceneConfig(
        centerHz: 2380e6,
        sampleRate: 20e6,
        timeScale: 0.25,
        signals: [
          spec(vary(0, 3e6), -60, {
            'n': 5,
            'bandwidth': 8e6,
            'p0': vary(-52, 3),
            'p1': vary(-62, 4),
            'p2': vary(-70, 4),
            'p3': vary(-58, 4),
            'p4': vary(-75, 4),
          }),
        ],
      );
  }
}
