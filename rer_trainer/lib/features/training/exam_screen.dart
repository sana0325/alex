import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/quiz.dart';
import '../../services/content_service.dart';
import '../modules/module_registry.dart';
import 'quiz_view.dart';

/// Підсумковий іспит: випадкові питання з тестів усіх модулів.
class ExamScreen extends StatefulWidget {
  const ExamScreen({super.key});

  static const int questionCount = 20;

  /// Випадкові [questionCount] питань з усіх тестів.
  static Quiz assemble(List<QuizQuestion> all, math.Random rnd) {
    final pool = List.of(all)..shuffle(rnd);
    return Quiz(title: 'Підсумковий іспит', questions: pool.take(questionCount).toList());
  }

  @override
  State<ExamScreen> createState() => _ExamScreenState();
}

class _ExamScreenState extends State<ExamScreen> {
  late Future<Quiz> _exam = _build();
  int _attempt = 0;

  Future<Quiz> _build() async {
    final content = context.read<ContentService>();
    final all = <QuizQuestion>[];
    for (final m in modules) {
      if (m.quizAsset != null) all.addAll((await content.quiz(m.quizAsset!)).questions);
    }
    return ExamScreen.assemble(all, math.Random());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Підсумковий іспит'),
          actions: [
            IconButton(
              tooltip: 'Нові питання',
              icon: const Icon(Icons.shuffle),
              onPressed: () => setState(() {
                _exam = _build();
                _attempt++;
              }),
            ),
          ],
        ),
        body: FutureBuilder<Quiz>(
          future: _exam,
          builder: (context, snap) {
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            return QuizView(key: ValueKey(_attempt), moduleId: 'exam', quiz: snap.data);
          },
        ),
      );
}
