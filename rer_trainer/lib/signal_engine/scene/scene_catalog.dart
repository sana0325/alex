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

/// Набір сигналів для симулятора в певному діапазоні.
class BandPreset {
  const BandPreset(this.title, this.scene);

  final String title;
  final SceneConfig scene;
}

SignalSpec _s(String id, SignalKind kind, double offsetMhz, double dbm,
        [Map<String, double> params = const {}, bool enabled = true]) =>
    SignalSpec(
      id: id,
      kind: kind,
      offsetHz: offsetMhz * 1e6,
      powerDbm: dbm,
      enabled: enabled,
      seed: id.hashCode & 0xffff,
      params: params,
    );

/// Діапазони симулятора. Перший — огляд з усіма типами сигналів БПЛА
/// одночасно (навчальна сцена: у реальному ефірі вони рідко бувають разом).
/// Завади (Wi-Fi, Bluetooth) там є, але вимкнені.
List<BandPreset> bandPresets() => [
      BandPreset(
        'Усі сигнали БПЛА (огляд)',
        SceneConfig(centerHz: 2440e6, sampleRate: 80e6, signals: [
          _s('fpv', SignalKind.analogFpv, -28, -55, {'deviation': 3e6, 'audioOffset': 5.5e6}),
          _s('mesh', SignalKind.mesh, -14, -58, {
            'n': 4, 'bandwidth': 6e6, 'frame': 0.16,
            'p0': -52, 'p1': -60, 'p2': -68, 'p3': -57,
          }),
          _s('fhss', SignalKind.fhssControl, 0, -58, {'channels': 60, 'spacing': 1.2e6}),
          _s('lora', SignalKind.lora, 8, -52, {'sf': 9, 'bandwidth': 812e3, 'period': 0.12, 'payload': 30}),
          _s('video', SignalKind.ofdmVideo, 22, -58, {'bandwidth': 10e6}),
          _s('telemetry', SignalKind.telemetry, 35, -55, {'deviation': 80e3, 'symbolRate': 50e3, 'period': 0.2, 'burst': 0.03}),
          _s('wifi', SignalKind.wifi, -3, -62, const {}, false),
          _s('bt', SignalKind.bluetooth, 0, -72, const {}, false),
        ]),
      ),
      BandPreset(
        '2,4 ГГц: керування та завади',
        SceneConfig(centerHz: 2440e6, sampleRate: 80e6, signals: [
          _s('fhss', SignalKind.fhssControl, 0, -60, {'channels': 60, 'spacing': 1.2e6}),
          _s('wifi1', SignalKind.wifi, -28, -58),
          _s('wifi6', SignalKind.wifi, -3, -66, {'load': 0.3}),
          _s('wifi11', SignalKind.wifi, 22, -62),
          _s('bt', SignalKind.bluetooth, 0, -70),
          _s('lora', SignalKind.lora, 30, -64, {'sf': 9, 'bandwidth': 812e3, 'period': 0.5, 'payload': 12}),
        ]),
      ),
      BandPreset(
        '5,8 ГГц: відео',
        SceneConfig(centerHz: 5800e6, sampleRate: 120e6, signals: [
          _s('fpv1', SignalKind.analogFpv, -40, -55),
          _s('fpv2', SignalKind.analogFpv, -5, -63),
          _s('video', SignalKind.ofdmVideo, 30, -58, {'bandwidth': 20e6}),
          _s('wifi', SignalKind.wifi, 5, -66, {'bandwidth': 18e6}),
        ]),
      ),
      BandPreset(
        '1,2–1,3 ГГц: відео та mesh',
        SceneConfig(centerHz: 1290e6, sampleRate: 60e6, signals: [
          _s('fpv', SignalKind.analogFpv, -12, -57),
          _s('mesh', SignalKind.mesh, 15, -60, {
            'n': 5, 'bandwidth': 8e6, 'frame': 0.2,
            'p0': -54, 'p1': -62, 'p2': -72, 'p3': -58, 'p4': -67,
          }),
        ]),
      ),
      BandPreset(
        '868 МГц: LoRa, керування, телеметрія',
        SceneConfig(centerHz: 868e6, sampleRate: 4e6, noiseDensityDbmHz: -160, signals: [
          _s('lora', SignalKind.lora, -1.2, -88, {'sf': 8, 'bandwidth': 125e3, 'period': 0.7, 'payload': 20}),
          _s('fhss', SignalKind.fhssControl, 0.4, -90, {
            'channels': 20, 'spacing': 0.15e6, 'dwell': 0.02, 'symbolRate': 50e3, 'deviation': 30e3,
          }),
          _s('telemetry', SignalKind.telemetry, 1.5, -94),
        ]),
      ),
      BandPreset(
        '433 МГц: телеметрія',
        SceneConfig(centerHz: 433.9e6, sampleRate: 2e6, noiseDensityDbmHz: -158, signals: [
          _s('telemetry1', SignalKind.telemetry, -0.5, -86, {'period': 0.25}),
          _s('telemetry2', SignalKind.telemetry, 0.35, -93, {'period': 0.6, 'burst': 0.04}),
          _s('lora', SignalKind.lora, -0.1, -92, {'sf': 8, 'bandwidth': 125e3, 'period': 0.9, 'payload': 20}),
        ]),
      ),
    ];
