import 'package:flutter/material.dart';

import '../../widgets/lesson_view.dart';
import '../training/quiz_view.dart';
import '../video_lesson/video_lesson.dart';
import 'module_registry.dart';

/// Сторінка модуля: вкладки «Урок», інтерактив і «Тест».
class ModuleScreen extends StatelessWidget {
  const ModuleScreen({super.key, required this.moduleId});

  final String moduleId;

  @override
  Widget build(BuildContext context) {
    final module = moduleById(moduleId);
    if (module == null || !module.available) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Модуль ще недоступний')),
      );
    }
    final tabs = <(Tab, Widget)>[
      if (module.videoAsset != null)
        (
          const Tab(icon: Icon(Icons.smart_display_outlined), text: 'Відеоурок'),
          VideoLessonPlayer(asset: module.videoAsset!),
        ),
      if (module.lessonAsset != null)
        (
          const Tab(icon: Icon(Icons.article_outlined), text: 'Урок'),
          LessonView(asset: module.lessonAsset!),
        ),
      if (module.interactive != null)
        (
          Tab(
              icon: const Icon(Icons.touch_app_outlined),
              text: module.interactiveTitle ?? 'Практика'),
          Builder(builder: module.interactive!),
        ),
      if (module.quizAsset != null)
        (
          const Tab(icon: Icon(Icons.quiz_outlined), text: 'Тест'),
          QuizView(moduleId: module.id, asset: module.quizAsset!),
        ),
    ];
    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        appBar: AppBar(
          title: Text('${module.number}. ${module.title}'),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [for (final t in tabs) t.$1],
          ),
        ),
        body: TabBarView(
          physics: const NeverScrollableScrollPhysics(),
          children: [for (final t in tabs) t.$2],
        ),
      ),
    );
  }
}
