import 'package:flutter/material.dart';

/// Темна тема в стилі SDR-софту.
ThemeData buildDarkTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: const Color(0xFF2EE6B6),
    brightness: Brightness.dark,
  ).copyWith(
    surface: const Color(0xFF0E1214),
    surfaceContainerLowest: const Color(0xFF080B0C),
    surfaceContainerLow: const Color(0xFF12171A),
    surfaceContainer: const Color(0xFF161C1F),
    surfaceContainerHigh: const Color(0xFF1C2327),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    visualDensity: VisualDensity.standard,
    cardTheme: CardThemeData(
      color: scheme.surfaceContainer,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}
