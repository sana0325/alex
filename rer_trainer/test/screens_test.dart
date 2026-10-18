import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rer_trainer/features/waterfall_lab/simulator_model.dart';
import 'package:provider/provider.dart';
import 'package:rer_trainer/features/modules/module_registry.dart';
import 'package:rer_trainer/models/quiz.dart';
import 'package:rer_trainer/features/modules/module_screen.dart';
import 'package:rer_trainer/features/direction_finding/distance_calculator.dart';
import 'package:rer_trainer/features/training/exam_screen.dart';
import 'package:rer_trainer/features/uav/compare_screen.dart';
import 'package:rer_trainer/features/uav/uav_card.dart';
import 'package:rer_trainer/features/uav/uav_profile.dart';
import 'package:rer_trainer/features/training/identification_screen.dart';
import 'package:rer_trainer/features/training/stats_screen.dart';
import 'package:rer_trainer/services/content_service.dart';
import 'package:rer_trainer/services/progress_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  SimulatorModel.engineEnabled = false;
  late ProgressService progress;
  late UavRepository repo;
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    repo = await UavRepository.load();
  });
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
    for (final level in IdentLevel.values) {
      testWidgets('ідентифікація: ${level.name} (${size.width.round()} px)', (tester) async {
        tester.view.physicalSize = size;
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(wrap(const IdentificationScreen()));
        await tester.runAsync(() => Future<void>.delayed(Duration.zero));
        await tester.pump();
        await tester.ensureVisible(find.text(level.title));
        await tester.pump();
        await tester.tap(find.text(level.title));
        await tester.pump(const Duration(milliseconds: 300));
        expect(find.textContaining('Раунд 1'), findsOneWidget);
        await tester.tap(find.byType(OutlinedButton).first);
        await tester.pump();
        expect(find.text('Наступний'), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      });
    }
  }

  testWidgets('картки всіх бортів відкриваються без помилок верстки', (tester) async {
    addTearDown(tester.view.reset);
    for (final size in const [Size(360, 740), Size(1280, 800)]) {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      for (final p in repo.profiles) {
        await tester.pumpWidget(wrap(UavCardScreen(repo: repo, profile: p)));
        await tester.pump(const Duration(milliseconds: 100));
        for (var i = 0; i < p.iq.length; i++) {
          await tester.pumpWidget(wrap(UavCardScreen(repo: repo, profile: p, initialIq: i)));
          await tester.pump(const Duration(milliseconds: 100));
        }
        expect(tester.takeException(), isNull, reason: '${p.id} @ ${size.width}');
      }
    }
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('порівняння і калькулятор відстані', (tester) async {
    await tester.pumpWidget(wrap(CompareScreen(repo: repo, ids: const ['supercam', 'supercam_m', 'albatros'])));
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(wrap(const Scaffold(body: DistanceCalculator())));
    await tester.pump();
    expect(find.textContaining('ДУЖЕ ПРИБЛИЗНО'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  test('іспит збирає 20 питань з усіх модулів', () {
    final all = [
      for (final m in modules)
        ...Quiz.fromJson(jsonDecode(File(m.quizAsset!).readAsStringSync()) as Map<String, dynamic>).questions,
    ];
    expect(all.length, greaterThan(80));
    final exam = ExamScreen.assemble(all, math.Random(1));
    expect(exam.questions.length, ExamScreen.questionCount);
    expect(exam.questions.toSet().length, ExamScreen.questionCount);
  });

  testWidgets('статистика відкривається', (tester) async {
    await progress.recordIdent('LoRa (chirp)', false);
    await tester.pumpWidget(wrap(const StatsScreen()));
    await tester.pumpAndSettle();
    expect(find.text('Ідентифікація: LoRa (chirp)'), findsOneWidget);
  });
}
