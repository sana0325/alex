import 'package:flutter/material.dart';

/// Відображення частоти на горизонтальну координату й підбір «круглих» поділок.
@immutable
class FrequencyAxis {
  const FrequencyAxis(this.startHz, this.endHz);

  final double startHz;
  final double endHz;

  double get spanHz => endHz - startHz;

  double xOf(double hz, double width) => (hz - startHz) / spanHz * width;

  double hzAt(double x, double width) => startHz + x / width * spanHz;

  double get step {
    const steps = [0.1e6, 0.2e6, 0.5e6, 1e6, 2e6, 5e6, 10e6, 20e6, 50e6];
    for (final s in steps) {
      if (spanHz / s <= 8) return s;
    }
    return 100e6;
  }

  Iterable<double> ticks() sync* {
    final s = step;
    var f = (startHz / s).ceil() * s;
    while (f <= endHz) {
      yield f;
      f += s;
    }
  }

  @override
  bool operator ==(Object other) =>
      other is FrequencyAxis &&
      other.startHz == startHz &&
      other.endHz == endHz;

  @override
  int get hashCode => Object.hash(startHz, endHz);
}

/// Шкала частот над водоспадом.
class FrequencyAxisPainter extends CustomPainter {
  FrequencyAxisPainter(this.axis, this.color);

  final FrequencyAxis axis;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final tickPaint = Paint()
      ..color = color
      ..strokeWidth = 1;
    final digits = axis.step < 1e6 ? 1 : 0;
    for (final f in axis.ticks()) {
      final x = axis.xOf(f, size.width);
      canvas.drawLine(
          Offset(x, size.height - 5), Offset(x, size.height), tickPaint);
      final tp = TextPainter(
        text: TextSpan(
          text: (f / 1e6).toStringAsFixed(digits),
          style: TextStyle(color: color, fontSize: 11),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final left = (x - tp.width / 2).clamp(0.0, size.width - tp.width);
      tp.paint(canvas, Offset(left, 0));
    }
  }

  @override
  bool shouldRepaint(FrequencyAxisPainter old) =>
      old.axis != axis || old.color != color;
}
