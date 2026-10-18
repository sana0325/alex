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
    final exam = progress.bestScore('exam');
    return Scaffold(
      appBar: AppBar(title: const Text('Тренування')),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              Text('Режими тренування', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.timer),
                  title: const Text('Ідентифікація на час'),
                  subtitle: const Text('10 випадкових водоспадів, 20 секунд на кожен'),
                  trailing: const Icon(Icons.play_arrow),
                  onTap: () => context.go('/training/ident'),
                ),
              ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.workspace_premium),
                  title: const Text('Підсумковий іспит'),
                  subtitle: Text(exam == null
                      ? '20 питань з усіх модулів'
                      : '20 питань з усіх модулів · найкращий результат: $exam %'),
                  trailing: const Icon(Icons.play_arrow),
                  onTap: () => context.go('/training/exam'),
                ),
              ),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.insights),
                  title: const Text('Статистика'),
                  subtitle: const Text('Результати та теми з найбільшою кількістю помилок'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.go('/training/stats'),
                ),
              ),
              const SizedBox(height: 16),
              Text('Тести модулів', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final m in modules.where((m) => m.quizAsset != null))
                Card(
                  child: ListTile(
                    leading: Icon(m.icon),
                    title: Text('${m.number}. ${m.title}'),
                    subtitle: Text(progress.bestScore(m.id) == null
                        ? 'Ще не пройдено'
                        : 'Найкращий результат: ${progress.bestScore(m.id)} % · спроб: ${progress.attempts(m.id)}'),
                    trailing: const Icon(Icons.play_arrow),
                    onTap: () => context.go('/training/quiz/${m.id}'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
