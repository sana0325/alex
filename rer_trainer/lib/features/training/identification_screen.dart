import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/progress_service.dart';
import '../../signal_engine/signal_engine.dart';
import '../../widgets/live_waterfall.dart';

/// Режим «Ідентифікація»: випадковий синтетичний водоспад — визначити тип
/// сигналу, поки не сплив час.
class IdentificationScreen extends StatefulWidget {
  const IdentificationScreen({super.key});

  @override
  State<IdentificationScreen> createState() => _IdentificationScreenState();
}

class _IdentificationScreenState extends State<IdentificationScreen> {
  static const int rounds = 10;
  static const double secondsPerRound = 20;

  final math.Random _rnd = math.Random();
  int _round = 0;
  int _score = 0;
  late SignalKind _kind;
  late SceneConfig _scene;
  late List<SignalKind> _options;
  SignalKind? _answer;
  bool _timedOut = false;
  double _left = secondsPerRound;
  final List<double> _times = [];
  Timer? _timer;

  bool get _finished => _round >= rounds;
  bool get _revealed => _answer != null || _timedOut;

  @override
  void initState() {
    super.initState();
    _newRound();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _newRound() {
    _kind = SignalKind.values[_rnd.nextInt(SignalKind.values.length)];
    _scene = sceneFor(_kind, rng: Rng(_rnd.nextInt(1 << 30)));
    final others = SignalKind.values.where((k) => k != _kind).toList()..shuffle(_rnd);
    _options = [_kind, ...others.take(3)]..shuffle(_rnd);
    _answer = null;
    _timedOut = false;
    _left = secondsPerRound;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 100), (_) {
      setState(() => _left = math.max(0, _left - 0.1));
      if (_left <= 0) _finish(null);
    });
  }

  void _finish(SignalKind? choice) {
    if (_revealed) return;
    _timer?.cancel();
    final correct = choice == _kind;
    setState(() {
      _answer = choice;
      _timedOut = choice == null;
      if (correct) {
        _score++;
        _times.add(secondsPerRound - _left);
      }
    });
    context.read<ProgressService>().recordIdent(_kind.title, correct);
  }

  void _next() => setState(() {
        _round++;
        if (!_finished) _newRound();
      });

  void _restart() => setState(() {
        _round = 0;
        _score = 0;
        _times.clear();
        _newRound();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ідентифікація на час')),
      body: _finished ? _summary() : _game(),
    );
  }

  Widget _summary() {
    final avg = _times.isEmpty ? 0 : _times.reduce((a, b) => a + b) / _times.length;
    final text = Theme.of(context).textTheme;
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(_score >= 8 ? Icons.emoji_events : Icons.school,
            size: 64, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 12),
        Text('Правильно: $_score з $rounds', style: text.headlineSmall),
        if (_times.isNotEmpty)
          Text('Середній час правильної відповіді: ${avg.toStringAsFixed(1)} с'),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: _restart,
          icon: const Icon(Icons.replay),
          label: const Text('Ще раз'),
        ),
      ]),
    );
  }

  Widget _game() {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final panel = Padding(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Text('Раунд ${_round + 1} з $rounds', style: text.titleSmall),
          const Spacer(),
          Text('Рахунок: $_score'),
        ]),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: _left / secondsPerRound,
          color: _left < 5 ? scheme.error : scheme.primary,
        ),
        const SizedBox(height: 4),
        Text(
          'Діапазон: ${(_scene.startHz / 1e6).toStringAsFixed(1)}–${(_scene.endHz / 1e6).toStringAsFixed(1)} МГц'
          '${_scene.timeScale < 1 ? ' · час уповільнено' : ''}',
          style: text.bodySmall,
        ),
        const SizedBox(height: 10),
        Text('Який це сигнал?', style: text.titleMedium),
        const SizedBox(height: 8),
        for (final k in _options)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                backgroundColor: !_revealed
                    ? null
                    : k == _kind
                        ? scheme.primaryContainer
                        : k == _answer
                            ? scheme.errorContainer
                            : null,
              ),
              onPressed: _revealed ? null : () => _finish(k),
              child: Text(k.title),
            ),
          ),
        if (_revealed) ...[
          const SizedBox(height: 4),
          Text(
            _answer == _kind
                ? 'Правильно!'
                : _timedOut
                    ? 'Час вийшов. Це був сигнал «${_kind.title}».'
                    : 'Ні, це «${_kind.title}».',
            style: text.titleSmall,
          ),
          const SizedBox(height: 8),
          FilledButton.icon(
            onPressed: _next,
            icon: const Icon(Icons.skip_next),
            label: Text(_round + 1 < rounds ? 'Наступний' : 'Результат'),
          ),
        ],
      ]),
    );
    final waterfall = LiveWaterfall(key: ValueKey(_round), scene: _scene, spectrumHeight: 70);
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth >= 860) {
        return Row(children: [
          Expanded(child: waterfall),
          const VerticalDivider(width: 1),
          SizedBox(width: 340, child: SingleChildScrollView(child: panel)),
        ]);
      }
      return Column(children: [
        Expanded(child: waterfall),
        const Divider(height: 1),
        SingleChildScrollView(child: panel),
      ]);
    });
  }
}
