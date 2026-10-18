import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../uav/source_badge.dart';
import '../uav/uav_profile.dart';
import 'df_lab.dart';

/// Таблиця «дБм → відстань, км» з методички (дуже приблизно, похибка ~50 %).
class PowerTable {
  const PowerTable(this.title, this.rows);

  final String title;

  /// (дБм, мінімум км, максимум км), рівні — за спаданням.
  final List<(double, double, double)> rows;

  (double, double) rangeAt(double dbm) {
    if (dbm >= rows.first.$1) return (rows.first.$2, rows.first.$3);
    if (dbm <= rows.last.$1) return (rows.last.$2, rows.last.$3);
    for (var i = 0; i < rows.length - 1; i++) {
      final a = rows[i], b = rows[i + 1];
      if (dbm <= a.$1 && dbm >= b.$1) {
        final t = (a.$1 - dbm) / (a.$1 - b.$1);
        // Відстань змінюється експоненційно з рівнем — інтерполюємо логарифми.
        double lerpLog(double x, double y) => math.exp(math.log(x) + (math.log(y) - math.log(x)) * t);
        return (lerpLog(a.$2, b.$2), lerpLog(a.$3, b.$3));
      }
    }
    return (rows.last.$2, rows.last.$3);
  }
}

const powerTables = [
  PowerTable('Загальна шкала', [
    (-60, 0.03, 0.5), (-70, 0.3, 5), (-80, 3, 10), (-90, 10, 30), (-100, 15, 50), (-110, 30, 70),
  ]),
  PowerTable('Zala', [
    (-80, 3, 5), (-85, 7, 10), (-90, 10, 15), (-95, 15, 25), (-100, 25, 35), (-105, 30, 50), (-110, 45, 70),
  ]),
  PowerTable('Орлан / SuperCam', [
    (-80, 7, 12), (-85, 10, 17), (-90, 15, 25), (-95, 25, 40), (-100, 35, 50), (-105, 45, 65), (-110, 60, 90),
  ]),
  PowerTable('SuperCam-М', [
    (-80, 5, 7), (-85, 7, 12), (-90, 13, 20), (-95, 20, 30), (-100, 30, 40), (-105, 35, 50), (-110, 55, 75),
  ]),
];

/// Модуль 6: дві вкладки — карта пеленгування та оцінка відстані.
class DirectionFindingTools extends StatelessWidget {
  const DirectionFindingTools({super.key});

  @override
  Widget build(BuildContext context) => const DefaultTabController(
        length: 2,
        child: Column(children: [
          TabBar(tabs: [Tab(text: 'Карта пеленгів'), Tab(text: 'Відстань за потужністю')]),
          Expanded(
            child: TabBarView(
              physics: NeverScrollableScrollPhysics(),
              children: [DirectionFindingLab(), DistanceCalculator()],
            ),
          ),
        ]),
      );
}

class DistanceCalculator extends StatefulWidget {
  const DistanceCalculator({super.key});

  @override
  State<DistanceCalculator> createState() => _DistanceCalculatorState();
}

class _DistanceCalculatorState extends State<DistanceCalculator> {
  double _dbm = -95;
  int _table = 1;
  bool _levelWithVideo = false;

  String _km(double v) => v < 1 ? '${(v * 1000).round()} м' : '${v.toStringAsFixed(v < 10 ? 1 : 0)} км';

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final table = powerTables[_table];
    final scm = table.title == 'SuperCam-М';
    final effective = _dbm + (scm && _levelWithVideo ? 10 : 0);
    final (lo, hi) = table.rangeAt(effective);
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 760),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              color: scheme.errorContainer.withValues(alpha: 0.6),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(children: [
                  Icon(Icons.warning_amber, size: 36, color: scheme.error),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'ДУЖЕ ПРИБЛИЗНО: похибка ~50 %. Таблиці орієнтовні — рівень залежить від поляризації, '
                      'антени, видимості, погоди, масштабу огляду й частоти.',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: 12),
            Text('Таблиця', style: text.titleSmall),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (var i = 0; i < powerTables.length; i++)
                ChoiceChip(
                  label: Text(powerTables[i].title),
                  selected: _table == i,
                  onSelected: (_) => setState(() => _table = i),
                ),
            ]),
            const SizedBox(height: 14),
            Text('Рівень телеметрії: ${_dbm.round()} дБм', style: text.titleMedium),
            Slider(value: _dbm, min: -115, max: -55, divisions: 60, onChanged: (v) => setState(() => _dbm = v)),
            if (scm)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Телеметрія на рівні з відео'),
                subtitle: const Text('Для SuperCam-М у такому разі додавати 10 дБм'),
                value: _levelWithVideo,
                onChanged: (v) => setState(() => _levelWithVideo = v),
              ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Text('Орієнтовна відстань', style: text.labelLarge),
                  const SizedBox(height: 4),
                  Text('${_km(lo)} – ${_km(hi)}', style: text.headlineMedium?.copyWith(color: scheme.primary)),
                  if (scm && _levelWithVideo) Text('(розраховано для ${effective.round()} дБм)', style: text.bodySmall),
                ]),
              ),
            ),
            const SizedBox(height: 8),
            Row(children: [
              const Expanded(child: Text('Вимірювати по телеметрії, у вузькому масштабі.')),
              const SourceBadge(FactSource.m),
            ]),
            const SizedBox(height: 16),
            Text('Таблиця «${table.title}»', style: text.titleSmall),
            const SizedBox(height: 6),
            Table(
              border: TableBorder.all(color: scheme.outlineVariant),
              children: [
                const TableRow(children: [
                  Padding(padding: EdgeInsets.all(6), child: Text('дБм', style: TextStyle(fontWeight: FontWeight.bold))),
                  Padding(padding: EdgeInsets.all(6), child: Text('Відстань', style: TextStyle(fontWeight: FontWeight.bold))),
                ]),
                for (final r in table.rows)
                  TableRow(
                    decoration: BoxDecoration(
                      color: (effective - r.$1).abs() < 2.5 ? scheme.primaryContainer.withValues(alpha: 0.5) : null,
                    ),
                    children: [
                      Padding(padding: const EdgeInsets.all(6), child: Text('${r.$1.round()}')),
                      Padding(padding: const EdgeInsets.all(6), child: Text('${_km(r.$2)} – ${_km(r.$3)}')),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Логарифмічна шкала', style: text.titleSmall),
            const SizedBox(height: 4),
            const Text(
              'dBm — логарифмічна величина: +3 дБ ≈ удвічі більша потужність, +10 дБ — у 10 разів. '
              'Тому −87 дБм приблизно вдвічі сильніше за −90 дБм, а −80 дБм — у 10 разів сильніше.',
            ),
            const SizedBox(height: 12),
            Text('Що впливає на потужність', style: text.titleSmall),
            for (final f in const [
              Fact('Поляризація: протилежна дає −20…30 дБм.', FactSource.m),
              Fact('Підсилення антени.', FactSource.m),
              Fact('Пряма видимість, листя, сітки, погода.', FactSource.m),
              Fact('Масштаб огляду: на широкому діапазоні сигнал показується на 5–10 дБм сильнішим.', FactSource.m),
              Fact('Частота: −95 дБм на 2205 МГц — дуже сильний сигнал, на 870 МГц — середній.', FactSource.m),
            ])
              FactTile(f, icon: Icons.tune),
          ],
        ),
      ),
    );
  }
}
