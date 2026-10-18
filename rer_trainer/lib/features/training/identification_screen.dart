import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import '../../signal_engine/signal_engine.dart';
import '../../widgets/live_waterfall.dart';
import '../uav/iq_slots_view.dart';
import '../uav/uav_card.dart';
import '../uav/uav_profile.dart';

/// Рівні складності режиму «Ідентифікація».
enum IdentLevel {
  basic('Базовий: типи сигналів', 'Аналогове/цифрове відео, FHSS, LoRa, Wi-Fi та ін.'),
  single('1. Один сигнал, чисто', 'Борти, пастки й невідомі сигнали з методички'),
  noisy('2. Сигнал + цивільні завади', 'Поруч мобільний зв\'язок, Wi-Fi, Bluetooth'),
  combo('3. Два борти або мультиканальний Орлан', 'Визначте, що саме в ефірі'),
  iq('4. IQ-режим: таймслоти', 'Zala-розвідник, «ждун», Ланцет, НПУ, Орлан…');

  const IdentLevel(this.title, this.subtitle);

  final String title;
  final String subtitle;
}

class _Round {
  _Round({
    required this.answer,
    required this.options,
    required this.key,
    this.scene,
    this.iqSlots,
    this.profileId,
  });

  final String answer;
  final List<String> options;
  final String key;
  final SceneConfig? scene;
  final List<int>? iqSlots;
  final String? profileId;
}

/// Режим «Ідентифікація»: випадковий синтетичний водоспад — визначити, що це,
/// поки не сплив час.
class IdentificationScreen extends StatefulWidget {
  const IdentificationScreen({super.key});

  @override
  State<IdentificationScreen> createState() => _IdentificationScreenState();
}

class _IdentificationScreenState extends State<IdentificationScreen> {
  static const int rounds = 10;

  final math.Random _rnd = math.Random();
  late final Future<UavRepository> _repoFuture = UavRepository.load(DefaultAssetBundle.of(context));
  UavRepository? _repo;
  IdentLevel? _level;
  int _round = 0;
  int _score = 0;
  _Round? _current;
  String? _answer;
  bool _timedOut = false;
  double _left = 0;
  final List<double> _times = [];
  Timer? _timer;

  double get _roundSeconds => _level == IdentLevel.iq ? 30 : 20;
  bool get _finished => _round >= rounds;
  bool get _revealed => _answer != null || _timedOut;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  List<String> _options(String correct, Iterable<String> pool, [int n = 4]) {
    final others = pool.where((o) => o != correct).toSet().toList()..shuffle(_rnd);
    return [correct, ...others.take(n - 1)]..shuffle(_rnd);
  }

  _Round _build() {
    final repo = _repo!;
    final withViews = repo.profiles.where((p) => p.views.isNotEmpty).toList();
    switch (_level!) {
      case IdentLevel.basic:
        final kind = basicKinds[_rnd.nextInt(basicKinds.length)];
        return _Round(
          answer: kind.title,
          options: _options(kind.title, basicKinds.map((k) => k.title)),
          key: '',
          scene: sceneFor(kind, rng: Rng(_rnd.nextInt(1 << 30))),
        );
      case IdentLevel.single:
      case IdentLevel.noisy:
        final p = withViews[_rnd.nextInt(withViews.length)];
        final view = p.views[_rnd.nextInt(p.views.length)];
        final extra = _level == IdentLevel.noisy ? _civilNoise(view) : const <SignalSpec>[];
        return _Round(
          answer: p.answer,
          options: _options(p.answer, withViews.map((x) => x.answer), 5),
          key: p.key,
          scene: view.scene(extra: extra, seed: _rnd.nextInt(5000)),
          profileId: p.id,
        );
      case IdentLevel.combo:
        final c = repo.combos[_rnd.nextInt(repo.combos.length)];
        return _Round(
          answer: c.label,
          options: _options(c.label, repo.combos.map((x) => x.label)),
          key: c.key,
          scene: c.view.scene(seed: _rnd.nextInt(5000)),
        );
      case IdentLevel.iq:
        final modes = <String, (IqMode, String)>{
          for (final p in repo.profiles)
            for (final m in p.iq) m.label: (m, p.id),
        };
        final labels = modes.keys.toList();
        final label = labels[_rnd.nextInt(labels.length)];
        final (mode, pid) = modes[label]!;
        return _Round(
          answer: label,
          options: _options(label, labels),
          key: mode.note ?? '',
          iqSlots: mode.slots,
          profileId: pid,
        );
    }
  }

  /// Цивільні завади, що потрапляють у смугу огляду.
  List<SignalSpec> _civilNoise(UavView view) {
    final span = view.spanMhz * 1e6;
    final list = <SignalSpec>[];
    final in24 = view.centerMhz > 2390 && view.centerMhz < 2490;
    final count = 2 + _rnd.nextInt(2);
    for (var i = 0; i < count; i++) {
      final off = (_rnd.nextDouble() - 0.5) * span * 0.8;
      final kind = in24
          ? (i.isEven ? SignalKind.wifi : SignalKind.bluetooth)
          : SignalKind.mobileBurst;
      list.add(SignalSpec(
        id: 'noise$i',
        kind: kind,
        offsetHz: kind == SignalKind.bluetooth ? 0 : off,
        powerDbm: kind == SignalKind.wifi ? -82 : -92 - _rnd.nextDouble() * 8,
        seed: _rnd.nextInt(10000),
        params: kind == SignalKind.wifi ? const {'bump': 1, 'notch': 0.12, 'load': 0.15} : const {},
      ));
    }
    return list;
  }

  void _start(IdentLevel level) => setState(() {
        _level = level;
        _round = 0;
        _score = 0;
        _times.clear();
        _newRound();
      });

