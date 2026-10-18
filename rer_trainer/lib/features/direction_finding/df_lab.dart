import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../signal_engine/core/rng.dart';
import '../../signal_engine/df/triangulation.dart';

/// Карта-симулятор пеленгування: 2–4 пости, промені з похибкою,
/// оцінка положення та еліпс похибки 95 %. Карта — умовна місцевість 10×10 км.
class DirectionFindingLab extends StatefulWidget {
  const DirectionFindingLab({super.key});

  @override
  State<DirectionFindingLab> createState() => _DirectionFindingLabState();
}

const double _mapKm = 10;

class _DirectionFindingLabState extends State<DirectionFindingLab> {
  final List<Pt> _allPosts = const [Pt(1.5, 1.5), Pt(8.5, 1.8), Pt(1.2, 8.0), Pt(8.8, 8.6)];
  late List<Pt> _posts = List.of(_allPosts);
  Pt _target = const Pt(5.6, 6.2);
  int _postCount = 3;
  double _sigmaDeg = 3;
  bool _multipath = false;
  Rng _rng = Rng(1);
  List<double> _noise = [];
  int? _dragIndex; // -1 — ціль, інакше номер поста

  @override
  void initState() {
    super.initState();
    _resample();
  }

  void _resample() {
    _rng = Rng(DateTime.now().microsecondsSinceEpoch & 0xffffff);
    _noise = [for (var i = 0; i < 4; i++) _rng.gaussian()];
  }

  List<Bearing> get _bearings {
    final sigma = _sigmaDeg * math.pi / 180;
    return [
      for (var i = 0; i < _postCount; i++)
        Bearing(
          _posts[i],
          azimuth(_posts[i], _target) +
              _noise[i] * sigma +
              (_multipath && i == 0 ? 14 * math.pi / 180 : 0),
          sigma,
        ),
    ];
  }

  Offset _toPx(Pt p, Size s) => Offset(p.x / _mapKm * s.width, (1 - p.y / _mapKm) * s.height);
  Pt _toKm(Offset o, Size s) => Pt(
        (o.dx / s.width * _mapKm).clamp(0.1, _mapKm - 0.1),
        ((1 - o.dy / s.height) * _mapKm).clamp(0.1, _mapKm - 0.1),
      );

  int? _hit(Offset local, Size s) {
    if ((_toPx(_target, s) - local).distance < 26) return -1;
    for (var i = 0; i < _postCount; i++) {
      if ((_toPx(_posts[i], s) - local).distance < 26) return i;
    }
    return null;
  }

  Widget _map(Fix? fix, List<Bearing> bearings) => LayoutBuilder(builder: (context, c) {
        final side = math.min(c.maxWidth, c.maxHeight);
        final size = Size(side, side);
        return Center(
          child: GestureDetector(
            onPanStart: (d) => _dragIndex = _hit(d.localPosition, size),
            onPanUpdate: (d) {
              final i = _dragIndex;
              if (i == null) return;
              setState(() {
                final p = _toKm(d.localPosition, size);
                if (i == -1) {
                  _target = p;
                } else {
                  _posts[i] = p;
                }
              });
            },
            onPanEnd: (_) => _dragIndex = null,
            child: CustomPaint(
              size: size,
              painter: _DfPainter(
                posts: _posts.take(_postCount).toList(),
                target: _target,
                bearings: bearings,
                fix: fix,
                toPx: (p) => _toPx(p, size),
                scheme: Theme.of(context).colorScheme,
                multipathPost: _multipath ? 0 : null,
              ),
            ),
          ),
        );
      });

