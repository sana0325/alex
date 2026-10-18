import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import '../../widgets/live_waterfall.dart';
import '../../widgets/sparkline.dart';
import 'fake_scenarios.dart';

/// Тренажер «Знайди фейк»: обрати підозрілий сигнал і пояснити чому.
class FakeTrainer extends StatefulWidget {
  const FakeTrainer({super.key});

  @override
  State<FakeTrainer> createState() => _FakeTrainerState();
}

class _FakeTrainerState extends State<FakeTrainer> {
  final math.Random _rnd = math.Random();
  late FakeScenario _scenario = generateScenario(_rnd);
  int _round = 0;
  int? _picked;
  FakeReason? _reason;
  bool _checked = false;
  int _score = 0;
  int _total = 0;

  void _check() {
    final correct = _picked == _scenario.fakeIndex && _reason == _scenario.reason;
    setState(() {
      _checked = true;
      _total++;
      if (correct) _score++;
    });
    if (!correct) {
      context.read<ProgressService>().recordMistakes(['Фейки: ${_scenario.reason.title}']);
    }
  }

  void _next() => setState(() {
        _scenario = generateScenario(_rnd);
        _round++;
        _picked = null;
        _reason = null;
        _checked = false;
      });

  @override
  Widget build(BuildContext context) {
    final s = _scenario;
    final waterfall = LiveWaterfall(
      key: ValueKey(_round),
      scene: s.scene,
      spectrumHeight: 60,
      overlay: (context, axis) => LayoutBuilder(
        builder: (context, c) => Stack(children: [
          for (final cand in s.candidates)
            Positioned(
              left: (axis.xOf(cand.freqMhz * 1e6, c.maxWidth) - 11).clamp(0.0, c.maxWidth - 22),
              top: 22,
              child: CircleAvatar(
                radius: 11,
                backgroundColor: Colors.black87,
                child: Text(cand.label, style: const TextStyle(fontSize: 12, color: Colors.white)),
              ),
            ),
        ]),
      ),
    );
    final panel = ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(children: [
          Expanded(child: Text(s.briefing)),
          const SizedBox(width: 8),
          Chip(label: Text('$_score / $_total')),
        ]),
        const SizedBox(height: 8),
        Text('1. Оберіть підозрілий сигнал', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 6),
        for (var i = 0; i < s.candidates.length; i++)
          _CandidateCard(
            c: s.candidates[i],
            selected: _picked == i,
            verdict: !_checked ? null : (i == s.fakeIndex),
            onTap: _checked ? null : () => setState(() => _picked = i),
          ),
        const SizedBox(height: 8),
        Text('2. Чому він підозрілий?', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final r in s.reasonOptions)
            ChoiceChip(
              label: Text(r.title),
              selected: _reason == r,
              onSelected: _checked ? null : (_) => setState(() => _reason = r),
            ),
        ]),
        const SizedBox(height: 12),
        if (!_checked)
          FilledButton.icon(
            onPressed: _picked != null && _reason != null ? _check : null,
            icon: const Icon(Icons.fact_check),
            label: const Text('Перевірити'),
          )
        else ...[
          _Feedback(scenario: s, picked: _picked!, reason: _reason!),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _next,
            icon: const Icon(Icons.skip_next),
            label: const Text('Наступний сценарій'),
          ),
        ],
      ],
    );
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth >= 900) {
        return Row(children: [
          Expanded(child: waterfall),
          const VerticalDivider(width: 1),
          SizedBox(width: 460, child: panel),
        ]);
      }
      return Column(children: [
        SizedBox(height: c.maxHeight * 0.33, child: waterfall),
        const Divider(height: 1),
        Expanded(child: panel),
      ]);
    });
  }
}

class _Feedback extends StatelessWidget {
  const _Feedback({required this.scenario, required this.picked, required this.reason});

  final FakeScenario scenario;
  final int picked;
  final FakeReason reason;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final rightSignal = picked == scenario.fakeIndex;
    final rightReason = reason == scenario.reason;
    final ok = rightSignal && rightReason;
    final fake = scenario.candidates[scenario.fakeIndex].label;
    return Card(
      color: (ok ? scheme.primaryContainer : scheme.errorContainer).withValues(alpha: 0.5),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            ok
                ? 'Правильно!'
                : !rightSignal
                    ? 'Не той сигнал. Імітація — сигнал $fake.'
                    : 'Сигнал вірний, але причина інша.',
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 4),
          Text('Ознака: ${scenario.reason.title}. ${scenario.reason.explanation}'),
        ]),
      ),
    );
  }
}

class _CandidateCard extends StatelessWidget {
  const _CandidateCard({required this.c, required this.selected, required this.verdict, this.onTap});

  final FakeCandidate c;
  final bool selected;

  /// null — ще не перевірено; true — це фейк.
  final bool? verdict;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final border = verdict == true
        ? scheme.error
        : selected
            ? scheme.primary
            : scheme.outlineVariant;
    return Card(
      shape: RoundedRectangleBorder(
        side: BorderSide(color: border, width: selected || verdict == true ? 2 : 1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleAvatar(radius: 12, child: Text(c.label, style: const TextStyle(fontSize: 12))),
              const SizedBox(width: 8),
              Expanded(
                child: Text('${c.freqMhz.toStringAsFixed(1)} МГц · ${c.claimedType}', style: text.titleSmall),
              ),
              if (verdict == true) Icon(Icons.warning_amber, color: scheme.error),
            ]),
            const SizedBox(height: 6),
            Text('Ширина смуги: ${c.bandwidth}', style: text.bodySmall),
            const SizedBox(height: 4),
            _Series('Рівень, дБм', c.level, scheme.primary, 6),
            if (c.distance != null) _Series('Відстань до цілі (спостереження), км', c.distance!, scheme.tertiary, 0.5),
            if (c.intervalsMs != null)
              Text('Інтервали між пакетами, мс: ${c.intervalsMs!.map((v) => v.toStringAsFixed(1)).join(' · ')}',
                  style: text.bodySmall),
            if (c.repeatPercent != null)
              Text('Ідентичні пакети: ${c.repeatPercent} %', style: text.bodySmall),
            if (c.bearingMismatchKm != null)
              Text('Перетин пеленгів від місця цілі: ${c.bearingMismatchKm!.toStringAsFixed(1)} км',
                  style: text.bodySmall),
          ]),
        ),
      ),
    );
  }
}

class _Series extends StatelessWidget {
  const _Series(this.label, this.values, this.color, this.minSpan);

  final String label;
  final List<double> values;
  final Color color;
  final double minSpan;

  @override
  Widget build(BuildContext context) {
    final lo = values.reduce(math.min), hi = values.reduce(math.max);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(children: [
        Expanded(
          flex: 3,
          child: Text('$label\n${lo.toStringAsFixed(1)} … ${hi.toStringAsFixed(1)}',
              style: Theme.of(context).textTheme.bodySmall),
        ),
        Expanded(flex: 2, child: SizedBox(height: 30, child: Sparkline(values: values, color: color, minSpan: minSpan))),
      ]),
    );
  }
}
