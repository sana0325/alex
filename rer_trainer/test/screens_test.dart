import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:rer_trainer/features/modules/module_registry.dart';
import 'package:rer_trainer/features/modules/module_screen.dart';
import 'package:rer_trainer/features/training/exam_screen.dart';
import 'package:rer_trainer/features/training/identification_screen.dart';
import 'package:rer_trainer/features/training/stats_screen.dart';
import 'package:rer_trainer/services/content_service.dart';
import 'package:rer_trainer/services/progress_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late ProgressService progress;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    progress = await ProgressService.load();
  });

  Widget wrap(Widget child) => MultiProvider(
        providers: [
          Provider(create: (_) => ContentService()),
          ChangeNotifierProvider.value(value: progress),
        ],
        child: MaterialApp(home: child),
      );

  for (final m in modules) {
    testWidgets('модуль «${m.title}» відкривається з уроком', (tester) async {
      expect(m.available, isTrue);
      await tester.pumpWidget(wrap(ModuleScreen(moduleId: m.id)));
      await tester.pumpAndSettle();
      expect(find.text('Урок'), findsOneWidget);
      expect(find.text('Тест'), findsOneWidget);
      expect(find.byType(TabBar), findsOneWidget);
    });
  }

  for (final size in const [Size(360, 740), Size(1280, 800)]) {
    for (final m in modules) {
      testWidgets('інтерактив «${m.interactiveTitle}» без помилок верстки (${size.width.round()} px)',
          (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(wrap(ModuleScreen(moduleId: m.id)));
        await tester.pump();
        await tester.tap(find.text(m.interactiveTitle!));
        for (var i = 0; i < 10; i++) {
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
        await tester.pump(const Duration(milliseconds: 200));
      });
    }
  }

  for (final size in const [Size(360, 740), Size(1280, 800)]) {
    testWidgets('ідентифікація (${size.width.round()} px)', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(wrap(const IdentificationScreen()));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Який це сигнал?'), findsOneWidget);
      await tester.tap(find.byType(OutlinedButton).first);
      await tester.pump();
      expect(find.text('Наступний'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    });
  }

  testWidgets('іспит збирає 20 питань', (tester) async {
    await tester.pumpWidget(wrap(const ExamScreen()));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 300)));
    await tester.pumpAndSettle();
    expect(find.text('Питання 1 з 20'), findsOneWidget);
  });

  testWidgets('статистика відкривається', (tester) async {
    await progress.recordIdent('LoRa (chirp)', false);
    await tester.pumpWidget(wrap(const StatsScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Ідентифікація: LoRa (chirp)'), findsOneWidget);
  });
}
