import 'dart:typed_data';
import 'dart:ui';

/// Кольорові палітри водоспаду. Кожна перетворюється на таблицю з 256
/// кольорів у форматі RGBA (little-endian Uint32).
enum WaterfallPalette { classic, hot, gray, viridis }

extension WaterfallPaletteInfo on WaterfallPalette {
  String get title => switch (this) {
        WaterfallPalette.classic => 'Класична (SDR)',
        WaterfallPalette.hot => 'Гаряча',
        WaterfallPalette.gray => 'Сіра',
        WaterfallPalette.viridis => 'Viridis',
      };

  List<Color> get stops => switch (this) {
        WaterfallPalette.classic => const [
            Color(0xFF000008),
            Color(0xFF0A1A8C),
            Color(0xFF00A0E0),
            Color(0xFF30E070),
            Color(0xFFF0E020),
            Color(0xFFF03010),
            Color(0xFFFFFFFF),
          ],
        WaterfallPalette.hot => const [
            Color(0xFF000000),
            Color(0xFF600000),
            Color(0xFFE02000),
            Color(0xFFFFB000),
            Color(0xFFFFFFC0),
          ],
        WaterfallPalette.gray => const [
            Color(0xFF000000),
            Color(0xFFFFFFFF),
          ],
        WaterfallPalette.viridis => const [
            Color(0xFF440154),
            Color(0xFF3B528B),
            Color(0xFF21908C),
            Color(0xFF5DC963),
            Color(0xFFFDE725),
          ],
      };

  Uint32List buildLut() {
    final lut = Uint32List(256);
    final s = stops;
    for (var i = 0; i < 256; i++) {
      final pos = i / 255 * (s.length - 1);
      final k = pos.floor().clamp(0, s.length - 2);
      final c = Color.lerp(s[k], s[k + 1], pos - k)!;
      final r = (c.r * 255).round();
      final g = (c.g * 255).round();
      final b = (c.b * 255).round();
      lut[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }
    return lut;
  }

  /// Колір для легенди/спектра в позиції [t] ∈ [0, 1].
  Color colorAt(double t) {
    final s = stops;
    final pos = t.clamp(0.0, 1.0) * (s.length - 1);
    final k = pos.floor().clamp(0, s.length - 2);
    return Color.lerp(s[k], s[k + 1], pos - k)!;
  }
}
