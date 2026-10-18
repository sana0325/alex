import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Озвучка українською через системний синтез мови Android (офлайн).
/// На Windows, Linux і в браузері голосу немає — урок іде із субтитрами.
/// Без сторонніх нативних модулів: на Windows вони спричиняли аварійний
/// старт програми.
class Narrator {
  Narrator._(this.available, this.note);

  static const _channel = MethodChannel('rer/tts');

  final bool available;

  /// Пояснення для користувача, чому немає голосу.
  final String? note;

  /// Вимикає синтез мови (для тестів інтерфейсу).
  static bool enabled = true;

  static Future<Narrator> create() async {
    if (!enabled) return Narrator._(false, null);
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) {
      return Narrator._(false, 'Озвучка доступна в Android-версії. Тут урок іде із субтитрами.');
    }
    try {
      final ok = await _channel.invokeMethod<bool>('init').timeout(const Duration(seconds: 6)) ?? false;
      if (ok) return Narrator._(true, null);
      return Narrator._(false,
          'Український голос не встановлено. Додайте його в налаштуваннях телефона: '
          'Система → Мова → Синтез мовлення → Google → Українська.');
    } catch (e) {
      debugPrint('Синтез мови недоступний: $e');
      return Narrator._(false, 'Озвучка на цьому пристрої недоступна — показуємо субтитри.');
    }
  }

  /// Говорить [text] і завершується, коли фразу дочитано.
  Future<void> speak(String text) async {
    if (!available) return;
    try {
      await _channel.invokeMethod<void>('speak', {'text': text});
    } catch (e) {
      debugPrint('Помилка озвучки: $e');
    }
  }

  Future<void> stop() async {
    if (!available) return;
    try {
      await _channel.invokeMethod<void>('stop');
    } catch (_) {}
  }
}
