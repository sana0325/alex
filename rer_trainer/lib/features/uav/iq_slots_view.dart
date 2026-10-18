import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../signal_engine/core/rng.dart';

/// IQ-режим: огинаюча сигналу в часі для кадру 56 мс із 16 таймслотів.
/// Зайняті слоти — сплески, вільні — лише шум. Анімується, як живий запис.
class IqSlotsView extends StatefulWidget {
  const IqSlotsView({super.key, required this.slots, this.mirror});

  /// Номери зайнятих слотів (0–15).
  final List<int> slots;

  /// Другий, «дзеркальний» сигнал (наприклад, Ланцет поруч із Zala).
  final List<int>? mirror;

  @override
  State<IqSlotsView> createState() => _IqSlotsViewState();
}

class _IqSlotsViewState extends State<IqSlotsView> with SingleTickerProviderStateMixin {
  late final AnimationController _anim =
      AnimationController(vsync: this, duration: const Duration(seconds: 4))..repeat();

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Зайнято ${widget.slots.length} з 16 слотів', style: text.titleMedium),
      const SizedBox(height: 8),
      SizedBox(
        height: 120,
        child: AnimatedBuilder(
          animation: _anim,
          builder: (context, _) => CustomPaint(
            size: Size.infinite,
            painter: _EnvelopePainter(widget.slots, widget.mirror, _anim.value, scheme),
          ),
        ),
      ),
      const SizedBox(height: 8),
      _SlotStrip(slots: widget.slots, color: scheme.primary),
      if (widget.mirror != null) ...[
        const SizedBox(height: 4),
        _SlotStrip(slots: widget.mirror!, color: scheme.tertiary),
      ],
      const SizedBox(height: 4),
      Text('Кадр 56 мс · 16 таймслотів · дані ~3 мс у кожному слоті', style: text.bodySmall),
    ]);
  }
}

class _SlotStrip extends StatelessWidget {
  const _SlotStrip({required this.slots, required this.color});

  final List<int> slots;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(children: [
        for (var i = 0; i < 16; i++)
          Expanded(
            child: Container(
              height: 22,
              margin: const EdgeInsets.symmetric(horizontal: 1),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: slots.contains(i) ? color : Colors.transparent,
                border: Border.all(color: color.withValues(alpha: 0.6)),
                borderRadius: BorderRadius.circular(3),
              ),
              child: Text('${i + 1}',
                  style: TextStyle(
                      fontSize: 9,
                      color: slots.contains(i) ? Colors.black : color)),
            ),
          ),
      ]);
}

class _EnvelopePainter extends CustomPainter {
  _EnvelopePainter(this.slots, this.mirror, this.phase, this.scheme);

  final List<int> slots;
  final List<int>? mirror;
  final double phase;
  final ColorScheme scheme;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.black);
    const frames = 2;
    final grid = Paint()..color = const Color(0x22FFFFFF);
    for (var i = 0; i <= frames * 16; i++) {
      final x = i / (frames * 16) * size.width;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), i % 16 == 0 ? (Paint()..color = const Color(0x66FFFFFF)) : grid);
    }
    final seed = (phase * 40).floor();
    void trace(List<int> occupied, Color color, double scale) {
      final path = Path();
      const n = 900;
      for (var i = 0; i < n; i++) {
        final pos = i / n * frames * 16;
        final slot = pos.floor() % 16;
        final inData = pos - pos.floor() < 0.75;
        final noise = hash01(i, seed) * 0.08;
        final on = occupied.contains(slot) && inData;
        final a = on ? (0.55 + 0.35 * hash01(i * 7, seed)) * scale : noise;
        final x = i / n * size.width;
        final y = size.height * (1 - math.min(0.98, a + noise * 0.3));
        i == 0 ? path.moveTo(x, y) : path.lineTo(x, y);
      }
      canvas.drawPath(
          path,
          Paint()
            ..color = color
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1);
    }

    if (mirror != null) trace(mirror!, scheme.tertiary, 0.55);
    trace(slots, scheme.primary, 1);
  }

  @override
  bool shouldRepaint(_EnvelopePainter old) => old.phase != phase || old.slots != slots;
}