  Widget _panel(Fix? fix) {
    final text = Theme.of(context).textTheme;
    final err = fix == null ? null : (fix.position - _target).length;
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Text('Кількість постів', style: text.titleSmall),
        const SizedBox(height: 6),
        SegmentedButton<int>(
          segments: const [
            ButtonSegment(value: 2, label: Text('2')),
            ButtonSegment(value: 3, label: Text('3')),
            ButtonSegment(value: 4, label: Text('4')),
          ],
          selected: {_postCount},
          showSelectedIcon: false,
          onSelectionChanged: (v) => setState(() => _postCount = v.first),
        ),
        const SizedBox(height: 10),
        Text('Похибка пеленгатора: ±${_sigmaDeg.toStringAsFixed(1)}°', style: text.titleSmall),
        Slider(
          value: _sigmaDeg,
          min: 0.5,
          max: 10,
          divisions: 19,
          onChanged: (v) => setState(() => _sigmaDeg = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Відбиття на посту 1'),
          subtitle: const Text('Сигнал приходить відбитим від рельєфу: пеленг зміщено на 14°'),
          value: _multipath,
          onChanged: (v) => setState(() => _multipath = v),
        ),
        Wrap(spacing: 8, children: [
          FilledButton.tonalIcon(
            onPressed: () => setState(_resample),
            icon: const Icon(Icons.refresh),
            label: const Text('Новий вимір'),
          ),
          OutlinedButton.icon(
            onPressed: () => setState(() {
              _posts = List.of(_allPosts);
              _target = const Pt(5.6, 6.2);
            }),
            icon: const Icon(Icons.restart_alt),
            label: const Text('Скинути'),
          ),
        ]),
        const Divider(height: 24),
        if (fix == null)
          const Text('Пеленги майже паралельні — точку перетину визначити неможливо. '
              'Розставте пости так, щоб кут між пеленгами був ближчим до 90°.')
        else ...[
          _row('Похибка оцінки', '${(err! * 1000).round()} м'),
          _row('Еліпс 95 %', '${(fix.ellipse.semiMajor * 2000).round()} × ${(fix.ellipse.semiMinor * 2000).round()} м'),
          _row('Площа еліпса', '${fix.ellipse.area.toStringAsFixed(2)} км²'),
          _row('Найгостріший кут між пеленгами', '${fix.minCrossingAngleDeg.round()}°'),
          const SizedBox(height: 8),
          Text(_advice(fix), style: text.bodySmall),
        ],
        const SizedBox(height: 12),
        Text(
          'Перетягуйте пости (трикутники) і ціль (ромб). Сітка — 1 км. '
          'Червоний ромб — справжнє положення, бірюзове коло — оцінка.',
          style: text.bodySmall,
        ),
      ],
    );
  }

  String _advice(Fix fix) {
    if (fix.minCrossingAngleDeg < 25) {
      return 'Пеленги перетинаються під гострим кутом — еліпс витягнутий уздовж них. '
          'Рознесіть пости або додайте ще один.';
    }
    if (_postCount == 2) {
      return 'Два пости завжди дають перетин, навіть з помилковим пеленгом, — '
          'перевірити результат неможливо. Третій пост виявляє грубі помилки.';
    }
    if (_multipath) {
      return 'Помилковий пеленг через відбиття зміщує точку. З трьома й більше постами '
          'промені вже не сходяться в одній точці — це сигнал про відбиття.';
    }
    return 'Хороша геометрія: кути між пеленгами великі, еліпс компактний.';
  }

  Widget _row(String k, String v) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [Expanded(child: Text(k)), Text(v, style: const TextStyle(fontWeight: FontWeight.bold))]),
      );

  @override
  Widget build(BuildContext context) {
    final bearings = _bearings;
    final fix = triangulate(bearings);
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth >= 860) {
        return Row(children: [
          Expanded(child: Padding(padding: const EdgeInsets.all(12), child: _map(fix, bearings))),
          const VerticalDivider(width: 1),
          SizedBox(width: 340, child: _panel(fix)),
        ]);
      }
      return Column(children: [
        SizedBox(height: math.min(c.maxWidth, c.maxHeight * 0.55), child: Padding(padding: const EdgeInsets.all(6), child: _map(fix, bearings))),
        const Divider(height: 1),
        Expanded(child: _panel(fix)),
      ]);
    });
  }
}

class _DfPainter extends CustomPainter {
  _DfPainter({
    required this.posts,
    required this.target,
    required this.bearings,
    required this.fix,
    required this.toPx,
    required this.scheme,
    this.multipathPost,
  });

