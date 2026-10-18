import 'package:flutter/material.dart';

import '../../rendering/frequency_axis.dart';
import '../../signal_engine/signal_engine.dart';
import '../../widgets/waterfall_view.dart';
import 'simulator_controls.dart';
import 'simulator_model.dart';

/// Інтерактивний симулятор водоспаду. На широкому екрані панель налаштувань
/// праворуч, на вузькому — у висувній нижній панелі.
class WaterfallSimulator extends StatefulWidget {
  const WaterfallSimulator({super.key, this.initial});

  final SceneConfig? initial;

  @override
  State<WaterfallSimulator> createState() => _WaterfallSimulatorState();
}

class _WaterfallSimulatorState extends State<WaterfallSimulator> {
  late final SimulatorModel _model =
      SimulatorModel(widget.initial ?? bandPresets().first.scene);

  @override
  void initState() {
    super.initState();
    _model.fitLevels();
    _model.start();
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
    final view = ListenableBuilder(
      listenable: _model,
      builder: (context, _) => WaterfallView(
        controller: _model.waterfall,
        axis: FrequencyAxis(_model.config.startHz, _model.config.endHz),
      ),
    );
    return LayoutBuilder(builder: (context, constraints) {
      if (constraints.maxWidth >= 760) {
        return Row(children: [
          Expanded(child: view),
          const VerticalDivider(width: 1),
          SizedBox(width: 320, child: SimulatorControls(model: _model)),
        ]);
      }
      return Stack(children: [
        Positioned.fill(child: view),
        Positioned(
          left: 8,
          bottom: 128,
          child: FloatingActionButton.small(
            heroTag: null,
            tooltip: 'Налаштування',
            onPressed: () => showModalBottomSheet<void>(
              context: context,
              isScrollControlled: true,
              showDragHandle: true,
              builder: (_) => SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.6,
                child: SimulatorControls(model: _model),
              ),
            ),
            child: const Icon(Icons.tune),
          ),
        ),
      ]);
    });
  }
}
