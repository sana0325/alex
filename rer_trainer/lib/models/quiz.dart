/// Тест модуля, що завантажується з assets/quizzes/*.json.
class Quiz {
  const Quiz({required this.title, required this.questions});

  factory Quiz.fromJson(Map<String, dynamic> json) => Quiz(
        title: json['title'] as String,
        questions: [
          for (final q in json['questions'] as List<dynamic>)
            QuizQuestion.fromJson(q as Map<String, dynamic>),
        ],
      );

  final String title;
  final List<QuizQuestion> questions;
}

class QuizQuestion {
  const QuizQuestion({
    required this.question,
    required this.options,
    required this.answer,
    required this.explanation,
    required this.topic,
  });

  factory QuizQuestion.fromJson(Map<String, dynamic> json) => QuizQuestion(
        question: json['q'] as String,
        options: [for (final o in json['options'] as List<dynamic>) o as String],
        answer: json['answer'] as int,
        explanation: json['explain'] as String,
        topic: json['topic'] as String? ?? 'Загальне',
      );

  final String question;
  final List<String> options;

  /// Індекс правильного варіанта.
  final int answer;
  final String explanation;

  /// Тема для статистики помилок.
  final String topic;
}
