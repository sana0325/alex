import 'package:flutter/material.dart';

import '../../rendering/palettes.dart';
import '../../signal_engine/signal_engine.dart';
import 'simulator_model.dart';

/// Панель налаштувань симулятора водоспаду.
class SimulatorControls extends StatelessWidget {
  const SimulatorControls({super.key, required this.model});

  final SimulatorModel model;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: model,
      builder: (context, _) {
        final c = model.config;
        final wf = model.waterfall;
        final text = Theme.of(context).textTheme;
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Row(children: [
              Expanded(child: Text('Сигнали', style: text.titleSmall)),
              IconButton.filledTonal(
                tooltip: c.paused ? 'Продовжити' : 'Пауза',
                icon: Icon(c.paused ? Icons.play_arrow : Icons.pause),
                onPressed: () => model.paused = !c.paused,
              ),
            ]),
            for (final s in c.signals) _SignalTile(model: model, spec: s),
            const Divider(height: 24),
            Text('Розмір БПФ (RBW ≈ ${(rbwHz(c.sampleRate, c.fftSize) / 1e3).toStringAsFixed(0)} кГц)',
                style: text.titleSmall),
            const SizedBox(height: 6),
            SegmentedButton<int>(
              segments: const [
                ButtonSegment(value: 256, label: Text('256')),
                ButtonSegment(value: 512, label: Text('512')),
                ButtonSegment(value: 1024, label: Text('1024')),
                ButtonSegment(value: 2048, label: Text('2048')),
              ],
              selected: {c.fftSize},
              showSelectedIcon: false,
              onSelectionChanged: (v) => model.fftSize = v.first,
            ),
            _LabeledSlider(
              label: 'Швидкість прокрутки',
              valueText: '${c.rowsPerSecond.round()} рядків/с',
              value: c.rowsPerSecond,
              min: 5,
              max: 60,
              divisions: 11,
              onChanged: (v) => model.rowsPerSecond = v,
            ),
            _LabeledSlider(
              label: 'Усереднення',
              valueText: c.averaging == 0
                  ? 'вимкнено'
                  : '${(c.averaging * 100).round()} %',
              value: c.averaging,
              min: 0,
              max: 0.9,
              divisions: 9,
              onChanged: (v) => model.averaging = v,
            ),
            _LabeledSlider(
              label: 'Рівень шуму',
              valueText: '${c.noiseDensityDbmHz.round()} дБм/Гц',
              value: c.noiseDensityDbmHz,
              min: -165,
              max: -130,
              divisions: 35,
              onChanged: (v) => model.noiseDensity = v,
            ),
            const Divider(height: 24),
            Text('Палітра', style: text.titleSmall),
            const SizedBox(height: 6),
            DropdownButton<WaterfallPalette>(
              value: wf.palette,
              isExpanded: true,
              items: [
                for (final p in WaterfallPalette.values)
                  DropdownMenuItem(
                    value: p,
                    child: Row(children: [
                      Container(
                        width: 48,
                        height: 12,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: p.stops),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(p.title),
                    ]),
                  ),
              ],
              onChanged: (p) {
                if (p != null) model.palette = p;
              },
            ),
            const SizedBox(height: 12),
            Text(
                'Рівні чорного / білого: ${wf.blackDb.round()} … ${wf.whiteDb.round()} дБм',
                style: text.titleSmall),
            RangeSlider(
              values: RangeValues(wf.blackDb, wf.whiteDb),
              min: -140,
              max: -20,
              divisions: 120,
              onChanged: (r) => model.setLevels(r.start, r.end),
            ),
            TextButton.icon(
              onPressed: wf.clearPeak,
              icon: const Icon(Icons.restart_alt),
              label: const Text('Скинути утримання піків'),
            ),
          ],
        );
      },
    );
  }
}

class _SignalTile extends StatelessWidget {
  const _SignalTile({required this.model, required this.spec});

  final SimulatorModel model;
  final SignalSpec spec;

  @override
  Widget build(BuildContext context) {
    final f = (model.config.centerHz + spec.offsetHz) / 1e6;
    return Column(children: [
      SwitchListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        title: Text(spec.kind.title),
        subtitle: Text('≈ ${f.toStringAsFixed(0)} МГц · ${spec.powerDbm.round()} дБм'),
        value: spec.enabled,
        onChanged: (v) => model.toggleSignal(spec.id, v),
      ),
      if (spec.enabled)
        Slider(
          value: spec.powerDbm,
          min: -100,
          max: -40,
          divisions: 60,
          label: '${spec.powerDbm.round()} дБм',
          onChanged: (v) => model.setSignalPower(spec.id, v),
        ),
    ]);
  }
}

class _LabeledSlider extends StatelessWidget {
  const _LabeledSlider({
    required this.label,
    required this.valueText,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
    this.divisions,
  });

  final String label;
  final String valueText;
  final double value;
  final double min;
  final double max;
  final int? divisions;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                  child: Text(label,
                      style: Theme.of(context).textTheme.titleSmall)),
              Text(valueText),
            ]),
            Slider(
              value: value.clamp(min, max),
              min: min,
              max: max,
              divisions: divisions,
              onChanged: onChanged,
            ),
          ],
        ),
      );
}
