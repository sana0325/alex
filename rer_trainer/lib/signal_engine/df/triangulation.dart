import 'dart:math' as math;

/// Точка на площині в кілометрах (x — схід, y — північ).
class Pt {
  const Pt(this.x, this.y);

  final double x;
  final double y;

  Pt operator +(Pt o) => Pt(x + o.x, y + o.y);
  Pt operator -(Pt o) => Pt(x - o.x, y - o.y);
  Pt operator *(double k) => Pt(x * k, y * k);
  double get length => math.sqrt(x * x + y * y);
}

/// Азимут (радіани, від півночі за годинниковою стрілкою) з точки [from] на [to].
double azimuth(Pt from, Pt to) => math.atan2(to.x - from.x, to.y - from.y);

/// Один виміряний пеленг.
class Bearing {
  const Bearing(this.post, this.azimuthRad, this.sigmaRad);

  final Pt post;
  final double azimuthRad;
  final double sigmaRad;

  Pt get direction => Pt(math.sin(azimuthRad), math.cos(azimuthRad));
}

/// Еліпс похибки: центр, півосі (км) і кут великої осі (радіани від осі x).
class ErrorEllipse {
  const ErrorEllipse(this.center, this.semiMajor, this.semiMinor, this.angle);

  final Pt center;
  final double semiMajor;
  final double semiMinor;
  final double angle;

  double get area => math.pi * semiMajor * semiMinor;
}

/// Результат триангуляції.
class Fix {
  const Fix(this.position, this.ellipse, this.minCrossingAngleDeg);

  final Pt position;

  /// Еліпс 95 % довіри.
  final ErrorEllipse ellipse;

  /// Найгостріший кут між парами пеленгів — що ближче до 90°, то краще.
  final double minCrossingAngleDeg;
}

/// Оцінка положення джерела методом зважених найменших квадратів
/// (сума квадратів перпендикулярних відстаней до ліній пеленгу).
/// Повертає null, якщо пеленги майже паралельні.
Fix? triangulate(List<Bearing> bearings) {
  if (bearings.length < 2) return null;
  // Перше наближення — без урахування відстаней.
  final first = _solve(bearings, null);
  if (first == null) return null;
  var est = first;
  for (var i = 0; i < 3; i++) {
    final next = _solve(bearings, est.$1);
    if (next == null) break;
    est = next;
  }
  final (pos, cov) = est;

  // Власні значення коваріації 2×2 → півосі еліпса.
  final a = cov[0], b = cov[1], d = cov[3];
  final tr = a + d;
  final det = a * d - b * b;
  final disc = math.sqrt(math.max(0, tr * tr / 4 - det));
  final l1 = tr / 2 + disc;
  final l2 = math.max(0.0, tr / 2 - disc);
  final angle = 0.5 * math.atan2(2 * b, a - d);
  const k95 = 2.4477; // sqrt(χ²(2; 0,95))
  final ellipse = ErrorEllipse(pos, k95 * math.sqrt(l1), k95 * math.sqrt(l2), angle);

  var minAngle = 90.0;
  for (var i = 0; i < bearings.length; i++) {
    for (var j = i + 1; j < bearings.length; j++) {
      var diff = (bearings[i].azimuthRad - bearings[j].azimuthRad).abs() % math.pi;
      if (diff > math.pi / 2) diff = math.pi - diff;
      minAngle = math.min(minAngle, diff * 180 / math.pi);
    }
  }
  return Fix(pos, ellipse, minAngle);
}

(Pt, List<double>)? _solve(List<Bearing> bearings, Pt? around) {
  var s00 = 0.0, s01 = 0.0, s11 = 0.0, r0 = 0.0, r1 = 0.0;
  for (final br in bearings) {
    // Нормаль до лінії пеленгу.
    final nx = math.cos(br.azimuthRad);
    final ny = -math.sin(br.azimuthRad);
    final dist = around == null ? 1.0 : math.max(0.05, (around - br.post).length);
    final w = 1 / (br.sigmaRad * br.sigmaRad * dist * dist);
    final c = nx * br.post.x + ny * br.post.y;
    s00 += w * nx * nx;
    s01 += w * nx * ny;
    s11 += w * ny * ny;
    r0 += w * nx * c;
    r1 += w * ny * c;
  }
  final det = s00 * s11 - s01 * s01;
  if (det.abs() < 1e-9 * (s00 + s11) * (s00 + s11)) return null;
  final x = (s11 * r0 - s01 * r1) / det;
  final y = (s00 * r1 - s01 * r0) / det;
  // Обернена інформаційна матриця = коваріація оцінки.
  final cov = [s11 / det, -s01 / det, -s01 / det, s00 / det];
  return (Pt(x, y), cov);
}
