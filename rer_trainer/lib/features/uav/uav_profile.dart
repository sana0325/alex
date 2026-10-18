import 'dart:convert';

import 'package:flutter/services.dart';

import '../../signal_engine/signal_engine.dart';

/// Джерело факту.
enum FactSource {
  /// Методичка, підтверджено практикою.
  m('М', 'Методичка, підтверджено практикою'),

  /// У методичці, але не підтверджено.
  mUnconfirmed('М?', 'Методичка: не підтверджено / за словами спеціалістів'),

  /// Загальновідомі відкриті джерела.
  open('ВД', 'Загальновідомі відкриті джерела');

  const FactSource(this.badge, this.description);

  final String badge;
  final String description;

  static FactSource? parse(Object? s) => switch (s) {
        'М' => FactSource.m,
        'М?' => FactSource.mUnconfirmed,
        'ВД' => FactSource.open,
        _ => null,
      };
}

/// Факт із обов'язковим джерелом. Факти без джерела відкидаються.
class Fact {
  const Fact(this.text, this.source);

  final String text;
  final FactSource source;

  static List<Fact> listFrom(Object? json) => [
        for (final f in (json as List<dynamic>? ?? const []))
          if (FactSource.parse((f as Map<String, dynamic>)['s']) case final src?)
            Fact(f['t'] as String, src),
      ];
}

/// Рядок таблиці параметрів каналу.
class ChannelRow {
  const ChannelRow({
    required this.channel,
    required this.range,
    required this.type,
    required this.shape,
    required this.width,
    required this.source,
  });

  final String channel;
  final String range;
  final String type;
  final String shape;
  final String width;
  final FactSource source;
}

/// Один «вид» каналу: смуга огляду й набір сигналів для генератора.
class UavView {
  const UavView({
    required this.title,
    required this.role,
    required this.centerMhz,
    required this.spanMhz,
    required this.signals,
    this.fftSize = 1024,
    this.timeScale = 1,
    this.noise = -162,
  });

  factory UavView.fromJson(Map<String, dynamic> j, String profileId, int index) {
    var n = 0;
    return UavView(
      title: j['title'] as String,
      role: j['role'] as String? ?? 'telemetry',
      centerMhz: (j['center_mhz'] as num).toDouble(),
      spanMhz: (j['span_mhz'] as num).toDouble(),
      fftSize: (j['fft'] as num?)?.toInt() ?? 1024,
      timeScale: (j['time_scale'] as num?)?.toDouble() ?? 1,
      noise: (j['noise'] as num?)?.toDouble() ?? -162,
      signals: [
        for (final s in j['signals'] as List<dynamic>)
          _signal(s as Map<String, dynamic>, '$profileId.$index.${n++}'),
      ],
    );
  }

  static SignalSpec _signal(Map<String, dynamic> s, String id) => SignalSpec(
        id: id,
        kind: SignalKindInfo.fromPrimitive(s['prim'] as String),
        offsetHz: (s['off_mhz'] as num? ?? 0).toDouble() * 1e6,
        powerDbm: (s['dbm'] as num).toDouble(),
        seed: id.hashCode & 0xffff,
        params: {
          for (final e in (s['p'] as Map<String, dynamic>? ?? const {}).entries)
            e.key: (e.value as num).toDouble(),
        },
      );

  final String title;

  /// telemetry / video / other — для перемикача «телеметрія / відео».
  final String role;
  final double centerMhz;
  final double spanMhz;
  final int fftSize;
  final double timeScale;
  final double noise;
  final List<SignalSpec> signals;

  SceneConfig scene({List<SignalSpec> extra = const [], int? seed}) => SceneConfig(
        centerHz: centerMhz * 1e6,
        sampleRate: spanMhz * 1e6,
        fftSize: fftSize,
        timeScale: timeScale,
        noiseDensityDbmHz: noise,
        signals: [
          for (final s in signals)
            seed == null
                ? s
                : SignalSpec(
                    id: s.id,
                    kind: s.kind,
                    offsetHz: s.offsetHz,
                    powerDbm: s.powerDbm,
                    seed: (s.seed + seed) & 0xffff,
                    params: s.params,
                  ),
          ...extra,
        ],
      );
}

/// Режим IQ-аналізу: які з 16 таймслотів зайняті.
class IqMode {
  const IqMode({required this.label, required this.slots, required this.source, this.note});