  void _newRound() {
    _current = _build();
    _answer = null;
    _timedOut = false;
    _left = _roundSeconds;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      setState(() => _left = math.max(0, _left - 0.1));
      if (_left <= 0) _finish(null);
    });
  }

  void _finish(String? choice) {
    if (_revealed) return;
    _timer?.cancel();
    final r = _current!;
    final correct = choice == r.answer;
    setState(() {
      _answer = choice;
      _timedOut = choice == null;
      if (correct) {
        _score++;
        _times.add(_roundSeconds - _left);
      }
    });
    context.read<ProgressService>().recordIdent(r.answer, correct);
  }

  void _next() => setState(() {
        _round++;
        if (!_finished) _newRound();
      });

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: Text(_level == null ? 'Ідентифікація на час' : _level!.title),
          leading: _level == null
              ? null
              : IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() {
                    _timer?.cancel();
                    _level = null;
                  }),
                ),
        ),
        body: FutureBuilder<UavRepository>(
          future: _repoFuture,
          builder: (context, snap) {
            if (!snap.hasData) return const Center(child: CircularProgressIndicator());
            _repo = snap.data;
            if (_level == null) return _levelPicker();
            return _finished ? _summary() : _game();
          },
        ),
      );

  Widget _levelPicker() => ListView(
        padding: const EdgeInsets.all(12),
        children: [
          const Padding(
            padding: EdgeInsets.all(4),
            child: Text('Оберіть рівень складності. 10 раундів, на кожен 20 секунд (IQ — 30 секунд).'),
          ),
          for (final l in IdentLevel.values)
            Card(
              child: ListTile(
                title: Text(l.title),
                subtitle: Text(l.subtitle),
                trailing: const Icon(Icons.play_arrow),
                onTap: () => _start(l),
              ),
            ),
        ],
      );

  Widget _summary() {
    final avg = _times.isEmpty ? 0 : _times.reduce((a, b) => a + b) / _times.length;
    final text = Theme.of(context).textTheme;
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(_score >= 8 ? Icons.emoji_events : Icons.school,
            size: 64, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 12),
        Text('Правильно: $_score з $rounds', style: text.headlineSmall),
        if (_times.isNotEmpty) Text('Середній час правильної відповіді: ${avg.toStringAsFixed(1)} с'),
        const SizedBox(height: 16),
        Wrap(spacing: 8, children: [
          FilledButton.icon(onPressed: () => _start(_level!), icon: const Icon(Icons.replay), label: const Text('Ще раз')),
          OutlinedButton(onPressed: () => setState(() => _level = null), child: const Text('Інший рівень')),
        ]),
      ]),
    );
  }

  Widget _game() {
    final r = _current!;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final scene = r.scene;
    final panel = Padding(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text('Раунд ${_round + 1} з $rounds', style: text.titleSmall),
          const Spacer(),
          Text('Рахунок: $_score'),
        ]),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: _left / _roundSeconds, color: _left < 5 ? scheme.error : scheme.primary),
        if (scene != null) ...[
          const SizedBox(height: 4),
          Text(
            'Огляд: ${(scene.startHz / 1e6).toStringAsFixed(1)}–${(scene.endHz / 1e6).toStringAsFixed(1)} МГц'
            '${scene.timeScale < 1 ? ' · час уповільнено' : ''}',
            style: text.bodySmall,
          ),
        ],
        const SizedBox(height: 10),
        Text(_level == IdentLevel.iq ? 'Що означає така картина таймслотів?' : 'Що це?', style: text.titleMedium),
        const SizedBox(height: 8),
        for (final o in r.options)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                backgroundColor: !_revealed
                    ? null
                    : o == r.answer
                        ? scheme.primaryContainer
                        : o == _answer
                            ? scheme.errorContainer
                            : null,
              ),
              onPressed: _revealed ? null : () => _finish(o),
              child: Text(o, textAlign: TextAlign.center),
            ),
          ),
        if (_revealed) ...[
          Text(
            _answer == r.answer
                ? 'Правильно!'
                : _timedOut
                    ? 'Час вийшов. Правильно: «${r.answer}».'
                    : 'Ні. Правильно: «${r.answer}».',
            style: text.titleSmall,
          ),
          if (r.key.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text('Ключова ознака: ${r.key}'),
          ],
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 6, children: [
            FilledButton.icon(
              onPressed: _next,
              icon: const Icon(Icons.skip_next),
              label: Text(_round + 1 < rounds ? 'Наступний' : 'Результат'),
            ),
            if (r.profileId != null && _repo?.byId(r.profileId!) != null)
              OutlinedButton.icon(
                icon: const Icon(Icons.menu_book),
                label: const Text('Картка'),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) {
                    final p = _repo!.byId(r.profileId!)!;
                    return UavCardScreen(
                      repo: _repo!,
                      profile: p,
                      initialIq: r.iqSlots == null ? -1 : p.iq.indexWhere((m) => m.label == r.answer),
                    );
                  },
                )),
              ),
          ]),
        ],
      ]),
    );
    final visual = scene != null
        ? LiveWaterfall(key: ValueKey('$_level.$_round'), scene: scene, spectrumHeight: 70)
        : Padding(
            padding: const EdgeInsets.all(12),
            child: SingleChildScrollView(child: IqSlotsView(key: ValueKey(_round), slots: r.iqSlots!)),
          );
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth >= 860) {
        return Row(children: [
          Expanded(child: visual),
          const VerticalDivider(width: 1),
          SizedBox(width: 360, child: SingleChildScrollView(child: panel)),
        ]);
      }
      return Column(children: [
        Expanded(child: visual),
        const Divider(height: 1),
        Flexible(child: SingleChildScrollView(child: panel)),
      ]);
    });
  }
}
