import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Мініатюрний графік ряду значень. Мінімальний діапазон осі [minSpan]
/// не дає «розтягнути» дрібний шум на всю висоту.
class Sparkline extends StatelessWidget {
  const Sparkline({super.key, required this.values, required this.color, this.minSpan = 6});

  final List<double> values;
  final Color color;
  final double minSpan;

  @override
  Widget build(BuildContext context) =>
      CustomPaint(painter: _SparkPainter(values, color, minSpan), size: Size.infinite);
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.values, this.color, this.minSpan);

  final List<double> values;
  final Color color;
  final double minSpan;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    var lo = values.reduce(math.min), hi = values.reduce(math.max);
    if (hi - lo < minSpan) {
      final mid = (hi + lo) / 2;
      lo = mid - minSpan / 2;
      hi = mid + minSpan / 2;
    }
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = i / (values.length - 1) * size.width;
      final y = size.height * (1 - (values[i] - lo) / (hi - lo));
      i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
    }
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0x14FFFFFF));
    canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5);
  }

  @override
  bool shouldRepaint(_SparkPainter old) => old.values != values || old.color != color;
}
