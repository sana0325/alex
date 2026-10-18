import 'dart:io';

/// Записує помилку запуску у тимчасову теку (rer_trainer_error.txt).
void writeErrorLog(String text) {
  try {
    File('${Directory.systemTemp.path}${Platform.pathSeparator}rer_trainer_error.txt').writeAsStringSync(text);
  } catch (_) {}
}
