import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:rer_trainer/features/direction_finding/distance_calculator.dart';
import 'package:rer_trainer/features/uav/uav_profile.dart';
import 'package:rer_trainer/signal_engine/signal_engine.dart';

void main() {
  final repo = UavRepository.parse(File('assets/uav_profiles.json').readAsStringSync());

  test('усі борти з Додатку А присутні', () {
    const required = [
      'orlan10', 'orlan30', 'zala', 'lancet_pair', 'lancet_alone', 'supercam', 'supercam_m',
      'supercam_notlm', 'supercam_x', 'eleron', 'orion', 'albatros', 'kartograf', 'fpv', 'dji',
      'mobile', 'mobile_inet', 'wifi', 'bluetooth', 'microwave',
    ];
    for (final id in required) {
      expect(repo.byId(id), isNotNull, reason: id);
    }
  });

  test('кожен борт (крім «даних недостатньо») має живий водоспад і входить у пул', () {
    for (final p in repo.profiles) {
      if (p.insufficient) {
        expect(p.views, isEmpty);
        continue;
      }
      expect(p.views, isNotEmpty, reason: p.id);
      expect(p.answer, isNotEmpty);
    }
  });

  test('усі факти мають джерело, посилання «сплутати» ведуть на існуючі картки', () {
    final raw = File('assets/uav_profiles.json').readAsStringSync();
    // Кількість фактів у JSON дорівнює кількості розпізнаних (з джерелом).
    final factCount = RegExp(r'"t": ').allMatches(raw).length;
    final parsed = repo.profiles.fold<int>(0, (n, p) => n + p.intro.length + p.lookFor.length);
    expect(parsed, factCount);
    for (final p in repo.profiles) {
      for (final id in [...p.confusedWith, ...p.compareWith]) {
        expect(repo.byId(id), isNotNull, reason: '${p.id} → $id');
      }
    }
  });

  test('кожен вид кожного профілю генерує сигнал над шумом', () {
    for (final p in repo.profiles) {
      for (final v in p.views) {
        final cfg = v.scene();
        final e = SpectrumEngine(cfg);
        final floor = cfg.noiseDensityDbmHz + 10 * math.log(cfg.sampleRate * 1.5 / cfg.fftSize) / math.ln10;
        var peak = -300.0;
        for (var i = 0; i < 60; i++) {
          peak = math.max(peak, e.nextRow().reduce(math.max));
        }
        expect(peak - floor, greaterThan(10), reason: '${p.id}: ${v.title}');
      }
    }
    for (final c in repo.combos) {
      expect(SpectrumEngine(c.view.scene()).nextRow(), isNotEmpty);
    }
  });

  test('IQ-режими Zala: 14, 9, 5 і 2 слоти, дзеркальність Zala/Ланцет', () {
    final zala = repo.byId('zala')!;
    expect(zala.iq.map((m) => m.occupied), [14, 9, 5, 2]);
    final wait = zala.iq[1].slots.toSet(), lancet = zala.iq[2].slots.toSet();
    expect(wait.intersection(lancet), isEmpty);
  });

  test('таблиця відстаней: Zala −90 дБм ≈ 10–15 км, інтерполяція монотонна', () {
    final zala = powerTables.firstWhere((t) => t.title == 'Zala');
    final (lo90, hi90) = zala.rangeAt(-90);
    expect(lo90, closeTo(10, 1e-6));
    expect(hi90, closeTo(15, 1e-6));
    var prev = 0.0;
    for (var dbm = -75.0; dbm >= -115; dbm -= 1) {
      final (lo, _) = zala.rangeAt(dbm);
      expect(lo, greaterThanOrEqualTo(prev));
      prev = lo;
    }
  });
}
