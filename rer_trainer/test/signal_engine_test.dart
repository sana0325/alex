import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:rer_trainer/models/quiz.dart';
import 'package:rer_trainer/signal_engine/signal_engine.dart';

double _median(List<double> v) => (List.of(v)..sort())[v.length ~/ 2];

SceneConfig _scene({List<SignalSpec> signals = const [], int fft = 1024}) =>
    SceneConfig(
      centerHz: 2440e6,
      sampleRate: 40e6,
      fftSize: fft,
      signals: signals,
    );

void main() {
  test('рядок має довжину БПФ, шумовий поріг відповідає RBW', () {
    final engine = SpectrumEngine(_scene());
    final row = engine.nextRow();
    expect(row.length, 1024);
    final expected = -150 + 10 * math.log(40e6 * 1.5 / 1024) / math.ln10;
    expect(_median(row.map((e) => e.toDouble()).toList()),
        closeTo(expected, 2.5));
  });

  test('більший БПФ знижує шум на бін', () {
    final small = _median(
        SpectrumEngine(_scene(fft: 256)).nextRow().map((e) => e.toDouble()).toList());
    final large = _median(
        SpectrumEngine(_scene(fft: 2048)).nextRow().map((e) => e.toDouble()).toList());
    expect(small - large, closeTo(9, 1.5));
  });

  test('аналогове FPV піднімає рівень у своїй смузі', () {
    final engine = SpectrumEngine(_scene(signals: [
      const SignalSpec(
          id: 'fpv', kind: SignalKind.analogFpv, offsetHz: -9e6, powerDbm: -55),
    ]));
    final row = engine.nextRow();
    // −9 МГц від центру → бін 512 − 9/40·1024 ≈ 282.
    final inBand = row.sublist(260, 300).reduce(math.max);
    final outBand = _median(row.sublist(700, 900).map((e) => e.toDouble()).toList());
    expect(inBand - outBand, greaterThan(15));
  });

  test('FHSS з часом займає багато різних каналів', () {
    final engine = SpectrumEngine(_scene(signals: [
      const SignalSpec(
          id: 'fhss', kind: SignalKind.fhssControl, offsetHz: 0, powerDbm: -55),
    ]));
    final peaks = <int>{};
    for (var i = 0; i < 30; i++) {
      final row = engine.nextRow();
      var best = 0;
      for (var b = 1; b < row.length; b++) {
        if (row[b] > row[best]) best = b;
      }
      peaks.add(best ~/ 16);
    }
    expect(peaks.length, greaterThan(8));
  });

  test('тести у JSON коректні', () {
    for (final f in Directory('assets/quizzes').listSync().whereType<File>()) {
      final quiz = Quiz.fromJson(
          jsonDecode(f.readAsStringSync()) as Map<String, dynamic>);
      expect(quiz.questions.length, inInclusiveRange(5, f.path.contains('enemy_uav') ? 60 : 10), reason: f.path);
      for (final q in quiz.questions) {
        expect(q.answer, inInclusiveRange(0, q.options.length - 1));
      }
    }
  });
}
