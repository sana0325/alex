import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../signal_engine/core/units.dart';

/// Інтерактив модуля «Основи радіо»: довжина хвилі, dBm ↔ мВт, SNR.
class RadioCalculator extends StatefulWidget {
  const RadioCalculator({super.key});

  @override
  State<RadioCalculator> createState() => _RadioCalculatorState();
}

class _RadioCalculatorState extends State<RadioCalculator> {
  double _freqMhz = 2400;
  double _dbm = -60;
  double _signalDbm = -70;
  double _noiseDbm = -95;

  static const _bands = [433.0, 868.0, 915.0, 1280.0, 2400.0, 5800.0];

  String _formatPower(double mw) {
    if (mw >= 1000) return '${(mw / 1000).toStringAsFixed(2)} Вт';
    if (mw >= 1) return '${mw.toStringAsFixed(2)} мВт';
    if (mw >= 1e-3) return '${(mw * 1e3).toStringAsFixed(2)} мкВт';
    if (mw >= 1e-6) return '${(mw * 1e6).toStringAsFixed(2)} нВт';
    if (mw >= 1e-9) return '${(mw * 1e9).toStringAsFixed(2)} пВт';
    return '${(mw * 1e12).toStringAsFixed(2)} фВт';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final lambda = wavelengthM(_freqMhz * 1e6);
    final snr = _signalDbm - _noiseDbm;
    final snrText = snr < 0
        ? 'сигнал нижче шуму — на водоспаді його майже не видно'
        : snr < 6
            ? 'ледь помітний, легко сплутати з шумом'
            : snr < 15
                ? 'помітний, але деталі розмиті'
                : 'чітко видимий';
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Section(
              title: 'Частота → довжина хвилі',
              children: [
                Text('${_freqMhz.toStringAsFixed(0)} МГц',
                    style: theme.textTheme.headlineSmall),
                Slider(
                  value: math.log(_freqMhz),
                  min: math.log(100),
                  max: math.log(6000),
                  onChanged: (v) => setState(() => _freqMhz = math.exp(v)),
                ),
                Wrap(spacing: 6, children: [
                  for (final b in _bands)
                    ActionChip(
                      label: Text(b >= 1000
                          ? '${(b / 1000).toStringAsFixed(b == 1280 ? 2 : 1)} ГГц'
                          : '${b.round()} МГц'),
                      onPressed: () => setState(() => _freqMhz = b),
                    ),
                ]),
                const SizedBox(height: 8),
                Text(
                  'λ = c / f = ${lambda >= 1 ? '${lambda.toStringAsFixed(2)} м' : '${(lambda * 100).toStringAsFixed(1)} см'}'
                  '  ·  чвертьхвильова антена ≈ ${(lambda * 25).toStringAsFixed(1)} см',
                ),
              ],
            ),
            _Section(
              title: 'dBm ↔ потужність',
              children: [
                Text('${_dbm.toStringAsFixed(0)} дБм = ${_formatPower(dbmToMw(_dbm))}',
                    style: theme.textTheme.headlineSmall),
                Slider(
                  value: _dbm,
                  min: -120,
                  max: 40,
                  divisions: 160,
                  onChanged: (v) => setState(() => _dbm = v),
                ),
                const Text(
                    '0 дБм = 1 мВт. Кожні +10 дБ — потужність у 10 разів більша, '
                    '+3 дБ — приблизно вдвічі.'),
              ],
            ),
            _Section(
              title: 'Відношення сигнал/шум (SNR)',
              children: [
                Text('Сигнал: ${_signalDbm.round()} дБм'),
                Slider(
                  value: _signalDbm,
                  min: -120,
                  max: -30,
                  divisions: 90,
                  onChanged: (v) => setState(() => _signalDbm = v),
                ),
                Text('Шумовий поріг: ${_noiseDbm.round()} дБм'),
                Slider(
                  value: _noiseDbm,
                  min: -120,
                  max: -60,
                  divisions: 60,
                  onChanged: (v) => setState(() => _noiseDbm = v),
                ),
                _SnrBar(signal: _signalDbm, noise: _noiseDbm),
                const SizedBox(height: 8),
                Text('SNR = ${snr.toStringAsFixed(0)} дБ — $snrText',
                    style: theme.textTheme.titleMedium),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              ...children,
            ],
          ),
        ),
      );
}

/// Наочна шкала: шумова «трава» і пік сигналу над нею.
class _SnrBar extends StatelessWidget {
  const _SnrBar({required this.signal, required this.noise});

  final double signal;
  final double noise;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 90,
        width: double.infinity,
        child: CustomPaint(
          painter: _SnrPainter(signal, noise, Theme.of(context).colorScheme),
        ),
      );
}

class _SnrPainter extends CustomPainter {
  _SnrPainter(this.signal, this.noise, this.scheme);

  final double signal;
  final double noise;
  final ColorScheme scheme;

  @override
  void paint(Canvas canvas, Size size) {
    const minDb = -125.0, maxDb = -25.0;
    double y(double db) => size.height * (1 - (db - minDb) / (maxDb - minDb));
    canvas.drawRect(Offset.zero & size, Paint()..color = Colors.black);
    final path = Path()..moveTo(0, y(noise));
    final rnd = math.Random(3);
    for (var x = 0.0; x <= size.width; x += 3) {
      final center = size.width / 2;
      final peak = math.exp(-math.pow((x - center) / 14, 2));
      final lin = math.pow(10, noise / 10) * (0.4 + rnd.nextDouble() * 1.2) +
          math.pow(10, signal / 10) * peak;
      path.lineTo(x, y(10 * math.log(lin) / math.ln10));
    }
    canvas.drawPath(
        path,
        Paint()
          ..color = scheme.primary
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5);
    final dash = Paint()
      ..color = scheme.error
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, y(noise)), Offset(size.width, y(noise)), dash);
  }

  @override
  bool shouldRepaint(_SnrPainter old) =>
      old.signal != signal || old.noise != noise;
}
