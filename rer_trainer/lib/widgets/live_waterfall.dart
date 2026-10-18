import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../features/waterfall_lab/simulator_model.dart';
import '../rendering/frequency_axis.dart';
import '../signal_engine/signal_engine.dart';
import 'waterfall_view.dart';

/// Компактний «живий» водоспад для сцени без панелі налаштувань.
/// Рівні чорного/білого підбираються автоматично під шумовий поріг сцени.
class LiveWaterfall extends StatefulWidget {
  const LiveWaterfall({
    super.key,
    required this.scene,
    this.spectrumHeight = 80,
    this.onModel,
    this.overlay,
  });

  final SceneConfig scene;
  final double spectrumHeight;

  /// Дає доступ до моделі, щоб батьківський віджет міг змінювати сцену.
  final ValueChanged<SimulatorModel>? onModel;

  /// Додатковий шар поверх водоспаду (наприклад, мітки сигналів).
  final Widget Function(BuildContext context, FrequencyAxis axis)? overlay;

  @override
  State<LiveWaterfall> createState() => _LiveWaterfallState();
}

double noiseFloorPerBin(SceneConfig c) =>
    c.noiseDensityDbmHz +
    10 * math.log(c.sampleRate * 1.5 / c.fftSize) / math.ln10;

class _LiveWaterfallState extends State<LiveWaterfall> {
  late final SimulatorModel _model = SimulatorModel(widget.scene);

  @override
  void initState() {
    super.initState();
    final floor = noiseFloorPerBin(widget.scene);
    _model.setLevels(floor - 3, floor + 42);
    _model.start();
    widget.onModel?.call(_model);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Неактивні вкладки навігації вимикають TickerMode — ставимо на паузу.
    _model.visible = TickerMode.valuesOf(context).enabled;
  }

  @override
  void dispose() {
    _model.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.scene;
    final axis = FrequencyAxis(c.startHz, c.endHz);
    return Stack(children: [
      Positioned.fill(
        child: WaterfallView(
          controller: _model.waterfall,
          axis: axis,
          spectrumHeight: widget.spectrumHeight,
          showStats: false,
        ),
      ),
      if (widget.overlay != null)
        Positioned.fill(child: IgnorePointer(child: widget.overlay!(context, axis))),
    ]);
  }
}