  final String label;
  final List<int> slots;
  final FactSource source;
  final String? note;

  int get occupied => slots.length;
}

enum UavGroup {
  enemy('Ворожі БпЛА'),
  fpvCivil('FPV і цивільні'),
  trap('Пастки'),
  unknown('Невідомі сигнали');

  const UavGroup(this.title);

  final String title;
}

class UavProfile {
  UavProfile({
    required this.id,
    required this.name,
    required this.group,
    required this.key,
    required this.intro,
    required this.table,
    required this.lookFor,
    required this.confusedWith,
    required this.views,
    required this.iq,
    required this.compareWith,
    required this.insufficient,
    this.identLabel,
  });

  factory UavProfile.fromJson(Map<String, dynamic> j) {
    final id = j['id'] as String;
    final views = j['views'] as List<dynamic>? ?? const [];
    return UavProfile(
      id: id,
      name: j['name'] as String,
      group: UavGroup.values.byName(j['group'] as String),
      identLabel: j['ident_label'] as String?,
      key: j['key'] as String? ?? '',
      intro: Fact.listFrom(j['intro']),
      table: [
        for (final r in j['table'] as List<dynamic>? ?? const [])
          if (FactSource.parse((r as Map<String, dynamic>)['s']) case final src?)
            ChannelRow(
              channel: r['channel'] as String,
              range: r['range'] as String,
              type: r['type'] as String,
              shape: r['shape'] as String,
              width: r['width'] as String,
              source: src,
            ),
      ],
      lookFor: Fact.listFrom(j['look_for']),
      confusedWith: [for (final c in j['confused_with'] as List<dynamic>? ?? const []) c as String],
      views: [
        for (var i = 0; i < views.length; i++)
          UavView.fromJson(views[i] as Map<String, dynamic>, id, i),
      ],
      iq: [
        for (final m in j['iq'] as List<dynamic>? ?? const [])
          if (FactSource.parse((m as Map<String, dynamic>)['s']) case final src?)
            IqMode(
              label: m['label'] as String,
              slots: [for (final s in m['slots'] as List<dynamic>) s as int],
              source: src,
              note: m['note'] as String?,
            ),
      ],
      compareWith: [for (final c in j['compare'] as List<dynamic>? ?? const []) c as String],
      insufficient: j['insufficient'] as bool? ?? false,
    );
  }

  final String id;
  final String name;
  final UavGroup group;

  /// Назва для відповіді в «Ідентифікації» (за замовчуванням [name]).
  final String? identLabel;

  /// Ключова ознака — показується після відповіді в «Ідентифікації».
  final String key;
  final List<Fact> intro;
  final List<ChannelRow> table;
  final List<Fact> lookFor;
  final List<String> confusedWith;
  final List<UavView> views;
  final List<IqMode> iq;
  final List<String> compareWith;
  final bool insufficient;

  String get answer => identLabel ?? name;
}

/// Комбінація сигналів для 3-го рівня «Ідентифікації».
class IdentCombo {
  const IdentCombo({required this.label, required this.view, required this.key});

  final String label;
  final UavView view;
  final String key;
}

/// Сховище профілів (assets/uav_profiles.json), завантажується один раз.
class UavRepository {
  UavRepository._(this.profiles, this.combos);

  final List<UavProfile> profiles;
  final List<IdentCombo> combos;

  static Future<UavRepository>? _instance;

  static Future<UavRepository> load([AssetBundle? bundle]) =>
      _instance ??= _load(bundle ?? rootBundle);

  static Future<UavRepository> _load(AssetBundle bundle) async =>
      parse(await bundle.loadString('assets/uav_profiles.json'));

  static UavRepository parse(String raw) {
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final combos = data['combos'] as List<dynamic>? ?? const [];
    return UavRepository._(
      [
        for (final p in data['profiles'] as List<dynamic>)
          UavProfile.fromJson(p as Map<String, dynamic>),
      ],
      [
        for (var i = 0; i < combos.length; i++)
          IdentCombo(
            label: (combos[i] as Map<String, dynamic>)['label'] as String,
            key: combos[i]['key'] as String,
            view: UavView.fromJson(combos[i]['view'] as Map<String, dynamic>, 'combo$i', 0),
          ),
      ],
    );
  }

  UavProfile? byId(String id) {
    for (final p in profiles) {
      if (p.id == id) return p;
    }
    return null;
  }
}
