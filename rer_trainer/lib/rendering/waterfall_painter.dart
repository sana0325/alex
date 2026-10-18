import 'package:flutter/material.dart';

import 'frequency_axis.dart';
import 'waterfall_controller.dart';

/// Малює зображення водоспаду з кільцевого буфера: найновіший рядок угорі.
class WaterfallPainter extends CustomPainter {
  WaterfallPainter(this.controller, this.axis) : super(repaint: controller);

  final WaterfallController controller;
  final FrequencyAxis axis;

  static final Paint _imagePaint = Paint()..filterQuality = FilterQuality.low;
  static final Paint _gridPaint = Paint()
    ..color = const Color(0x33FFFFFF)
    ..strokeWidth = 1;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.black);
    final img = controller.image;
    if (img != null) {
      final w = img.width.toDouble();
      final h = img.height.toDouble();
      final head = controller.imageHead.toDouble();
      final topH = (h - head) / h * size.height;
      canvas.drawImageRect(
        img,
        Rect.fromLTWH(0, head, w, h - head),
        Rect.fromLTWH(0, 0, size.width, topH),
        _imagePaint,
      );
      if (head > 0) {
        canvas.drawImageRect(
          img,
          Rect.fromLTWH(0, 0, w, head),
          Rect.fromLTWH(0, topH, size.width, size.height - topH),
          _imagePaint,
        );
      }
    }
    for (final tick in axis.ticks()) {
      final x = axis.xOf(tick, size.width);
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), _gridPaint);
    }
  }

  @override
  bool shouldRepaint(WaterfallPainter old) =>
      old.controller != controller || old.axis != axis;
}
