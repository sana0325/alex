import 'package:flutter/material.dart';

import '../modules/module_registry.dart';
import 'quiz_view.dart';

class QuizScreen extends StatelessWidget {
  const QuizScreen({super.key, required this.moduleId});

  final String moduleId;

  @override
  Widget build(BuildContext context) {
    final module = moduleById(moduleId);
    final asset = module?.quizAsset;
    return Scaffold(
      appBar: AppBar(title: Text('Тест: ${module?.title ?? ''}')),
      body: asset == null || !module!.available
          ? const Center(child: Text('Тест ще недоступний'))
          : QuizView(moduleId: moduleId, asset: asset),
    );
  }
}
