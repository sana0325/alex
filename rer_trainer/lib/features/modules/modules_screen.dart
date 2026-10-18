import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import 'module_registry.dart';

class ModulesScreen extends StatelessWidget {
  const ModulesScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Навчальні модулі')),
        body: ListView(
          padding: const EdgeInsets.all(12),
          children: [for (final m in modules) ModuleCard(module: m)],
        ),
      );
}

class ModuleCard extends StatelessWidget {
  const ModuleCard({super.key, required this.module});

  final ModuleInfo module;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final best = context.watch<ProgressService>().bestScore(module.id);
    final trailing = !module.available
        ? Chip(label: Text('Етап ${module.stage}'))
        : best != null
            ? Text('$best %',
                style: TextStyle(
                    color: best >= 80 ? scheme.primary : scheme.tertiary,
                    fontWeight: FontWeight.bold))
            : const Icon(Icons.chevron_right);
    return Card(
      child: ListTile(
        enabled: module.available,
        leading: CircleAvatar(
          backgroundColor: scheme.primaryContainer,
          foregroundColor: scheme.onPrimaryContainer,
          child: Icon(module.icon),
        ),
        title: Text('${module.number}. ${module.title}'),
        subtitle: Text(module.available
            ? module.subtitle
            : '${module.subtitle}\nБуде доступно на етапі ${module.stage}'),
        trailing: trailing,
        onTap: module.available
            ? () => context.go('/modules/${module.id}')
            : null,
      ),
    );
  }
}
