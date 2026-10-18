import 'package:flutter/material.dart';

import '../../widgets/live_waterfall.dart';
import 'compare_screen.dart';
import 'iq_slots_view.dart';
import 'source_badge.dart';
import 'uav_atlas.dart';
import 'uav_profile.dart';

/// Картка борту: живий водоспад для кожного каналу, IQ-режим, таблиця,
/// «на що звертати увагу», «з чим можна сплутати».
class UavCardScreen extends StatefulWidget {
  const UavCardScreen({super.key, required this.repo, required this.profile, this.initialIq = -1});

  final UavRepository repo;
  final UavProfile profile;

  /// Номер IQ-режиму, який показати одразу (−1 — водоспад).
  final int initialIq;

  @override
  State<UavCardScreen> createState() => _UavCardScreenState();
}

class _UavCardScreenState extends State<UavCardScreen> {
  int _view = 0;
  late int _iq = widget.initialIq; // -1 — водоспад, інакше номер режиму IQ

  UavProfile get p => widget.profile;

  Widget _visual() {
    if (p.insufficient || p.views.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('Даних про сигнал недостатньо — водоспад не показується.',
              textAlign: TextAlign.center),
        ),
      );
    }
    if (_iq >= 0) {
      final mode = p.iq[_iq];
      return Padding(
        padding: const EdgeInsets.all(12),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(mode.label, style: Theme.of(context).textTheme.titleSmall)),
              SourceBadge(mode.source),
            ]),
            const SizedBox(height: 8),
            IqSlotsView(key: ValueKey(_iq), slots: mode.slots),
            if (mode.note != null) ...[const SizedBox(height: 8), Text(mode.note!)],
          ]),
        ),
      );
    }
    final v = p.views[_view];
    return LiveWaterfall(key: ValueKey('${p.id}.$_view'), scene: v.scene(), spectrumHeight: 70);
  }

  Widget _selector() {
    final roleIcon = {'telemetry': Icons.settings_remote, 'video': Icons.videocam, 'other': Icons.graphic_eq};
    return SizedBox(
      height: 44,
      child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 8), children: [
        for (var i = 0; i < p.views.length; i++)
          Padding(
            padding: const EdgeInsets.only(right: 6, top: 4, bottom: 4),
            child: ChoiceChip(
              avatar: Icon(roleIcon[p.views[i].role] ?? Icons.graphic_eq, size: 16),
              label: Text(p.views[i].title),
              selected: _iq < 0 && _view == i,
              onSelected: (_) => setState(() {
                _view = i;
                _iq = -1;
              }),
            ),
          ),
        for (var i = 0; i < p.iq.length; i++)
          Padding(
            padding: const EdgeInsets.only(right: 6, top: 4, bottom: 4),
            child: ChoiceChip(
              avatar: const Icon(Icons.view_week, size: 16),
              label: Text('IQ: ${p.iq[i].label}'),
              selected: _iq == i,
              onSelected: (_) => setState(() => _iq = i),
            ),
          ),
      ]),
    );
  }

  Widget _info() {
    final text = Theme.of(context).textTheme;
    final scheme = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Text('Дані актуальні на дату методички (28.05.2025); частоти можуть змінюватися.',
            style: text.bodySmall?.copyWith(color: scheme.tertiary)),
        for (final f in p.intro) FactTile(f, icon: Icons.info_outline),
        if (p.key.isNotEmpty) ...[
          const SizedBox(height: 6),
          Card(
            color: scheme.primaryContainer.withValues(alpha: 0.35),
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Row(children: [
                Icon(Icons.key, color: scheme.primary),
                const SizedBox(width: 8),
                Expanded(child: Text('Ключова ознака: ${p.key}')),
              ]),
            ),
          ),
        ],
        if (p.table.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('Параметри', style: text.titleSmall),
          const SizedBox(height: 6),
          for (final r in p.table)
            Card(
              margin: const EdgeInsets.only(bottom: 6),
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(r.channel, style: text.labelLarge)),
                    SourceBadge(r.source),
                  ]),
                  const SizedBox(height: 4),
                  _kv('Діапазон', r.range),
                  _kv('Тип', r.type),
                  _kv('Форма', r.shape),
                  _kv('Ширина', r.width),
                ]),
              ),
            ),
        ],
        if (p.lookFor.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('На що звертати увагу', style: text.titleSmall),
          for (final f in p.lookFor) FactTile(f, icon: Icons.visibility_outlined),
        ],
        if (p.confusedWith.isNotEmpty) ...[
          const SizedBox(height: 10),
          Text('З чим можна сплутати', style: text.titleSmall),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final id in p.confusedWith)
              if (widget.repo.byId(id) case final other?)
                ActionChip(
                  label: Text(other.name),
                  onPressed: () => openUavCard(context, widget.repo, id),
                ),
          ]),
        ],
        if (!p.insufficient) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            icon: const Icon(Icons.compare),
            label: const Text('Порівняти'),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => CompareScreen(
                repo: widget.repo,
                ids: [p.id, ...(p.compareWith.isNotEmpty ? p.compareWith : p.confusedWith).take(1)],
              ),
            )),
          ),
        ],
      ],
    );
  }

  Widget _kv(String k, String v) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: '$k: ', style: const TextStyle(fontWeight: FontWeight.bold)),
          TextSpan(text: v),
        ])),
      );

  @override
  Widget build(BuildContext context) {
    final visual = Column(children: [
      if (!p.insufficient && p.views.isNotEmpty) _selector(),
      Expanded(child: _visual()),
    ]);
    return Scaffold(
      appBar: AppBar(title: Text(p.name)),
      body: LayoutBuilder(builder: (context, c) {
        if (c.maxWidth >= 900) {
          return Row(children: [
            Expanded(flex: 3, child: visual),
            const VerticalDivider(width: 1),
            Expanded(flex: 2, child: _info()),
          ]);
        }
        return Column(children: [
          SizedBox(height: c.maxHeight * (p.insufficient ? 0.15 : 0.45), child: visual),
          const Divider(height: 1),
          Expanded(child: _info()),
        ]);
      }),
    );
  }
}
