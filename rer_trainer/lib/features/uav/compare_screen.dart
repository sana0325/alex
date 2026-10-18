import 'package:flutter/material.dart';

import '../../widgets/live_waterfall.dart';
import 'uav_profile.dart';

/// Порівняння 2–3 бортів поруч із синхронними водоспадами.
class CompareScreen extends StatefulWidget {
  const CompareScreen({super.key, required this.repo, required this.ids});

  final UavRepository repo;
  final List<String> ids;

  /// Готові пари з методички.
  static const presets = [
    ('Zala vs Ланцет', ['zala', 'lancet_pair']),
    ('SuperCam vs SuperCam-М vs Альбатрос', ['supercam', 'supercam_m', 'albatros']),
    ('Орлан vs мобільний зв\'язок', ['orlan10', 'mobile']),
    ('SuperCam-М vs мобільний телефон', ['supercam_m', 'mobile']),
    ('Zala vs невідомий 900/925', ['zala', 'unk_900_925']),
    ('Орлан vs невідомий 864', ['orlan10', 'unk_864']),
    ('DJI vs Wi-Fi', ['dji', 'wifi']),
  ];

  @override
  State<CompareScreen> createState() => _CompareScreenState();
}

class _Slot {
  _Slot(this.profile);

  UavProfile profile;
  int view = 0;
}

class _CompareScreenState extends State<CompareScreen> {
  late List<_Slot> _slots = _build(widget.ids);
  int _generation = 0;

  List<_Slot> _build(List<String> ids) => [
        for (final id in ids)
          if (widget.repo.byId(id) case final p? when p.views.isNotEmpty) _Slot(p),
      ];

  /// Перезапускає всі водоспади одночасно, щоб вони йшли синхронно.
  void _restart() => setState(() => _generation++);

  Widget _panel(_Slot s, int index) {
    final candidates = widget.repo.profiles.where((p) => p.views.isNotEmpty).toList();
    return Column(children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6),
        child: Row(children: [
          Expanded(
            child: DropdownButton<String>(
              isExpanded: true,
              value: s.profile.id,
              items: [for (final p in candidates) DropdownMenuItem(value: p.id, child: Text(p.name, overflow: TextOverflow.ellipsis))],
              onChanged: (id) => setState(() {
                s.profile = widget.repo.byId(id!)!;
                s.view = 0;
                _generation++;
              }),
            ),
          ),
        ]),
      ),
      SizedBox(
        height: 40,
        child: ListView(scrollDirection: Axis.horizontal, children: [
          for (var i = 0; i < s.profile.views.length; i++)
            Padding(
              padding: const EdgeInsets.all(3),
              child: ChoiceChip(
                label: Text(s.profile.views[i].title, style: const TextStyle(fontSize: 12)),
                selected: s.view == i,
                onSelected: (_) => setState(() {
                  s.view = i;
                  _generation++;
                }),
              ),
            ),
        ]),
      ),
      Expanded(
        child: LiveWaterfall(
          key: ValueKey('$_generation.$index.${s.profile.id}.${s.view}'),
          scene: s.profile.views[s.view].scene(),
          spectrumHeight: 60,
        ),
      ),
    ]);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Порівняння'),
          actions: [
            PopupMenuButton<int>(
              tooltip: 'Готові пари',
              icon: const Icon(Icons.playlist_play),
              itemBuilder: (_) => [
                for (var i = 0; i < CompareScreen.presets.length; i++)
                  PopupMenuItem(value: i, child: Text(CompareScreen.presets[i].$1)),
              ],
              onSelected: (i) => setState(() {
                _slots = _build(CompareScreen.presets[i].$2);
                _generation++;
              }),
            ),
            IconButton(tooltip: 'Синхронний перезапуск', icon: const Icon(Icons.sync), onPressed: _restart),
          ],
        ),
        body: LayoutBuilder(builder: (context, c) {
          final children = [
            for (var i = 0; i < _slots.length; i++) Expanded(child: _panel(_slots[i], i)),
          ];
          return c.maxWidth >= 760 ? Row(children: children) : Column(children: children);
        }),
      );
}
