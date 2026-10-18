import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import '../modules/module_registry.dart';
import '../modules/modules_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = context.watch<ProgressService>();
    final available = modules.where((m) => m.available).toList();
    final passed = available
        .where((m) => (progress.bestScore(m.id) ?? 0) >= 80)
        .length;
    return Scaffold(
      appBar: AppBar(title: const Text('РЕР-Тренажер')),
      body: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Навчальний тренажер оператора РЕР',
                  style: theme.textTheme.headlineSmall),
              const SizedBox(height: 8),
              const Text(
                'Вчіться читати водоспад і спектрограму, розпізнавати сигнали '
                'БПЛА, відрізняти справжні сигнали від імітаційних і розуміти '
                'принципи пеленгування.',
              ),
              const SizedBox(height: 12),
              Card(
                color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.4),
                child: const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text('Лише навчання'),
                  subtitle: Text(
                    'Усі сигнали синтетичні й генеруються в застосунку. '
                    'Застосунок працює повністю офлайн і не взаємодіє з '
                    'реальним радіообладнанням.',
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: Text('Прогрес: тести здано $passed з ${available.length}',
                      style: theme.textTheme.titleMedium),
                ),
                FilledButton.icon(
                  onPressed: () => context.go('/simulator'),
                  icon: const Icon(Icons.waterfall_chart),
                  label: const Text('Симулятор'),
                ),
              ]),
              const SizedBox(height: 8),
              LinearProgressIndicator(
                value: available.isEmpty ? 0 : passed / available.length,
              ),
              const SizedBox(height: 16),
              for (final m in modules) ModuleCard(module: m),
            ],
          ),
        ),
      ),
    );
  }
}
