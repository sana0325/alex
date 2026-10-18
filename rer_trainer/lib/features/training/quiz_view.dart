import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/quiz.dart';
import '../../services/content_service.dart';
import '../../services/progress_service.dart';

/// Проходження тесту: питання по одному, пояснення після відповіді,
/// підсумок і збереження результату.
class QuizView extends StatefulWidget {
  const QuizView({super.key, required this.moduleId, this.asset, this.quiz})
      : assert(asset != null || quiz != null);

  final String moduleId;

  /// Шлях до JSON-тесту в assets або готовий набір питань [quiz].
  final String? asset;
  final Quiz? quiz;

  @override
  State<QuizView> createState() => _QuizViewState();
}

class _QuizViewState extends State<QuizView> {
  late final Future<Quiz> _quiz = widget.quiz != null
      ? Future.value(widget.quiz!)
      : context.read<ContentService>().quiz(widget.asset!);

  int _index = 0;
  int? _selected;
  int _correct = 0;
  final List<String> _wrongTopics = [];
  bool _finished = false;

  void _answer(Quiz quiz, int option) {
    if (_selected != null) return;
    final q = quiz.questions[_index];
    setState(() {
      _selected = option;
      if (option == q.answer) {
        _correct++;
      } else {
        _wrongTopics.add(q.topic);
      }
    });
  }

  void _next(Quiz quiz) {
    if (_index + 1 < quiz.questions.length) {
      setState(() {
        _index++;
        _selected = null;
      });
      return;
    }
    setState(() => _finished = true);
    context.read<ProgressService>().recordQuiz(
          moduleId: widget.moduleId,
          correct: _correct,
          total: quiz.questions.length,
          wrongTopics: _wrongTopics,
        );
  }

  void _restart() => setState(() {
        _index = 0;
        _selected = null;
        _correct = 0;
        _wrongTopics.clear();
        _finished = false;
      });

  @override
  Widget build(BuildContext context) => FutureBuilder<Quiz>(
        future: _quiz,
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(child: Text('Не вдалося відкрити тест: ${snap.error}'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final quiz = snap.data!;
          return Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 760),
              child: _finished ? _summary(quiz) : _question(quiz),
            ),
          );
        },
      );

  Widget _question(Quiz quiz) {
    final q = quiz.questions[_index];
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LinearProgressIndicator(value: (_index + 1) / quiz.questions.length),
        const SizedBox(height: 8),
        Text('Питання ${_index + 1} з ${quiz.questions.length}',
            style: theme.textTheme.labelLarge),
        const SizedBox(height: 12),
        Text(q.question, style: theme.textTheme.titleMedium),
        const SizedBox(height: 12),
        for (var i = 0; i < q.options.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: _OptionTile(
              text: q.options[i],
              state: _selected == null
                  ? _OptionState.idle
                  : i == q.answer
                      ? _OptionState.correct
                      : i == _selected
                          ? _OptionState.wrong
                          : _OptionState.idle,
              onTap: () => _answer(quiz, i),
            ),
          ),
        if (_selected != null) ...[
          const SizedBox(height: 8),
          Card(
            color: (_selected == q.answer ? scheme.primaryContainer : scheme.errorContainer)
                .withValues(alpha: 0.5),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_selected == q.answer ? 'Правильно' : 'Неправильно',
                      style: theme.textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Text(q.explanation),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton.icon(
              onPressed: () => _next(quiz),
              icon: const Icon(Icons.arrow_forward),
              label: Text(_index + 1 < quiz.questions.length
                  ? 'Далі'
                  : 'Завершити'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _summary(Quiz quiz) {
    final total = quiz.questions.length;
    final percent = (_correct * 100 / total).round();
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Icon(percent >= 80 ? Icons.emoji_events : Icons.school,
            size: 64, color: theme.colorScheme.primary),
        const SizedBox(height: 12),
        Text('Результат: $_correct з $total ($percent %)',
            textAlign: TextAlign.center, style: theme.textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(
          percent >= 80
              ? 'Тему засвоєно. Можна переходити далі.'
              : 'Варто повторити урок і пройти тест ще раз.',
          textAlign: TextAlign.center,
        ),
        if (_wrongTopics.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text('Теми з помилками:', style: theme.textTheme.titleSmall),
          for (final t in _wrongTopics.toSet())
            ListTile(dense: true, leading: const Icon(Icons.error_outline), title: Text(t)),
        ],
        const SizedBox(height: 16),
        Center(
          child: OutlinedButton.icon(
            onPressed: _restart,
            icon: const Icon(Icons.replay),
            label: const Text('Пройти ще раз'),
          ),
        ),
      ],
    );
  }
}

enum _OptionState { idle, correct, wrong }

class _OptionTile extends StatelessWidget {
  const _OptionTile({required this.text, required this.state, required this.onTap});

  final String text;
  final _OptionState state;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (border, icon) = switch (state) {
      _OptionState.correct => (scheme.primary, Icons.check_circle),
      _OptionState.wrong => (scheme.error, Icons.cancel),
      _OptionState.idle => (scheme.outlineVariant, Icons.radio_button_unchecked),
    };
    return Material(
      color: scheme.surfaceContainer,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: border, width: state == _OptionState.idle ? 1 : 2),
        borderRadius: BorderRadius.circular(10),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Icon(icon, color: border),
            const SizedBox(width: 10),
            Expanded(child: Text(text)),
          ]),
        ),
      ),
    );
  }
}
