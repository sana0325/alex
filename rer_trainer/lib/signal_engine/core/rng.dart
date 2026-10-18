import 'dart:math' as math;

/// Генератор випадкових чисел з гаусівським розподілом (метод Марсальї).
class Rng {
  Rng([int? seed]) : _r = math.Random(seed);

  final math.Random _r;
  double? _spare;

  double uniform() => _r.nextDouble();

  int nextInt(int max) => _r.nextInt(max);

  double gaussian() {
    final spare = _spare;
    if (spare != null) {
      _spare = null;
      return spare;
    }
    double u, v, s;
    do {
      u = _r.nextDouble() * 2 - 1;
      v = _r.nextDouble() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s == 0);
    final m = math.sqrt(-2 * math.log(s) / s);
    _spare = v * m;
    return u * m;
  }
}

/// Детермінований 32-бітний хеш пари цілих чисел.
/// Потрібен, щоб послідовності стрибків і дані пакетів були відтворюваними.
int hashInt(int a, [int b = 0]) {
  var h = ((a * 0x27d4eb2d) ^ (b * 0x165667b1) ^ 0x9e3779b9) & 0xffffffff;
  h ^= h >> 15;
  h = (h * 0x85ebca6b) & 0xffffffff;
  h ^= h >> 13;
  h = (h * 0xc2b2ae35) & 0xffffffff;
  h ^= h >> 16;
  return h;
}

/// Хеш, нормований у діапазон [0, 1).
double hash01(int a, [int b = 0]) => hashInt(a, b) / 4294967296.0;
