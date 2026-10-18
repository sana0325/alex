import 'dart:async';
import 'dart:typed_data';

import '../scene/scene_config.dart';
import '../spectrum_engine.dart';

/// Генератор спектра для веб-версії: у браузері немає ізолятів, тому
/// рядки обчислюються в основному потоці за таймером.
class EngineHandle {
  EngineHandle._(this._engine, this._config);

  final SpectrumEngine _engine;
  SceneConfig _config;
  final StreamController<Float32List> _rows = StreamController<Float32List>();
  Timer? _timer;

  Stream<Float32List> get rows => _rows.stream;

  static Future<EngineHandle> spawn(SceneConfig config) async {
    final h = EngineHandle._(SpectrumEngine(config), config);
    h._schedule();
    return h;
  }

  void _schedule() {
    _timer?.cancel();
    if (_config.paused) return;
    final period = Duration(microseconds: (1e6 / _config.rowsPerSecond).round());
    _timer = Timer.periodic(period, (_) {
      if (!_rows.isClosed) _rows.add(_engine.nextRow());
    });
  }

  void update(SceneConfig config) {
    final restart = config.paused != _config.paused || config.rowsPerSecond != _config.rowsPerSecond;
    _config = config;
    _engine.configure(config);
    if (restart) _schedule();
  }

  void dispose() {
    _timer?.cancel();
    _rows.close();
  }
}
