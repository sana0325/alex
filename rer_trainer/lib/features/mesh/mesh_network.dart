import 'dart:collection';
import 'dart:math' as math;
import 'dart:ui';

/// Вузол mesh-мережі на умовній карті (координати 0…1).
class MeshNode {
  MeshNode(this.id, this.position, {this.isStation = false});

  final int id;
  Offset position;
  final bool isStation;
  bool alive = true;
  Offset velocity = Offset.zero;

  String get label => isStation ? 'НСУ' : 'Б$id';
}

/// Проста модель mesh: зв'язок є, якщо вузли ближче за [range];
/// маршрути до наземної станції шукаються пошуком у ширину.
class MeshNetwork {
  MeshNetwork({this.range = 0.4}) {
    reset();
  }

  final double range;
  final List<MeshNode> nodes = [];

  /// Позиція поста РЕР, що «слухає» мережу.
  final Offset post = const Offset(0.1, 0.9);

  final math.Random _rnd = math.Random(4);

  void reset() {
    nodes
      ..clear()
      ..add(MeshNode(0, const Offset(0.12, 0.2), isStation: true))
      ..add(MeshNode(1, const Offset(0.35, 0.3)))
      ..add(MeshNode(2, const Offset(0.6, 0.22)))
      ..add(MeshNode(3, const Offset(0.5, 0.55)))
      ..add(MeshNode(4, const Offset(0.82, 0.45)))
      ..add(MeshNode(5, const Offset(0.78, 0.8)));
    for (final n in nodes.where((n) => !n.isStation)) {
      final a = _rnd.nextDouble() * 2 * math.pi;
      n.velocity = Offset(math.cos(a), math.sin(a)) * 0.012;
    }
  }

  bool linked(MeshNode a, MeshNode b) =>
      a.alive && b.alive && (a.position - b.position).distance <= range;

  Iterable<(MeshNode, MeshNode)> get links sync* {
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        if (linked(nodes[i], nodes[j])) yield (nodes[i], nodes[j]);
      }
    }
  }

  /// Для кожного живого вузла — наступний вузол на шляху до станції.
  Map<int, int> nextHops() {
    final station = nodes.firstWhere((n) => n.isStation);
    final parent = <int, int>{};
    if (!station.alive) return parent;
    final seen = {station.id};
    final queue = Queue<MeshNode>()..add(station);
    while (queue.isNotEmpty) {
      final cur = queue.removeFirst();
      for (final n in nodes) {
        if (!seen.contains(n.id) && linked(cur, n)) {
          seen.add(n.id);
          parent[n.id] = cur.id;
          queue.add(n);
        }
      }
    }
    return parent;
  }

  List<int> routeOf(int id, Map<int, int> hops) {
    final path = [id];
    var cur = id;
    while (hops.containsKey(cur)) {
      cur = hops[cur]!;
      path.add(cur);
    }
    return path;
  }

  /// Рівень сигналу вузла на посту РЕР: спадає з відстанню.
  double levelAtPost(MeshNode n) {
    final d = math.max(0.03, (n.position - post).distance);
    return -42 - 25 * math.log(d / 0.05) / math.ln10;
  }

  void step() {
    for (final n in nodes) {
      if (n.isStation || !n.alive) continue;
      var p = n.position + n.velocity;
      var v = n.velocity;
      if (p.dx < 0.05 || p.dx > 0.95) v = Offset(-v.dx, v.dy);
      if (p.dy < 0.05 || p.dy > 0.95) v = Offset(v.dx, -v.dy);
      // Невелике випадкове відхилення курсу.
      final turn = (_rnd.nextDouble() - 0.5) * 0.3;
      v = Offset(v.dx * math.cos(turn) - v.dy * math.sin(turn),
          v.dx * math.sin(turn) + v.dy * math.cos(turn));
      n.velocity = v;
      n.position = Offset(p.dx.clamp(0.05, 0.95), p.dy.clamp(0.05, 0.95));
    }
  }
}
