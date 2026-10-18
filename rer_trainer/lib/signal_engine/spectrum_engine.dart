import 'dart:math' as math;
import 'dart:typed_data';

import 'package:fftea/fftea.dart';

import 'core/rng.dart';
import 'core/units.dart';
import 'scene/scene_config.dart';
import 'signals/signal_source.dart';

/// Обчислює рядки спектра (дБм на бін) для сцени: генерує IQ, накладає
/// вікно Ганна, виконує БПФ і усереднює кілька підкадрів у межах рядка.
class SpectrumEngine {
  SpectrumEngine(SceneConfig config) {
    configure(config);
  }

  late SceneConfig _config;
  late List<SignalSource> _sources;
  late FFT _fft;
  late Float64List _window;
  late double _windowGain;
  late Float64List _re, _im;
  late Float64x2List _buf;
  late Float64List _acc;
  Float64List? _avg;
  final Rng _noise = Rng(99);
  double _time = 0;

  SceneConfig get config => _config;

  double get time => _time;

  void configure(SceneConfig config) {
    final Map<String, SignalSource> oldSources =
        _configured ? {for (final s in _sources) s.spec.id: s} : {};
    final sizeChanged = !_configured || config.fftSize != _config.fftSize;
    _config = config;
    _sources = [
      for (final spec in config.signals)
        if (spec.enabled)
          (oldSources[spec.id]?.spec == spec)
              ? oldSources[spec.id]!
              : SignalSource.fromSpec(spec),
    ];
    if (sizeChanged) {
      final n = config.fftSize;
      _fft = FFT(n);
      _window = Float64List(n);
      var sum = 0.0;
      for (var i = 0; i < n; i++) {
        _window[i] = 0.5 - 0.5 * math.cos(2 * math.pi * i / (n - 1));
        sum += _window[i];
      }
      _windowGain = sum * sum;
      _re = Float64List(n);
      _im = Float64List(n);
      _buf = Float64x2List(n);
      _acc = Float64List(n);
      _avg = null;
    }
    _configured = true;
  }

  bool _configured = false;

  /// Кількість підкадрів на рядок: більше для малих БПФ, щоб не пропускати
  /// короткі пакети.
  int get _subframes => _config.fftSize <= 1024 ? 8 : 4;

  Float32List nextRow() {
    final n = _config.fftSize;
    final fs = _config.sampleRate;
    final dt = 1 / _config.rowsPerSecond;
    final sigma =
        math.sqrt(dbmToMw(_config.noiseDensityDbmHz) * fs / 2);
    final k = _subframes;

    for (final s in _sources) {
      s.beginRow(dt);
    }
    _acc.fillRange(0, n, 0);
    for (var sf = 0; sf < k; sf++) {
      final t = _time + (sf + _noise.uniform() * 0.8) * dt / k;
      for (var i = 0; i < n; i++) {
        _re[i] = sigma * _noise.gaussian();
        _im[i] = sigma * _noise.gaussian();
      }
      for (final s in _sources) {
        s.synth(_re, _im, t, fs);
      }
      for (var i = 0; i < n; i++) {
        final w = _window[i];
        _buf[i] = Float64x2(_re[i] * w, _im[i] * w);
      }
      _fft.inPlaceFft(_buf);
      for (var i = 0; i < n; i++) {
        final c = _buf[i];
        _acc[i] += c.x * c.x + c.y * c.y;
      }
    }
    _time += dt;

    final norm = 1 / (_windowGain * k);
    final alpha = _config.averaging.clamp(0.0, 0.98);
    var avg = _avg;
    if (avg == null || alpha == 0) {
      avg = Float64List(n);
      _avg = avg;
      for (var i = 0; i < n; i++) {
        avg[i] = _acc[i] * norm;
      }
    } else {
      for (var i = 0; i < n; i++) {
        avg[i] = alpha * avg[i] + (1 - alpha) * _acc[i] * norm;
      }
    }

    // fftshift: від’ємні частоти ліворуч, додатні праворуч.
    final out = Float32List(n);
    final half = n ~/ 2;
    for (var i = 0; i < n; i++) {
      out[i] = mwToDbm(avg[(i + half) % n]);
    }
    return out;
  }
}
