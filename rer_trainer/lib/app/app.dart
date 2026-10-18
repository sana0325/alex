import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'router.dart';
import 'theme.dart';

class RerTrainerApp extends StatefulWidget {
  const RerTrainerApp({super.key});

  @override
  State<RerTrainerApp> createState() => _RerTrainerAppState();
}

class _RerTrainerAppState extends State<RerTrainerApp> {
  final GoRouter _router = buildRouter();

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp.router(
        title: 'РЕР-Тренажер',
        debugShowCheckedModeBanner: false,
        theme: buildDarkTheme(),
        darkTheme: buildDarkTheme(),
        themeMode: ThemeMode.dark,
        routerConfig: _router,
      );
}
