import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:rer_trainer/features/modules/module_registry.dart';
import 'package:rer_trainer/features/uav/uav_profile.dart';
import 'package:rer_trainer/signal_engine/signal_engine.dart';

void main() {
  test('кожен модуль має відеоурок, усі кадри коректні', () {
    final repo = UavRepository.parse(File('assets/uav_profiles.json').readAsStringSync());
    for (final m in modules) {
      expect(m.videoAsset, isNotNull, reason: m.id);
      final j = jsonDecode(File(m.videoAsset!).readAsStringSync()) as Map<String, dynamic>;
      final scenes = j['scenes'] as List<dynamic>;
      expect(scenes.length, greaterThanOrEqualTo(4));
      for (final s in scenes.cast<Map<String, dynamic>>()) {
        expect((s['say'] as String).length, greaterThan(20), reason: '${m.id}: озвучка');
        switch (s['type']) {
          case 'kind':
            expect(basicKinds, contains(SignalKind.values.byName(s['kind'] as String)));
          case 'preset':
            expect(s['index'] as int, lessThan(bandPresets().length));
          case 'uav':
            final p = repo.byId(s['profile'] as String);
            expect(p, isNotNull);
            expect(s['view'] as int, lessThan(p!.views.length));
          case 'iq':
            expect((s['slots'] as List).length, inInclusiveRange(1, 16));
          case 'title':
          case 'bullets':
            break;
          default:
            fail('Невідомий тип кадру ${s['type']}');
        }
      }
    }
  });
}
