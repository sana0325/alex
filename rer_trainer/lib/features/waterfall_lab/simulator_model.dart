import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../rendering/palettes.dart';
import '../../rendering/waterfall_controller.dart';
import '../../signal_engine/signal_engine.dart';

/// Стан симулятора: конфігурація сцени, ізолят-генератор і контролер водоспаду.
class SimulatorModel extends ChangeNotifier {
  SimulatorModel(SceneConfig initial) : _config = initial;

  final WaterfallController waterfall = WaterfallController();
  SceneConfig _config;
  EngineHandle? _engine;
  StreamSubscription<dynamic>? _sub;
  bool _disposed = false;

  SceneConfig get config => _config;

  Future<void> start() async {
    final engine = await EngineHandle.spawn(_config);
    if (_disposed) {
      engine.dispose();
      return;
    }
    _engine = engine;
    _sub = engine.rows.listen(waterfall.addRow);
    // Конфігурація могла змінитися, поки ізолят запускався.
    engine.update(_config);
  }

  void _apply(SceneConfig config) {
    _config = config;
    _engine?.update(config);
    notifyListeners();
  }

  void toggleSignal(String id, bool enabled) => _apply(_config.copyWith(
        signals: [
          for (final s in _config.signals)
            s.id == id ? s.copyWith(enabled: enabled) : s,
        ],
      ));

  void setSignalPower(String id, double dbm) => _apply(_config.copyWith(
        signals: [
          for (final s in _config.signals)
            s.id == id ? s.copyWith(powerDbm: dbm) : s,
        ],
      ));

  set fftSize(int v) => _apply(_config.copyWith(fftSize: v));
  set rowsPerSecond(double v) => _apply(_config.copyWith(rowsPerSecond: v));
  set noiseDensity(double v) => _apply(_config.copyWith(noiseDensityDbmHz: v));
  set averaging(double v) => _apply(_config.copyWith(averaging: v));
  set paused(bool v) => _apply(_config.copyWith(paused: v));

  set palette(WaterfallPalette p) {
    waterfall.palette = p;
    notifyListeners();
  }

  void setLevels(double black, double white) {
    waterfall.setLevels(black, white);
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _sub?.cancel();
    _engine?.dispose();
    waterfall.dispose();
    super.dispose();
  }
}