  final List<Pt> posts;
  final Pt target;
  final List<Bearing> bearings;
  final Fix? fix;
  final Offset Function(Pt) toPx;
  final ColorScheme scheme;
  final int? multipathPost;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.save();
    canvas.clipRRect(RRect.fromRectAndRadius(rect, const Radius.circular(10)));
    canvas.drawRect(rect, Paint()..color = const Color(0xFF0F1A12));
    // Умовний рельєф: пагорби та ліс.
    final hill = Paint()..color = const Color(0xFF1E2A17);
    for (final h in const [(0.3, 0.35, 0.16), (0.72, 0.62, 0.2), (0.18, 0.78, 0.1)]) {
      canvas.drawOval(
          Rect.fromCenter(center: Offset(h.$1 * size.width, h.$2 * size.height), width: h.$3 * 2.2 * size.width, height: h.$3 * 1.4 * size.height),
          hill);
    }
    final river = Paint()
      ..color = const Color(0xFF15304A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6;
    canvas.drawPath(
        Path()
          ..moveTo(0, size.height * 0.55)
          ..cubicTo(size.width * 0.3, size.height * 0.45, size.width * 0.6, size.height * 0.75, size.width, size.height * 0.6),
        river);
    final grid = Paint()..color = const Color(0x22FFFFFF);
    for (var i = 1; i < _mapKm; i++) {
      final x = size.width * i / _mapKm, y = size.height * i / _mapKm;
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final reach = size.width * 2;
    for (var i = 0; i < bearings.length; i++) {
      final b = bearings[i];
      final p = toPx(b.post);
      // Сектор ±σ.
      final wedge = Path()..moveTo(p.dx, p.dy);
      for (final s in [-1.0, 1.0]) {
        final a = b.azimuthRad + s * b.sigmaRad;
        wedge.lineTo(p.dx + math.sin(a) * reach, p.dy - math.cos(a) * reach);
      }
      wedge.close();
      final color = i == multipathPost ? Colors.orange : scheme.primary;
      canvas.drawPath(wedge, Paint()..color = color.withValues(alpha: 0.12));
      canvas.drawLine(
          p,
          Offset(p.dx + math.sin(b.azimuthRad) * reach, p.dy - math.cos(b.azimuthRad) * reach),
          Paint()
            ..color = color
            ..strokeWidth = 1.6);
    }

    final f = fix;
    if (f != null) {
      final c = toPx(f.ellipse.center);
      final kmToPx = size.width / _mapKm;
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.rotate(-f.ellipse.angle);
      final er = Rect.fromCenter(
          center: Offset.zero,
          width: math.max(4, f.ellipse.semiMajor * 2 * kmToPx),
          height: math.max(4, f.ellipse.semiMinor * 2 * kmToPx));
      canvas.drawOval(er, Paint()..color = scheme.secondary.withValues(alpha: 0.25));
      canvas.drawOval(
          er,
          Paint()
            ..color = scheme.secondary
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5);
      canvas.restore();
      canvas.drawCircle(c, 5, Paint()..color = scheme.secondary);
    }

    final t = toPx(target);
    final diamond = Path()
      ..moveTo(t.dx, t.dy - 9)
      ..lineTo(t.dx + 9, t.dy)
      ..lineTo(t.dx, t.dy + 9)
      ..lineTo(t.dx - 9, t.dy)
      ..close();
    canvas.drawPath(diamond, Paint()..color = scheme.error);

    for (var i = 0; i < posts.length; i++) {
      final p = toPx(posts[i]);
      final tri = Path()
        ..moveTo(p.dx, p.dy - 11)
        ..lineTo(p.dx - 10, p.dy + 8)
        ..lineTo(p.dx + 10, p.dy + 8)
        ..close();
      canvas.drawPath(tri, Paint()..color = i == multipathPost ? Colors.orange : scheme.tertiary);
      final tp = TextPainter(
        text: TextSpan(text: 'П${i + 1}', style: const TextStyle(color: Colors.white, fontSize: 12)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, p + const Offset(12, 2));
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_DfPainter old) => true;
}
