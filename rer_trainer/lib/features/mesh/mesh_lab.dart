import 'dart:async';

import 'package:flutter/material.dart';

import '../../signal_engine/signal_engine.dart';
import '../../widgets/live_waterfall.dart';
import '../waterfall_lab/simulator_model.dart';
import 'mesh_network.dart';

/// Інтерактивна схема mesh-мережі з синхронним водоспадом.
/// Дотик до вузла — вихід з ладу / відновлення, перетягування — переміщення.
class MeshLab extends StatefulWidget {
  const MeshLab({super.key});

  @override
  State<MeshLab> createState() => _MeshLabState();
}

class _MeshLabState extends State<MeshLab> {
  final MeshNetwork _net = MeshNetwork();
  SimulatorModel? _sim;
  Timer? _timer;
  MeshNode? _dragged;
  bool _flying = false;

  static const _scene = SceneConfig(
    centerHz: 2380e6,
    sampleRate: 20e6,
    timeScale: 0.2,
    signals: [
      SignalSpec(
        id: 'mesh',
        kind: SignalKind.mesh,
        offsetHz: 0,
        powerDbm: -60,
        seed: 3,
        params: {'n': 6, 'bandwidth': 8e6, 'frame': 0.12},
      ),
    ],
  );

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _sync() {
    final sim = _sim;
    if (sim == null) return;
    final params = <String, double>{'n': 6, 'bandwidth': 8e6, 'frame': 0.12};
    for (final n in _net.nodes) {
      params['p${n.id}'] = _net.levelAtPost(n);
      params['a${n.id}'] = n.alive ? 1 : 0;
    }
    sim.replaceSignal('mesh', (s) => s.copyWith(params: params));
  }

  void _toggleFlight() {
    setState(() => _flying = !_flying);
    _timer?.cancel();
    if (_flying) {
      _timer = Timer.periodic(const Duration(milliseconds: 120), (_) {
        setState(_net.step);
        _sync();
      });
    }
  }

  MeshNode? _hit(Offset local, Size size) {
    MeshNode? best;
    var bestD = 28.0;
    for (final n in _net.nodes) {
      final p = Offset(n.position.dx * size.width, n.position.dy * size.height);
      final d = (p - local).distance;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  Widget _map() => LayoutBuilder(builder: (context, c) {
        final size = Size(c.maxWidth, c.maxHeight);
        return GestureDetector(
          onTapUp: (d) {
            final n = _hit(d.localPosition, size);
            if (n == null || n.isStation) return;
            setState(() => n.alive = !n.alive);
            _sync();
          },
          onPanStart: (d) => _dragged = _hit(d.localPosition, size),
          onPanUpdate: (d) {
            final n = _dragged;
            if (n == null) return;
            setState(() => n.position = Offset(
                  (d.localPosition.dx / size.width).clamp(0.03, 0.97),
                  (d.localPosition.dy / size.height).clamp(0.03, 0.97),
                ));
            _sync();
          },
          onPanEnd: (_) => _dragged = null,
          child: CustomPaint(
            size: size,
            painter: _MeshPainter(_net, Theme.of(context).colorScheme),
          ),
        );
      });

  Widget _routes() {
    final hops = _net.nextHops();
    final text = Theme.of(context).textTheme;
    return Wrap(spacing: 12, runSpacing: 4, children: [
      for (final n in _net.nodes.where((n) => !n.isStation))
        Text(
          !n.alive
              ? '${n.label}: не працює'
              : hops.containsKey(n.id)
                  ? '${n.label}: ${_net.routeOf(n.id, hops).map((i) => _net.nodes[i].label).join(' → ')}'
                  : '${n.label}: немає зв\'язку',
          style: text.bodySmall,
        ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final controls = Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
          FilledButton.tonalIcon(
            onPressed: _toggleFlight,
            icon: Icon(_flying ? Icons.pause : Icons.flight),
            label: Text(_flying ? 'Зупинити рух' : 'Рух вузлів'),
          ),
          OutlinedButton.icon(
            onPressed: () {
              setState(_net.reset);
              _sync();
            },
            icon: const Icon(Icons.restart_alt),
            label: const Text('Скинути'),
          ),
          Text('Дотик — вимкнути/увімкнути вузол, перетягування — перемістити',
              style: Theme.of(context).textTheme.bodySmall),
        ]),
        const SizedBox(height: 6),
        _routes(),
      ]),
    );
    final waterfall = LiveWaterfall(
      scene: _scene,
      spectrumHeight: 70,
      onModel: (m) {
        _sim = m;
        _sync();
      },
    );
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth >= 900) {
        return Row(children: [
          Expanded(
            child: Column(children: [
              Expanded(child: Padding(padding: const EdgeInsets.all(8), child: _map())),
              controls,
            ]),
          ),
          const VerticalDivider(width: 1),
          Expanded(child: waterfall),
        ]);
      }
      return Column(children: [
        SizedBox(height: c.maxHeight * 0.4, child: Padding(padding: const EdgeInsets.all(6), child: _map())),
        ConstrainedBox(
          constraints: BoxConstraints(maxHeight: c.maxHeight * 0.22),
          child: SingleChildScrollView(child: controls),
        ),
        Expanded(child: waterfall),
      ]);
    });
  }
}

