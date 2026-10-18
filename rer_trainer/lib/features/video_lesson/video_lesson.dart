import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../signal_engine/signal_engine.dart';
import '../../widgets/live_waterfall.dart';
import '../uav/iq_slots_view.dart';
import '../uav/uav_profile.dart';
import 'narrator.dart';

/// Кадр відеоуроку.
class LessonScene {
  const LessonScene(this.data);

  final Map<String, dynamic> data;

  String get type => data['type'] as String;
  String get say => data['say'] as String? ?? '';
  String? get title => data['title'] as String?;
  String? get subtitle => data['subtitle'] as String?;
  String? get caption => data['caption'] as String?;
  List<String> get items => [for (final i in data['items'] as List<dynamic>? ?? const []) i as String];

  /// Тривалість без озвучки: ~0,42 с на слово, щонайменше 5 с.
  Duration get silentDuration =>
      Duration(milliseconds: math.max(5000, say.split(RegExp(r'\s+')).length * 420));
}

class VideoLessonData {
  const VideoLessonData(this.title, this.scenes);

  final String title;
  final List<LessonScene> scenes;

  static Future<VideoLessonData> load(AssetBundle bundle, String asset) async {
    final j = jsonDecode(await bundle.loadString(asset, cache: false)) as Map<String, dynamic>;
    return VideoLessonData(j['title'] as String, [
      for (final s in j['scenes'] as List<dynamic>) LessonScene(s as Map<String, dynamic>),
    ]);
  }
}

/// Плеєр відеоуроку: кадри з анімацією та живими водоспадами, озвучка
/// українською, субтитри, автоперехід між кадрами.
class VideoLessonPlayer extends StatefulWidget {
  const VideoLessonPlayer({super.key, required this.asset});

  final String asset;

  @override
  State<VideoLessonPlayer> createState() => _VideoLessonPlayerState();
}

