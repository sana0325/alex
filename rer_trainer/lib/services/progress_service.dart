import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Локальне збереження результатів тестів і помилок за темами.
class ProgressService extends ChangeNotifier {
  ProgressService._(this._prefs) {
    final raw = _prefs.getString(_key);
    if (raw != null) {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      _best.addAll((data['best'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
      _mistakes.addAll((data['mistakes'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
      _attempts.addAll((data['attempts'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
    }
  }

  static const _key = 'progress_v1';

  static Future<ProgressService> load() async =>
      ProgressService._(await SharedPreferences.getInstance());

  final SharedPreferences _prefs;
  final Map<String, int> _best = {};
  final Map<String, int> _mistakes = {};
  final Map<String, int> _attempts = {};

  /// Найкращий результат тесту модуля у відсотках або null.
  int? bestScore(String moduleId) => _best[moduleId];

  int attempts(String moduleId) => _attempts[moduleId] ?? 0;

  Map<String, int> get mistakesByTopic => Map.unmodifiable(_mistakes);

  Future<void> recordQuiz({
    required String moduleId,
    required int correct,
    required int total,
    required List<String> wrongTopics,
  }) async {
    final percent = total == 0 ? 0 : (correct * 100 / total).round();
    if (percent > (_best[moduleId] ?? -1)) _best[moduleId] = percent;
    _attempts[moduleId] = attempts(moduleId) + 1;
    for (final t in wrongTopics) {
      _mistakes[t] = (_mistakes[t] ?? 0) + 1;
    }
    notifyListeners();
    await _prefs.setString(
      _key,
      jsonEncode({'best': _best, 'mistakes': _mistakes, 'attempts': _attempts}),
    );
  }

  Future<void> reset() async {
    _best.clear();
    _mistakes.clear();
    _attempts.clear();
    notifyListeners();
    await _prefs.remove(_key);
  }
}
