import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import '../modules/module_registry.dart';

/// Статистика: результати тестів, точність ідентифікації, теми з помилками.
class StatsScreen extends StatelessWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<ProgressService>();
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    final mistakes = p.mistakesByTopic.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final maxMistakes = mistakes.isEmpty ? 1 : mistakes.first.value;
    final ident = p.identStats.entries.toList()
      ..sort((a, b) => (a.value.$1 / a.value.$2).compareTo(b.value.$1 / b.value.$2));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Статистика'),
        actions: [
          IconButton(
            tooltip: 'Скинути прогрес',
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Скинути весь прогрес?'),
                  content: const Text('Результати тестів і статистику буде видалено.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Скасувати')),
                    FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Скинути')),
                  ],
                ),
              );
              if (ok == true) await p.reset();
            },
          ),
        ],
      ),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 820),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Тести модулів (найкращий результат)', style: text.titleMedium),
              const SizedBox(height: 8),
              for (final m in modules.where((m) => m.quizAsset != null))
                _Bar(label: m.title, value: (p.bestScore(m.id) ?? 0) / 100,
                    trailing: p.bestScore(m.id) == null ? '—' : '${p.bestScore(m.id)} %',
                    color: scheme.primary),
              _Bar(label: 'Підсумковий іспит', value: (p.bestScore('exam') ?? 0) / 100,
                  trailing: p.bestScore('exam') == null ? '—' : '${p.bestScore('exam')} %',
                  color: scheme.secondary),
              const SizedBox(height: 20),
              Text('Ідентифікація: точність за типами', style: text.titleMedium),
              const SizedBox(height: 8),
              if (ident.isEmpty)
                const Text('Ще немає даних — пройдіть режим «Ідентифікація на час».')
              else
                for (final e in ident)
                  _Bar(
                    label: e.key,
                    value: e.value.$1 / e.value.$2,
                    trailing: '${e.value.$1}/${e.value.$2}',
                    color: e.value.$1 / e.value.$2 >= 0.7 ? scheme.primary : scheme.error,
                  ),
              const SizedBox(height: 20),
              Text('Теми з найбільшою кількістю помилок', style: text.titleMedium),
              const SizedBox(height: 8),
              if (mistakes.isEmpty)
                const Text('Помилок поки немає.')
              else
                for (final e in mistakes.take(12))
                  _Bar(label: e.key, value: e.value / maxMistakes, trailing: '${e.value}', color: scheme.error),
            ],
          ),
        ),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.trailing, required this.color});

  final String label;
  final double value;
  final String trailing;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text(label)), Text(trailing)]),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: value.clamp(0.0, 1.0),
              minHeight: 8,
              color: color,
              backgroundColor: color.withValues(alpha: 0.15),
            ),
          ),
        ]),
      );
}
