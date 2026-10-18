import 'package:flutter/material.dart';

import '../atlas/atlas_browser.dart';
import '../direction_finding/df_lab.dart';
import '../mesh/mesh_lab.dart';
import '../radio_basics/radio_calculator.dart';
import '../real_or_fake/fake_trainer.dart';
import '../waterfall_lab/waterfall_simulator.dart';

/// Поточний етап розробки: модулі з більшим номером етапу показуються
/// як «у розробці».
const int kCurrentStage = 4;

class ModuleInfo {
  const ModuleInfo({
    required this.id,
    required this.number,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.stage,
    this.lessonAsset,
    this.quizAsset,
    this.interactiveTitle,
    this.interactive,
  });

  final String id;
  final int number;
  final String title;
  final String subtitle;
  final IconData icon;

  /// Етап, на якому модуль стає доступним.
  final int stage;
  final String? lessonAsset;
  final String? quizAsset;
  final String? interactiveTitle;
  final WidgetBuilder? interactive;

  bool get available => stage <= kCurrentStage;
}

final List<ModuleInfo> modules = [
  ModuleInfo(
    id: 'radio_basics',
    number: 1,
    title: 'Основи радіо',
    subtitle: 'Частота, dBm, SNR, діапазони БПЛА, модуляції',
    icon: Icons.settings_input_antenna,
    stage: 1,
    lessonAsset: 'assets/lessons/01_radio_basics.md',
    quizAsset: 'assets/quizzes/radio_basics.json',
    interactiveTitle: 'Калькулятор',
    interactive: (_) => const RadioCalculator(),
  ),
  ModuleInfo(
    id: 'waterfall',
    number: 2,
    title: 'Водоспад і спектрограма',
    subtitle: 'Як читати картинку та що на неї впливає',
    icon: Icons.waterfall_chart,
    stage: 1,
    lessonAsset: 'assets/lessons/02_waterfall.md',
    quizAsset: 'assets/quizzes/waterfall.json',
    interactiveTitle: 'Симулятор',
    interactive: (_) => const WaterfallSimulator(),
  ),
  ModuleInfo(
    id: 'atlas',
    number: 3,
    title: 'Атлас сигналів',
    subtitle: 'FPV, OFDM, FHSS, LoRa, телеметрія, завади',
    icon: Icons.collections_bookmark,
    stage: 2,
    lessonAsset: 'assets/lessons/03_atlas.md',
    quizAsset: 'assets/quizzes/atlas.json',
    interactiveTitle: 'Атлас',
    interactive: (_) => const AtlasBrowser(),
  ),
  ModuleInfo(
    id: 'mesh',
    number: 4,
    title: 'Mesh-мережі БПЛА',
    subtitle: 'MANET, TDMA-слоти, перебудова маршрутів',
    icon: Icons.hub,
    stage: 2,
    lessonAsset: 'assets/lessons/04_mesh.md',
    quizAsset: 'assets/quizzes/mesh.json',
    interactiveTitle: 'Схема',
    interactive: (_) => const MeshLab(),
  ),
  ModuleInfo(
    id: 'real_or_fake',
    number: 5,
    title: 'Справжній сигнал чи фейк',
    subtitle: 'Імітатори, replay, ознаки підробки',
    icon: Icons.policy,
    stage: 3,
    lessonAsset: 'assets/lessons/05_real_or_fake.md',
    quizAsset: 'assets/quizzes/real_or_fake.json',
    interactiveTitle: 'Знайди фейк',
    interactive: (_) => const FakeTrainer(),
  ),
  ModuleInfo(
    id: 'direction_finding',
    number: 6,
    title: 'Пеленгування та триангуляція',
    subtitle: 'AoA, RSSI, TDOA, еліпс похибки',
    icon: Icons.explore,
    stage: 3,
    lessonAsset: 'assets/lessons/06_direction_finding.md',
    quizAsset: 'assets/quizzes/direction_finding.json',
    interactiveTitle: 'Карта',
    interactive: (_) => const DirectionFindingLab(),
  ),
];

ModuleInfo? moduleById(String id) {
  for (final m in modules) {
    if (m.id == id) return m;
  }
  return null;
}
