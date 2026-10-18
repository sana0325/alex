import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

/// Озвучка українською через системний синтез мови (офлайн).
/// Якщо українського голосу немає, [available] = false — урок іде із
/// субтитрами без звуку.
class Narrator {
  Narrator._(this._tts, this.available, this.note);

  final FlutterTts? _tts;
  final bool available;

  /// Пояснення для користувача, чому немає голосу.
  final String? note;

  /// Вимикає синтез мови (для тестів інтерфейсу).
  static bool enabled = true;

  static Future<Narrator> create() async {
    if (!enabled) return Narrator._(null, false, null);
    try {
      return await _create().timeout(const Duration(seconds: 5));
    } catch (e) {
      debugPrint('Синтез мови недоступний: $e');
      return Narrator._(null, false, 'Озвучка на цьому пристрої недоступна — показуємо субтитри.');
    }
  }

  static Future<Narrator> _create() async {
    {
      final tts = FlutterTts();
      await tts.awaitSpeakCompletion(true);
      final langs = (await tts.getLanguages as List<dynamic>? ?? const [])
          .map((l) => l.toString())
          .toList();
      final uk = langs.firstWhere(
        (l) => l.toLowerCase().startsWith('uk'),
        orElse: () => '',
      );
      if (uk.isEmpty) {
        return Narrator._(tts, false,
            'Український голос не встановлено. Додайте його в налаштуваннях телефона: '
            'Система → Мова → Синтез мовлення → Google → Українська.');
      }
      await tts.setLanguage(uk);
      await tts.setSpeechRate(defaultTargetPlatform == TargetPlatform.android ? 0.48 : 0.9);
      await tts.setPitch(1.0);
      return Narrator._(tts, true, null);
    }
  }

  /// Говорить [text] і завершується, коли фразу дочитано.
  Future<void> speak(String text) async {
    final tts = _tts;
    if (!available || tts == null) return;
    try {
      await tts.speak(text);
    } catch (e) {
      debugPrint('Помилка озвучки: $e');
    }
  }

  Future<void> stop() async {
    try {
      await _tts?.stop();
    } catch (_) {}
  }
}
