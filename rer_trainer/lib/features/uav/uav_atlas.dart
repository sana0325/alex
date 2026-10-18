import 'package:flutter/material.dart';

import 'compare_screen.dart';
import 'source_badge.dart';
import 'uav_card.dart';
import 'uav_profile.dart';

/// Розділ атласу «Ворожі БпЛА»: картки бортів, пасток і невідомих сигналів.
class UavAtlas extends StatefulWidget {
  const UavAtlas({super.key});

  @override
  State<UavAtlas> createState() => _UavAtlasState();
}

class _UavAtlasState extends State<UavAtlas> {
  late final Future<UavRepository> _repo = UavRepository.load(DefaultAssetBundle.of(context));
  UavGroup _group = UavGroup.enemy;

  @override
  Widget build(BuildContext context) => FutureBuilder<UavRepository>(
        future: _repo,
        builder: (context, snap) {
          if (snap.hasError) return Center(child: Text('Помилка даних: ${snap.error}'));
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final repo = snap.data!;
          final items = repo.profiles.where((p) => p.group == _group).toList();
          final text = Theme.of(context).textTheme;
          return ListView(
            padding: const EdgeInsets.all(12),
            children: [
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final g in UavGroup.values)
                  ChoiceChip(
                    label: Text(g.title),
                    selected: g == _group,
                    onSelected: (_) => setState(() => _group = g),
                  ),
                ActionChip(
                  avatar: const Icon(Icons.compare, size: 18),
                  label: const Text('Порівняти'),
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => CompareScreen(repo: repo, ids: const ['zala', 'lancet_pair']),
                  )),
                ),
              ]),
              const SizedBox(height: 10),
              Text('Дані з методички від 28.05.2025; частоти можуть змінюватися.', style: text.bodySmall),
              const SizedBox(height: 6),
              const SourceLegend(),
              const SizedBox(height: 10),
              for (final p in items)
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Icon(switch (p.group) {
                        UavGroup.enemy => Icons.flight,
                        UavGroup.fpvCivil => Icons.toys,
                        UavGroup.trap => Icons.warning_amber,
                        UavGroup.unknown => Icons.help_outline,
                      }),
                    ),
                    title: Text(p.name),
                    subtitle: Text(p.key, maxLines: 3, overflow: TextOverflow.ellipsis),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => openUavCard(context, repo, p.id),
                  ),
                ),
            ],
          );
        },
      );
}

void openUavCard(BuildContext context, UavRepository repo, String id) {
  final p = repo.byId(id);
  if (p == null) return;
  Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => UavCardScreen(repo: repo, profile: p),
  ));
}