class _VideoLessonPlayerState extends State<VideoLessonPlayer> {
  VideoLessonData? _lesson;
  Narrator? _narrator;
  int _index = 0;
  bool _playing = false;
  bool _voice = true;
  int _token = 0;
  Timer? _timer;
  final Stopwatch _sceneClock = Stopwatch();
  Object? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final lesson = await VideoLessonData.load(DefaultAssetBundle.of(context), widget.asset);
      if (!mounted) return;
      setState(() => _lesson = lesson);
    } catch (e) {
      if (mounted) setState(() => _error = e);
      return;
    }
    // Голос підключається окремо — урок доступний одразу.
    final narrator = await Narrator.create();
    if (mounted) setState(() => _narrator = narrator);
  }

  @override
  void dispose() {
    _token++;
    _timer?.cancel();
    _narrator?.stop();
    super.dispose();
  }

  Future<void> _playScene() async {
    final lesson = _lesson!;
    final token = ++_token;
    _timer?.cancel();
    _sceneClock
      ..reset()
      ..start();
    final scene = lesson.scenes[_index];
    final narrator = _narrator;
    if (_voice && narrator != null && narrator.available) {
      await narrator.speak(scene.say);
      // Невелика пауза, щоб глядач встиг роздивитися кадр.
      await Future<void>.delayed(const Duration(milliseconds: 900));
    } else {
      await Future<void>.delayed(scene.silentDuration);
    }
    if (!mounted || token != _token || !_playing) return;
    if (_index + 1 < lesson.scenes.length) {
      setState(() => _index++);
      unawaited(_playScene());
    } else {
      setState(() => _playing = false);
    }
  }

  void _play() {
    setState(() => _playing = true);
    unawaited(_playScene());
  }

  void _pause() {
    _token++;
    _narrator?.stop();
    setState(() => _playing = false);
  }

  void _goto(int i) {
    final lesson = _lesson!;
    _token++;
    _narrator?.stop();
    setState(() => _index = i.clamp(0, lesson.scenes.length - 1));
    if (_playing) unawaited(_playScene());
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text('Не вдалося відкрити відеоурок: $_error'));
    final lesson = _lesson;
    if (lesson == null) return const Center(child: CircularProgressIndicator());
    final narrator = _narrator;
    final scene = lesson.scenes[_index];
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1000),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: AspectRatio(
                aspectRatio: MediaQuery.sizeOf(context).width < 600 ? 4 / 3 : 16 / 10,
                child: Stack(children: [
                  const Positioned.fill(child: _StageBackground()),
                  Positioned.fill(
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 600),
                      transitionBuilder: (child, a) => FadeTransition(
                        opacity: a,
                        child: SlideTransition(
                          position: Tween(begin: const Offset(0.04, 0), end: Offset.zero).animate(a),
                          child: child,
                        ),
                      ),
                      child: KeyedSubtree(key: ValueKey(_index), child: _visual(scene)),
                    ),
                  ),
                  Positioned(
                    left: 10,
                    top: 8,
                    child: _Chip('${lesson.title} · ${_index + 1}/${lesson.scenes.length}'),
                  ),
                  if (scene.say.isNotEmpty)
                    Positioned(
                      left: 12,
                      right: 12,
                      bottom: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.72),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          scene.say,
                          maxLines: 4,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.3),
                        ),
                      ),
                    ),
                ]),
              ),
            ),
            const SizedBox(height: 10),
            Row(children: [
              for (var i = 0; i < lesson.scenes.length; i++)
                Expanded(
                  child: GestureDetector(
                    onTap: () => _goto(i),
                    child: Container(
                      height: 6,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        color: i < _index
                            ? scheme.primary
                            : i == _index
                                ? scheme.primary.withValues(alpha: 0.6)
                                : scheme.outlineVariant,
                        borderRadius: BorderRadius.circular(3),
                      ),
                    ),
                  ),
                ),
            ]),
            const SizedBox(height: 8),
            Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, spacing: 4, children: [
              IconButton(
                tooltip: 'Попередній кадр',
                icon: const Icon(Icons.skip_previous),
                onPressed: _index > 0 ? () => _goto(_index - 1) : null,
              ),
              FilledButton.icon(
                onPressed: _playing ? _pause : _play,
                icon: Icon(_playing ? Icons.pause : Icons.play_arrow),
                label: Text(_playing ? 'Пауза' : (_index == 0 ? 'Дивитися' : 'Продовжити')),
              ),
              IconButton(
                tooltip: 'Наступний кадр',
                icon: const Icon(Icons.skip_next),
                onPressed: _index + 1 < lesson.scenes.length ? () => _goto(_index + 1) : null,
              ),
              IconButton(
                tooltip: _voice ? 'Вимкнути голос' : 'Увімкнути голос',
                icon: Icon(_voice ? Icons.volume_up : Icons.volume_off),
                onPressed: () {
                  if (_voice) _narrator?.stop();
                  setState(() => _voice = !_voice);
                },
              ),
            ]),
            if (narrator == null)
              Text('Підключення голосу…', textAlign: TextAlign.center, style: text.bodySmall)
            else if (!narrator.available && narrator.note != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(narrator.note!, textAlign: TextAlign.center, style: text.bodySmall),
              ),
          ],
        ),
      ),
    );
  }

  Widget _visual(LessonScene s) {
    switch (s.type) {
      case 'title':
        return _TitleCard(title: s.title ?? '', subtitle: s.subtitle);
      case 'bullets':
        return _Bullets(title: s.title ?? '', items: s.items);
      case 'kind':
        return _Framed(
          caption: s.caption,
          child: LiveWaterfall(
            scene: sceneFor(SignalKind.values.byName(s.data['kind'] as String)),
            spectrumHeight: 36,
          ),
        );
      case 'preset':
        final scene = bandPresets()[(s.data['index'] as num).toInt()].scene;
        return _Framed(caption: s.caption, child: LiveWaterfall(scene: scene, spectrumHeight: 36));
      case 'uav':
        return _Framed(
          caption: s.caption,
          child: _UavView(id: s.data['profile'] as String, index: (s.data['view'] as num? ?? 0).toInt()),
        );
      case 'iq':
        return _Framed(
          caption: s.caption,
          child: LayoutBuilder(
            builder: (context, c) => FittedBox(
              fit: BoxFit.scaleDown,
              child: SizedBox(
                width: math.max(280, c.maxWidth - 24),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: IqSlotsView(slots: [for (final x in s.data['slots'] as List<dynamic>) x as int]),
                ),
              ),
            ),
          ),
        );
      default:
        return const SizedBox();
    }
  }
}

