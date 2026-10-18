import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import '../modules/module_registry.dart';

class TrainingScreen extends StatelessWidget {
  const TrainingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final progress = context.watch<ProgressService>();
    final theme = Theme.of(context);
    final mistakes = progress.mistakesByTopic.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    return Scaffold(
      appBar: AppBar(title: const Text('Тренування')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Text('Тести модулів', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final m in modules.where((m) => m.quizAsset != null))
            Card(
              child: ListTile(
                enabled: m.available,
                leading: Icon(m.icon),
                title: Text(m.title),
                subtitle: Text(progress.bestScore(m.id) == null
                    ? 'Ще не пройдено'
                    : 'Найкращий результат: ${progress.bestScore(m.id)} % · спроб: ${progress.attempts(m.id)}'),
                trailing: const Icon(Icons.play_arrow),
                onTap: () => context.go('/training/quiz/${m.id}'),
              ),
            ),
          const SizedBox(height: 16),
          Text('Режими тренування', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          const Card(
            child: ListTile(
              enabled: false,
              leading: Icon(Icons.timer),
              title: Text('Ідентифікація на час'),
              subtitle: Text('Буде доступно на етапі 4'),
            ),
          ),
          const Card(
            child: ListTile(
              enabled: false,
              leading: Icon(Icons.workspace_premium),
              title: Text('Підсумковий іспит'),
              subtitle: Text('Буде доступно на етапі 4'),
            ),
          ),
          const SizedBox(height: 16),
          Text('Теми з найбільшою кількістю помилок',
              style: theme.textTheme.titleMedium),
          if (mistakes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Поки що помилок немає.'),
            )
          else
            for (final e in mistakes.take(8))
              ListTile(
                dense: true,
                leading: const Icon(Icons.error_outline),
                title: Text(e.key),
                trailing: Text('${e.value}'),
              ),
        ],
      ),
    );
  }
}
