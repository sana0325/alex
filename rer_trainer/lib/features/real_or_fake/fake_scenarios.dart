import 'dart:math' as math;

import '../../signal_engine/signal_engine.dart';

/// Ознака, за якою виявляється імітаційний сигнал.
enum FakeReason {
  tooStable(
    'Неприродно стабільний рівень',
    'Справжній сигнал від БПЛА постійно «дихає»: завмирання, зміна орієнтації антен, рух. '
        'Рівень, що тримається з точністю до десятих дБ, характерний для нерухомого маяка-приманки.',
  ),
  perfectPeriod(
    'Ідеальна періодичність пакетів',
    'Реальні передавачі мають розкид інтервалів (джитер) через обробку даних і доступ до каналу. '
        'Абсолютно однакові інтервали — ознака простого генератора-імітатора.',
  ),
  replay(
    'Повтор ідентичних пакетів',
    'Телеметрія змінюється щомиті: координати, висота, заряд. Якщо пакети побітово однакові, '
        'найімовірніше, це повтор раніше записаного сигналу (replay).',
  ),
  wrongBandwidth(
    'Ширина смуги не відповідає типу',
    'Аналогове FPV-відео займає кілька мегагерц. Сигнал, що «видає себе» за відео, але має '
        'смугу близько 2 МГц, не може передавати таку картинку — це імітація.',
  ),
  noMotion(
    'Немає реакції на рух',
    'За даними спостереження ціль наближається, а рівень сигналу не змінюється. '
        'Отже, джерело сигналу не пов\'язане з цією ціллю.',
  ),
  levelWithoutDistance(
    'Рівень змінюється без зміни відстані',
    'Ціль висить на місці, а рівень стрибає на 10 дБ і більше ступенями. Так поводиться '
        'передавач, якому вручну змінюють потужність, щоб імітувати наближення або віддалення.',
  ),
  bearingMismatch(
    'Пеленги не сходяться з місцем цілі',
    'Перетин пеленгів з кількох постів лежить за кілометри від місця, де ціль спостерігають. '
        'Джерело сигналу розташоване деінде — можливо, це приманка або ретранслятор.',
  );

  const FakeReason(this.title, this.explanation);

  final String title;
  final String explanation;
}

/// Один сигнал-кандидат зі «журналом вимірювань».
class FakeCandidate {
  FakeCandidate({
    required this.label,
    required this.freqMhz,
    required this.claimedType,
    required this.bandwidth,
    required this.level,
    this.distance,
    this.intervalsMs,
    this.repeatPercent,
    this.bearingMismatchKm,
  });

  final String label;
  final double freqMhz;
  final String claimedType;
  final String bandwidth;
  final List<double> level;
  final List<double>? distance;
  final List<double>? intervalsMs;
  final int? repeatPercent;
  final double? bearingMismatchKm;
}

class FakeScenario {
  FakeScenario({
    required this.scene,
    required this.candidates,
    required this.fakeIndex,
    required this.reason,
    required this.reasonOptions,
    required this.briefing,
  });

  final SceneConfig scene;
  final List<FakeCandidate> candidates;
  final int fakeIndex;
  final FakeReason reason;
  final List<FakeReason> reasonOptions;
  final String briefing;
}