class _UavView extends StatefulWidget {
  const _UavView({required this.id, required this.index});

  final String id;
  final int index;

  @override
  State<_UavView> createState() => _UavViewState();
}

class _UavViewState extends State<_UavView> {
  late final Future<UavRepository> _repo = UavRepository.load(DefaultAssetBundle.of(context));

  @override
  Widget build(BuildContext context) => FutureBuilder<UavRepository>(
        future: _repo,
        builder: (context, snap) {
          final p = snap.data?.byId(widget.id);
          if (p == null || p.views.length <= widget.index) {
            return const Center(child: CircularProgressIndicator());
          }
          return LiveWaterfall(scene: p.views[widget.index].scene(), spectrumHeight: 36);
        },
      );
}

/// Анімований фон сцени: темний градієнт і повільна сітка, як на екрані SDR.
class _StageBackground extends StatefulWidget {
  const _StageBackground();

  @override
  State<_StageBackground> createState() => _StageBackgroundState();
}

class _StageBackgroundState extends State<_StageBackground> with SingleTickerProviderStateMixin {
  late final AnimationController _a =
      AnimationController(vsync: this, duration: const Duration(seconds: 12))..repeat();

  @override
  void dispose() {
    _a.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _a,
        builder: (context, _) => CustomPaint(painter: _GridPainter(_a.value, Theme.of(context).colorScheme.primary)),
      );
}

class _GridPainter extends CustomPainter {
  _GridPainter(this.t, this.accent);

  final double t;
  final Color accent;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF041014), Color(0xFF0B1E1A), Color(0xFF050A10)],
        ).createShader(rect),
    );
    final grid = Paint()..color = accent.withValues(alpha: 0.07);
    const step = 32.0;
    final shift = t * step;
    for (var x = -step + shift; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 0.0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    // «Промінь розгортки».
    final sweepX = (t * 1.6 % 1) * size.width;
    canvas.drawRect(
      Rect.fromLTWH(sweepX - 40, 0, 80, size.height),
      Paint()
        ..shader = LinearGradient(colors: [
          Colors.transparent,
          accent.withValues(alpha: 0.08),
          Colors.transparent,
        ]).createShader(Rect.fromLTWH(sweepX - 40, 0, 80, size.height)),
    );
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.t != t;
}

class _TitleCard extends StatelessWidget {
  const _TitleCard({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 70),
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 900),
          curve: Curves.easeOutCubic,
          builder: (context, v, child) => Opacity(
            opacity: v,
            child: Transform.scale(scale: 0.9 + 0.1 * v, child: child),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.radar, size: 44, color: scheme.primary),
            const SizedBox(height: 10),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(title,
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: scheme.primary, letterSpacing: 0.5)),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(subtitle!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, color: Colors.white70)),
            ],
          ]),
        ),
      ),
    );
  }
}

class _Bullets extends StatelessWidget {
  const _Bullets({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 36, 20, 70),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.topLeft,
        child: SizedBox(
          width: 560,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(title, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: scheme.primary)),
            const SizedBox(height: 12),
            for (var i = 0; i < items.length; i++)
              TweenAnimationBuilder<double>(
                tween: Tween(begin: 0, end: 1),
                duration: Duration(milliseconds: 500 + i * 700),
                curve: Interval(i * 700 / (500 + i * 700), 1, curve: Curves.easeOut),
                builder: (context, v, child) => Opacity(
                  opacity: v,
                  child: Transform.translate(offset: Offset(20 * (1 - v), 0), child: child),
                ),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Container(width: 8, height: 8, decoration: BoxDecoration(color: scheme.primary, shape: BoxShape.circle)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(items[i], style: const TextStyle(fontSize: 18, color: Colors.white, height: 1.3))),
                  ]),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

class _Framed extends StatelessWidget {
  const _Framed({required this.child, this.caption});

  final Widget child;
  final String? caption;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(10, 32, 10, 64),
        child: Column(children: [
          if (caption != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(caption!,
                  style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)),
            ),
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(border: Border.all(color: Colors.white24)),
              child: child,
            ),
          ),
        ]),
      );
}

class _Chip extends StatelessWidget {
  const _Chip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)),
        child: Text(text, style: const TextStyle(color: Colors.white70, fontSize: 11)),
      );
}
