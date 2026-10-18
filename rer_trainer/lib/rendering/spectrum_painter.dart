import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';

import 'frequency_axis.dart';
import 'waterfall_controller.dart';

/// Живий графік миттєвого спектра з утриманням піків.
class SpectrumPainter extends CustomPainter {
  SpectrumPainter(this.controller, this.axis, {required this.traceColor})
      : super(repaint: controller);

  final WaterfallController controller;
  final FrequencyAxis axis;
  final Color traceColor;

  static final Paint _grid = Paint()
    ..color = const Color(0x22FFFFFF)
    ..strokeWidth = 1;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = const Color(0xFF05080A));
    final minDb = controller.blackDb - 10;
    final maxDb = controller.whiteDb + 10;
    double yOf(double db) =>
        size.height * (1 - ((db - minDb) / (maxDb - minDb)).clamp(0.0, 1.0));

    final labelStyle = const TextStyle(color: Color(0x99FFFFFF), fontSize: 10);
    for (var db = (minDb / 10).ceil() * 10.0; db <= maxDb; db += 10) {
      final y = yOf(db);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), _grid);
      final tp = TextPainter(
        text: TextSpan(text: '${db.round()}', style: labelStyle),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(2, y - tp.height));
    }
    for (final f in axis.ticks()) {
      final x = axis.xOf(f, size.width);
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), _grid);
    }

    final peak = controller.peak;
    if (peak != null) {
      canvas.drawPath(
        _trace(peak, size, yOf),
        Paint()
          ..color = const Color(0x88FF5050)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1,
      );
    }
    final latest = controller.latest;
    if (latest != null) {
      final path = _trace(latest, size, yOf);
      final fill = Path.from(path)
        ..lineTo(size.width, size.height)
        ..lineTo(0, size.height)
        ..close();
      canvas.drawPath(fill, Paint()..color = traceColor.withValues(alpha: 0.18));
      canvas.drawPath(
        path,
        Paint()
          ..color = traceColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.2,
      );
    }
  }

  /// Будує лінію спектра, беручи максимум бінів, що потрапили в один піксель.
  Path _trace(Float32List data, Size size, double Function(double) yOf) {
    final path = Path();
    final cols = math.max(1, math.min(data.length, size.width.floor()));
    final binsPerCol = data.length / cols;
    for (var c = 0; c < cols; c++) {
      final from = (c * binsPerCol).floor();
      final to = math.max(from + 1, ((c + 1) * binsPerCol).floor());
      var v = -500.0;
      for (var i = from; i < to && i < data.length; i++) {
        if (data[i] > v) v = data[i];
      }
      final x = (c + 0.5) / cols * size.width;
      final y = yOf(v);
      if (c == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    return path;
  }

  @override
  bool shouldRepaint(SpectrumPainter old) =>
      old.controller != controller ||
      old.axis != axis ||
      old.traceColor != traceColor;
}