/// Будує випадковий сценарій: три сигнали одного типу, один з них — імітація.
FakeScenario generateScenario(math.Random rnd) {
  final reason = FakeReason.values[rnd.nextInt(FakeReason.values.length)];
  final fpv = reason == FakeReason.tooStable || reason == FakeReason.wrongBandwidth;
  final fakeIndex = rnd.nextInt(3);
  double gauss() {
    final u = math.max(1e-9, rnd.nextDouble());
    return math.sqrt(-2 * math.log(u)) * math.cos(2 * math.pi * rnd.nextDouble());
  }

  const steps = 40;
  final candidates = <FakeCandidate>[];
  final specs = <SignalSpec>[];
  final offsets = fpv ? [-12e6, 0.0, 12e6] : [-0.6e6, 0.0, 0.6e6];
  final center = fpv ? 5800e6 : 433.9e6;

  for (var i = 0; i < 3; i++) {
    final isFake = i == fakeIndex;
    final label = String.fromCharCode(65 + i);

    // Траєкторія: ціль рухається (або висить на місці для сценарію з рівнем).
    final hovering = reason == FakeReason.levelWithoutDistance && isFake;
    var d = 1.5 + rnd.nextDouble() * 3;
    final v = (rnd.nextBool() ? 1 : -1) * (0.03 + rnd.nextDouble() * 0.04);
    final dist = <double>[];
    for (var s = 0; s < steps; s++) {
      dist.add(d);
      if (!hovering) d = (d + v).clamp(0.4, 6.0);
    }
    final base = fpv ? -38.0 : -66.0;
    var level = [for (final x in dist) base - 20 * math.log(x) / math.ln10 + gauss() * 2.2];
    if (isFake && (reason == FakeReason.tooStable || reason == FakeReason.noMotion)) {
      final l = level.first;
      level = [for (var s = 0; s < steps; s++) l + gauss() * 0.15];
    }
    if (isFake && reason == FakeReason.levelWithoutDistance) {
      final l = level.first;
      level = [for (var s = 0; s < steps; s++) l + ((s ~/ 10).isEven ? 0 : 11) + gauss() * 0.4];
    }

    final intervals = fpv
        ? null
        : [
            for (var k = 0; k < 6; k++)
              isFake && reason == FakeReason.perfectPeriod ? 250.0 : 250 + gauss() * 14,
          ];

    final mean = level.reduce((a, b) => a + b) / level.length;
    candidates.add(FakeCandidate(
      label: label,
      freqMhz: (center + offsets[i]) / 1e6,
      claimedType: fpv ? 'Аналогове FPV-відео' : 'Телеметрія',
      bandwidth: fpv
          ? (isFake && reason == FakeReason.wrongBandwidth
              ? '≈ ${(1.6 + rnd.nextDouble() * 0.6).toStringAsFixed(1)} МГц'
              : '≈ ${(8 + rnd.nextDouble() * 4).toStringAsFixed(0)} МГц')
          : '≈ ${(50 + rnd.nextDouble() * 15).round()} кГц',
      level: level,
      distance: fpv ? null : dist,
      intervalsMs: intervals,
      repeatPercent: fpv ? null : (isFake && reason == FakeReason.replay ? 100 : rnd.nextInt(3)),
      bearingMismatchKm: fpv
          ? null
          : (isFake && reason == FakeReason.bearingMismatch
              ? 2.5 + rnd.nextDouble() * 3
              : 0.1 + rnd.nextDouble() * 0.3),
    ));

    final fakeMode = !isFake
        ? FakeMode.none
        : switch (reason) {
            FakeReason.tooStable => FakeMode.tooStable,
            FakeReason.perfectPeriod => FakeMode.perfectPeriod,
            FakeReason.replay => FakeMode.replay,
            FakeReason.wrongBandwidth => FakeMode.wrongBandwidth,
            _ => FakeMode.none,
          };
    specs.add(SignalSpec(
      id: label,
      kind: fpv ? SignalKind.analogFpv : SignalKind.telemetry,
      offsetHz: offsets[i],
      powerDbm: fpv ? mean - 18 : mean - 28,
      seed: 1 + rnd.nextInt(10000),
      fake: fakeMode,
      params: fpv
          ? {'deviation': 2.5e6, 'audioOffset': 4.5e6}
          : {'period': 0.25, 'burst': 0.025, 'jitter': 0.06},
    ));
  }

  // Варіанти пояснень: правильне + три інших, без близьких за змістом пар.
  const conflicts = {
    FakeReason.tooStable: FakeReason.noMotion,
    FakeReason.noMotion: FakeReason.tooStable,
  };
  final others = FakeReason.values
      .where((r) => r != reason && r != conflicts[reason])
      .toList()
    ..shuffle(rnd);
  final options = [reason, ...others.take(3)]..shuffle(rnd);

  return FakeScenario(
    scene: SceneConfig(
      centerHz: center,
      sampleRate: fpv ? 40e6 : 2e6,
      noiseDensityDbmHz: fpv ? -150 : -158,
      signals: specs,
    ),
    candidates: candidates,
    fakeIndex: fakeIndex,
    reason: reason,
    reasonOptions: options,
    briefing: fpv
        ? 'Пост фіксує три сигнали, схожі на аналогове FPV-відео. Один із них — імітація.'
        : 'Пост фіксує три сигнали телеметрії. За даними спостереження в районі є цілі. '
            'Один із сигналів — імітація.',
  );
}
