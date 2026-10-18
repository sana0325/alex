import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Локальне збереження результатів тестів і помилок за темами.
class ProgressService extends ChangeNotifier {
  ProgressService._(this._prefs) {
    final raw = _prefs?.getString(_key);
    if (raw != null) {
      try {
        _parse(raw);
      } catch (_) {
        // Пошкоджений прогрес не повинен заважати запуску.
        _best.clear();
        _mistakes.clear();
        _attempts.clear();
      }
    }
  }

  void _parse(String raw) {
    {
      final data = jsonDecode(raw) as Map<String, dynamic>;
      _best.addAll((data['best'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
      _mistakes.addAll((data['mistakes'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
      _attempts.addAll((data['attempts'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
      _identTotal.addAll((data['identTotal'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
      _identCorrect.addAll((data['identCorrect'] as Map<String, dynamic>? ?? {})
          .map((k, v) => MapEntry(k, (v as num).toInt())));
    }
  }

  static const _key = 'progress_v1';

  /// Якщо сховище недоступне, застосунок працює без збереження прогресу.
  static Future<ProgressService> load() async {
    SharedPreferences? prefs;
    try {
      prefs = await SharedPreferences.getInstance();
    } catch (e) {
      debugPrint('Сховище прогресу недоступне: $e');
    }
    return ProgressService._(prefs);
  }

  final SharedPreferences? _prefs;
  final Map<String, int> _best = {};
  final Map<String, int> _mistakes = {};
  final Map<String, int> _attempts = {};
  final Map<String, int> _identTotal = {};
  final Map<String, int> _identCorrect = {};

  /// Найкращий результат тесту модуля у відсотках або null.
  int? bestScore(String moduleId) => _best[moduleId];

  int attempts(String moduleId) => _attempts[moduleId] ?? 0;

  Map<String, int> get mistakesByTopic => Map.unmodifiable(_mistakes);

  /// Статистика режиму «Ідентифікація»: тип сигналу → (правильно, усього).
  Map<String, (int, int)> get identStats => {
        for (final e in _identTotal.entries)
          e.key: (_identCorrect[e.key] ?? 0, e.value),
      };

  Future<void> recordIdent(String signalTitle, bool correct) async {
    _identTotal[signalTitle] = (_identTotal[signalTitle] ?? 0) + 1;
    if (correct) {
      _identCorrect[signalTitle] = (_identCorrect[signalTitle] ?? 0) + 1;
    } else {
      _mistakes['Ідентифікація: $signalTitle'] =
          (_mistakes['Ідентифікація: $signalTitle'] ?? 0) + 1;
    }
    notifyListeners();
    await _save();
  }

  Future<void> recordMistakes(List<String> topics) async {
    for (final t in topics) {
      _mistakes[t] = (_mistakes[t] ?? 0) + 1;
    }
    notifyListeners();
    await _save();
  }

  Future<void> _save() async {
    try {
      await _prefs?.setString(
        _key,
        jsonEncode({
          'best': _best,
          'mistakes': _mistakes,
          'attempts': _attempts,
          'identTotal': _identTotal,
          'identCorrect': _identCorrect,
        }),
      );
    } catch (e) {
      debugPrint('Не вдалося зберегти прогрес: $e');
    }
  }

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
    await _save();
  }

  Future<void> reset() async {
    _best.clear();
    _mistakes.clear();
    _attempts.clear();
    _identTotal.clear();
    _identCorrect.clear();
    notifyListeners();
    try {
      await _prefs?.remove(_key);
    } catch (_) {}
  }
}
