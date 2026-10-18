import 'package:flutter/material.dart';

import '../rendering/frequency_axis.dart';
import '../rendering/spectrum_painter.dart';
import '../rendering/waterfall_controller.dart';
import '../rendering/waterfall_painter.dart';

/// Водоспад + шкала частот + живий спектр під ним. Дотик/наведення
/// показує частоту та рівень у точці.
class WaterfallView extends StatefulWidget {
  const WaterfallView({
    super.key,
    required this.controller,
    required this.axis,
    this.spectrumHeight = 120,
    this.showStats = true,
  });

  final WaterfallController controller;
  final FrequencyAxis axis;
  final double spectrumHeight;
  final bool showStats;

  @override
  State<WaterfallView> createState() => _WaterfallViewState();
}

class _WaterfallViewState extends State<WaterfallView> {
  double? _cursorX;
  double _width = 1;

  void _setCursor(Offset local) => setState(() => _cursorX = local.dx);

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return LayoutBuilder(builder: (context, constraints) {
      _width = constraints.maxWidth;
      return MouseRegion(
        onHover: (e) => _setCursor(e.localPosition),
        onExit: (_) => setState(() => _cursorX = null),
        child: GestureDetector(
          onTapDown: (d) => _setCursor(d.localPosition),
          onHorizontalDragUpdate: (d) => _setCursor(d.localPosition),
          child: Stack(children: [
            Column(children: [
              SizedBox(
                height: 18,
                width: double.infinity,
                child: CustomPaint(
                  painter: FrequencyAxisPainter(
                      widget.axis, scheme.onSurfaceVariant),
                ),
              ),
              Expanded(
                child: RepaintBoundary(
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: WaterfallPainter(widget.controller, widget.axis),
                  ),
                ),
              ),
              SizedBox(
                height: widget.spectrumHeight,
                width: double.infinity,
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: SpectrumPainter(
                      widget.controller,
                      widget.axis,
                      traceColor: scheme.primary,
                    ),
                  ),
                ),
              ),
            ]),
            if (_cursorX != null) _cursorOverlay(context),
            if (widget.showStats)
              Positioned(
                right: 6,
                top: 22,
                child: ListenableBuilder(
                  listenable: widget.controller,
                  builder: (context, _) => _Badge(
                    '${widget.controller.fps.toStringAsFixed(0)} кадр/с',
                  ),
                ),
              ),
          ]),
        ),
      );
    });
  }

  Widget _cursorOverlay(BuildContext context) {
    final x = _cursorX!.clamp(0.0, _width);
    final hz = widget.axis.hzAt(x, _width);
    return Positioned.fill(
      child: IgnorePointer(
        child: ListenableBuilder(
          listenable: widget.controller,
          builder: (context, _) {
            final row = widget.controller.latest;
            String level = '';
            if (row != null && row.isNotEmpty) {
              final i = (x / _width * row.length)
                  .floor()
                  .clamp(0, row.length - 1);
              level = ' · ${row[i].toStringAsFixed(0)} дБм';
            }
            return Stack(children: [
              Positioned(
                left: x,
                top: 18,
                bottom: 0,
                child: Container(width: 1, color: Colors.white54),
              ),
              Positioned(
                left: (x + 6).clamp(0.0, _width - 170),
                top: 22,
                child: _Badge(
                    '${(hz / 1e6).toStringAsFixed(2)} МГц$level'),
              ),
            ]);
          },
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.65),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(text,
            style: const TextStyle(fontSize: 11, color: Colors.white)),
      );
}
