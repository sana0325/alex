import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:rer_trainer/features/mesh/mesh_network.dart';
import 'package:rer_trainer/features/real_or_fake/fake_scenarios.dart';
import 'package:rer_trainer/signal_engine/df/triangulation.dart';
import 'package:rer_trainer/signal_engine/signal_engine.dart';

double _median(Iterable<double> v) => (v.toList()..sort())[v.length ~/ 2];

void main() {
  group('триангуляція', () {
    const target = Pt(5, 6);
    List<Bearing> exact(List<Pt> posts, double sigmaDeg) => [
          for (final p in posts) Bearing(p, azimuth(p, target), sigmaDeg * math.pi / 180),
        ];

    test('точні пеленги дають точку цілі', () {
      final fix = triangulate(exact(const [Pt(1, 1), Pt(9, 1), Pt(1, 9)], 2))!;
      expect((fix.position - target).length, lessThan(1e-6));
    });

    test('три пости дають менший еліпс, ніж два', () {
      final two = triangulate(exact(const [Pt(1, 1), Pt(9, 1)], 3))!;
      final three = triangulate(exact(const [Pt(1, 1), Pt(9, 1), Pt(1, 9)], 3))!;
      expect(three.ellipse.area, lessThan(two.ellipse.area));
    });

    test('гострий кут витягує еліпс', () {
      final wide = triangulate(exact(const [Pt(1, 6), Pt(5, 1)], 3))!;
      final narrow = triangulate(exact(const [Pt(1, 1), Pt(2, 0.5)], 3))!;
      expect(narrow.minCrossingAngleDeg, lessThan(wide.minCrossingAngleDeg));
      expect(narrow.ellipse.semiMajor / narrow.ellipse.semiMinor,
          greaterThan(wide.ellipse.semiMajor / wide.ellipse.semiMinor));
    });

    test('паралельні пеленги не дають перетину', () {
      final b = [Bearing(const Pt(0, 0), 0, 0.02), Bearing(const Pt(1, 0), 0, 0.02)];
      expect(triangulate(b), isNull);
    });
  });

  group('mesh', () {
    test('маршрути перебудовуються після відмови вузла', () {
      final net = MeshNetwork();
      final before = net.nextHops();
      expect(before.length, net.nodes.length - 1, reason: 'усі БПЛА мають маршрут');
      // Вимикаємо вузол, через який проходить маршрут іншого вузла.
      final relay = before.entries.firstWhere((e) => e.value != 0).value;
      net.nodes[relay].alive = false;
      final after = net.nextHops();
      expect(after.containsKey(relay), isFalse);
      expect(after.values.contains(relay), isFalse);
    });

    test('ближчий до поста вузол чути сильніше', () {
      final net = MeshNetwork();
      final a = MeshNode(9, const Offset(0.15, 0.85));
      final b = MeshNode(10, const Offset(0.9, 0.1));
      expect(net.levelAtPost(a), greaterThan(net.levelAtPost(b)));
    });

    test('вимкнений вузол лишає порожній слот', () {
      SpectrumEngine scene(double alive) => SpectrumEngine(SceneConfig(
            centerHz: 2380e6,
            sampleRate: 20e6,
            rowsPerSecond: 1000,
            signals: [
              SignalSpec(id: 'm', kind: SignalKind.mesh, offsetHz: 0, powerDbm: -50,
                  params: {'n': 2, 'frame': 0.02, 'p0': -50, 'p1': -50, 'a1': alive}),
            ],
          ));
      double activeRows(SpectrumEngine e) {
        var active = 0;
        for (var i = 0; i < 40; i++) {
          if (e.nextRow()[512] > -85) active++;
        }
        return active / 40;
      }
      expect(activeRows(scene(0)), lessThan(activeRows(scene(1)) - 0.2));
    });
  });

  test('кожен тип сигналу видно над шумом у своїй сцені', () {
    for (final k in SignalKind.values) {
      final cfg = sceneFor(k);
      final e = SpectrumEngine(cfg);
      final floor = cfg.noiseDensityDbmHz +
          10 * math.log(cfg.sampleRate * 1.5 / cfg.fftSize) / math.ln10;
      var peak = -300.0;
      for (var i = 0; i < 120; i++) {
        peak = math.max(peak, e.nextRow().reduce(math.max));
      }
      expect(peak - floor, greaterThan(12), reason: k.name);
    }
  });

  test('фейк «без завмирань» стабільніший за справжній сигнал', () {
    double spread(FakeMode mode) {
      final e = SpectrumEngine(SceneConfig(
        centerHz: 433.9e6,
        sampleRate: 2e6,
        noiseDensityDbmHz: -170,
        signals: [
          SignalSpec(id: 'x', kind: SignalKind.analogFpv, offsetHz: 0, powerDbm: -60,
              fake: mode, params: const {'deviation': 0.2e6}),
        ],
      ));
      final levels = [for (var i = 0; i < 150; i++) e.nextRow().reduce(math.max).toDouble()];
      final m = levels.reduce((a, b) => a + b) / levels.length;
      return math.sqrt(levels.map((v) => (v - m) * (v - m)).reduce((a, b) => a + b) / levels.length);
    }
    expect(spread(FakeMode.tooStable), lessThan(spread(FakeMode.none)));
  });

  test('сценарії «Знайди фейк» узгоджені', () {
    final rnd = math.Random(7);
    for (var i = 0; i < 200; i++) {
      final s = generateScenario(rnd);
      expect(s.candidates.length, 3);
      expect(s.reasonOptions, contains(s.reason));
      expect(s.reasonOptions.length, 4);
      final fake = s.candidates[s.fakeIndex];
      final real = [for (var j = 0; j < 3; j++) if (j != s.fakeIndex) s.candidates[j]];
      switch (s.reason) {
        case FakeReason.perfectPeriod:
          expect(fake.intervalsMs!.toSet().length, 1);
          for (final r in real) {
            expect(r.intervalsMs!.toSet().length, greaterThan(1));
          }
        case FakeReason.replay:
          expect(fake.repeatPercent, 100);
        case FakeReason.bearingMismatch:
          expect(fake.bearingMismatchKm, greaterThan(2));
        default:
          break;
      }
    }
    expect(_median([1, 2, 3]), 2);
  });
}
