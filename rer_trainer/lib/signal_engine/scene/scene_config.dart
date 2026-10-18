import '../signals/signal_spec.dart';

/// Повний опис сцени для генератора. Передається в ізолят цілком.
class SceneConfig {
  const SceneConfig({
    required this.centerHz,
    required this.sampleRate,
    required this.signals,
    this.fftSize = 1024,
    this.rowsPerSecond = 30,
    this.noiseDensityDbmHz = -150,
    this.averaging = 0.0,
    this.paused = false,
    this.timeScale = 1.0,
  });

  final double centerHz;

  /// Частота дискретизації = ширина відображуваної смуги.
  final double sampleRate;
  final int fftSize;
  final double rowsPerSecond;

  /// Спектральна густина теплового шуму приймача.
  final double noiseDensityDbmHz;

  /// Коефіцієнт експоненційного усереднення рядків (0 — без усереднення).
  final double averaging;
  final bool paused;

  /// Скільки секунд модельного часу припадає на секунду реального.
  /// Менше 1 — «уповільнення», щоб побачити швидкі процеси (chirp, TDMA).
  final double timeScale;
  final List<SignalSpec> signals;

  SceneConfig withCenter(double centerHz, double sampleRate) => SceneConfig(
        centerHz: centerHz,
        sampleRate: sampleRate,
        fftSize: fftSize,
        rowsPerSecond: rowsPerSecond,
        noiseDensityDbmHz: noiseDensityDbmHz,
        averaging: averaging,
        paused: paused,
        timeScale: timeScale,
        signals: signals,
      );

  double get startHz => centerHz - sampleRate / 2;
  double get endHz => centerHz + sampleRate / 2;

  SceneConfig copyWith({
    int? fftSize,
    double? rowsPerSecond,
    double? noiseDensityDbmHz,
    double? averaging,
    bool? paused,
    double? timeScale,
    List<SignalSpec>? signals,
  }) =>
      SceneConfig(
        centerHz: centerHz,
        sampleRate: sampleRate,
        fftSize: fftSize ?? this.fftSize,
        rowsPerSecond: rowsPerSecond ?? this.rowsPerSecond,
        noiseDensityDbmHz: noiseDensityDbmHz ?? this.noiseDensityDbmHz,
        averaging: averaging ?? this.averaging,
        paused: paused ?? this.paused,
        timeScale: timeScale ?? this.timeScale,
        signals: signals ?? this.signals,
      );

  /// Навчальна сцена діапазону 2,4 ГГц з трьома типами сигналів.
  static SceneConfig demo24() => const SceneConfig(
        centerHz: 2440e6,
        sampleRate: 40e6,
        signals: [
          SignalSpec(
            id: 'fpv',
            kind: SignalKind.analogFpv,
            offsetHz: -9e6,
            powerDbm: -55,
            seed: 11,
          ),
          SignalSpec(
            id: 'fhss',
            kind: SignalKind.fhssControl,
            offsetHz: 0,
            powerDbm: -62,
            seed: 23,
          ),
          SignalSpec(
            id: 'telemetry',
            kind: SignalKind.telemetry,
            offsetHz: 14e6,
            powerDbm: -70,
            seed: 37,
          ),
        ],
      );
}
