import 'dart:math' as math;

import '../core/rng.dart';

/// Повільні завмирання Райса: пряма компонента + розсіяна складова,
/// що змінюється як авторегресійний процес першого порядку.
class Fading {
  Fading({required this.kFactor, required this.rateHz, required this.rng});

  /// Відношення потужності прямої компоненти до розсіяної (K-фактор).
  final double kFactor;

  /// Швидкість зміни завмирань (Гц).
  final double rateHz;

  final Rng rng;
  double _zr = 0, _zi = 0;

  double _power = 1;

  /// Поточний множник потужності (середнє значення ≈ 1).
  double get power => _power;

  void step(double dt) {
    final rho = math.exp(-dt * rateHz);
    final s = math.sqrt((1 - rho * rho) / 2);
    _zr = rho * _zr + s * rng.gaussian();
    _zi = rho * _zi + s * rng.gaussian();
    final los = math.sqrt(kFactor / (kFactor + 1));
    final sc = math.sqrt(1 / (kFactor + 1));
    final re = los + sc * _zr;
    final im = sc * _zi;
    _power = re * re + im * im;
  }
}
