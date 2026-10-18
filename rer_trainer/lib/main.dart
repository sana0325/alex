import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app/app.dart';
import 'services/content_service.dart';
import 'services/progress_service.dart';

Future<void> main() async {
  var started = false;
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    // Помилки побудови екранів показуємо текстом, а не сірим екраном.
    ErrorWidget.builder = (details) => _ErrorText(details.exceptionAsString());
    final progress = await ProgressService.load();
    runApp(MultiProvider(
      providers: [
        Provider(create: (_) => ContentService()),
        ChangeNotifierProvider.value(value: progress),
      ],
      child: const RerTrainerApp(),
    ));
    started = true;
  }, (error, stack) {
    debugPrint('Неперехоплена помилка: $error\n$stack');
    if (!started) _writeErrorLog('$error\n$stack');
    // Якщо застосунок не зміг стартувати — показати причину на екрані.
    if (started) return;
    runApp(MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: Scaffold(body: SafeArea(child: _ErrorText('$error\n\n$stack'))),
    ));
  });
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xFF200A0A),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Text(
            'Помилка РЕР-Тренажера. Зробіть скріншот і надішліть розробнику.\n\n$text',
            style: const TextStyle(color: Colors.white, fontSize: 13),
          ),
        ),
      );
}

/// Записує помилку запуску у тимчасову теку (rer_trainer_error.txt),
/// щоб її можна було прочитати навіть без вікна.
void _writeErrorLog(String text) {
  try {
    File('${Directory.systemTemp.path}${Platform.pathSeparator}rer_trainer_error.txt')
        .writeAsStringSync('${DateTime.now()}\n$text\n');
  } catch (_) {}
}