class _MeshPainter extends CustomPainter {
  _MeshPainter(this.net, this.scheme);

  final MeshNetwork net;
  final ColorScheme scheme;

  @override
  void paint(Canvas canvas, Size size) {
    Offset px(Offset p) => Offset(p.dx * size.width, p.dy * size.height);
    final bg = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(10));
    canvas.drawRRect(bg, Paint()..color = const Color(0xFF0B1410));
    final grid = Paint()..color = const Color(0x1A8CFFC8);
    for (var i = 1; i < 10; i++) {
      canvas.drawLine(Offset(size.width * i / 10, 0), Offset(size.width * i / 10, size.height), grid);
      canvas.drawLine(Offset(0, size.height * i / 10), Offset(size.width, size.height * i / 10), grid);
    }

    final hops = net.nextHops();
    final linkPaint = Paint()
      ..color = const Color(0x55FFFFFF)
      ..strokeWidth = 1;
    final routePaint = Paint()
      ..color = scheme.primary
      ..strokeWidth = 3;
    for (final (a, b) in net.links) {
      final used = hops[a.id] == b.id || hops[b.id] == a.id;
      canvas.drawLine(px(a.position), px(b.position), used ? routePaint : linkPaint);
    }

    // Пост РЕР.
    final post = px(net.post);
    final tri = Path()
      ..moveTo(post.dx, post.dy - 10)
      ..lineTo(post.dx - 9, post.dy + 7)
      ..lineTo(post.dx + 9, post.dy + 7)
      ..close();
    canvas.drawPath(tri, Paint()..color = scheme.tertiary);
    _label(canvas, 'Пост РЕР', post + const Offset(12, -6), scheme.tertiary);

    for (final n in net.nodes) {
      final p = px(n.position);
      final reachable = n.isStation || hops.containsKey(n.id);
      final color = !n.alive
          ? scheme.error
          : reachable
              ? scheme.primary
              : Colors.orange;
      if (n.isStation) {
        canvas.drawRect(Rect.fromCenter(center: p, width: 20, height: 20), Paint()..color = color);
      } else {
        canvas.drawCircle(p, 10, Paint()..color = color.withValues(alpha: n.alive ? 1 : 0.35));
      }
      if (!n.alive) {
        final x = Paint()
          ..color = scheme.error
          ..strokeWidth = 3;
        canvas.drawLine(p + const Offset(-8, -8), p + const Offset(8, 8), x);
        canvas.drawLine(p + const Offset(-8, 8), p + const Offset(8, -8), x);
      }
      _label(canvas, '${n.label}  ${net.levelAtPost(n).round()} дБм', p + const Offset(13, -7), Colors.white);
    }
  }

  void _label(Canvas canvas, String text, Offset at, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: 11)),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, at);
  }

  @override
  bool shouldRepaint(_MeshPainter old) => true;
}
