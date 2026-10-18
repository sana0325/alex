import 'dart:convert';

import 'package:flutter/material.dart';

import '../../signal_engine/signal_engine.dart';
import '../../widgets/live_waterfall.dart';

/// Картка атласу, завантажена з assets/atlas/signals.json.
class AtlasEntry {
  const AtlasEntry({
    required this.kind,
    required this.title,
    required this.bandwidth,
    required this.character,
    required this.bands,
    required this.look,
    required this.notes,
  });

  factory AtlasEntry.fromJson(Map<String, dynamic> j) => AtlasEntry(
        kind: SignalKind.values.byName(j['kind'] as String),
        title: j['title'] as String,
        bandwidth: j['bandwidth'] as String,
        character: j['character'] as String,
        bands: j['bands'] as String,
        look: j['look'] as String,
        notes: [for (final n in j['notes'] as List<dynamic>) n as String],
      );

  final SignalKind kind;
  final String title;
  final String bandwidth;
  final String character;
  final String bands;
  final String look;
  final List<String> notes;
}

Future<List<AtlasEntry>> loadAtlas(AssetBundle bundle) async {
  final raw = await bundle.loadString('assets/atlas/signals.json');
  return [
    for (final e in jsonDecode(raw) as List<dynamic>)
      AtlasEntry.fromJson(e as Map<String, dynamic>),
  ];
}

IconData atlasIcon(SignalKind k) => switch (k) {
      SignalKind.analogFpv => Icons.videocam,
      SignalKind.ofdmVideo => Icons.hd,
      SignalKind.fhssControl => Icons.gamepad,
      SignalKind.lora => Icons.show_chart,
      SignalKind.telemetry => Icons.data_usage,
      SignalKind.wifi => Icons.wifi,
      SignalKind.bluetooth => Icons.bluetooth,
      SignalKind.mesh => Icons.hub,
      _ => Icons.sensors,
    };

/// Список карток атласу.
class AtlasBrowser extends StatefulWidget {
  const AtlasBrowser({super.key});

  @override
  State<AtlasBrowser> createState() => _AtlasBrowserState();
}

class _AtlasBrowserState extends State<AtlasBrowser> {
  late final Future<List<AtlasEntry>> _entries =
      loadAtlas(DefaultAssetBundle.of(context));

  @override
  Widget build(BuildContext context) => FutureBuilder<List<AtlasEntry>>(
        future: _entries,
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final entries = snap.data!;
          return GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 420,
              mainAxisExtent: 140,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: entries.length,
            itemBuilder: (context, i) {
              final e = entries[i];
              final scheme = Theme.of(context).colorScheme;
              return Card(
                margin: EdgeInsets.zero,
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => AtlasDetailScreen(entry: e),
                  )),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: scheme.primaryContainer,
                        child: Icon(atlasIcon(e.kind),
                            color: scheme.onPrimaryContainer),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(e.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.titleSmall),
                            const SizedBox(height: 4),
                            Text(e.bandwidth,
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                            Text(e.character,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                    ]),
                  ),
                ),
              );
            },
          );
        },
      );
}

/// Детальна картка: живий синтетичний водоспад і опис ознак.
class AtlasDetailScreen extends StatelessWidget {
  const AtlasDetailScreen({super.key, required this.entry});

  final AtlasEntry entry;

  @override
  Widget build(BuildContext context) {
    final scene = sceneFor(entry.kind);
    final text = Theme.of(context).textTheme;
    final info = ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Field('Ширина смуги', entry.bandwidth, Icons.straighten),
        _Field('Характер', entry.character, Icons.timeline),
        _Field('Типові діапазони', entry.bands, Icons.radio),
        _Field('Як виглядає', entry.look, Icons.visibility),
        const SizedBox(height: 8),
        Text('На що звернути увагу', style: text.titleSmall),
        for (final n in entry.notes)
          ListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.tips_and_updates_outlined),
            title: Text(n),
          ),
        if (scene.timeScale < 1)
          Text(
            'Час у прикладі уповільнено в ${(1 / scene.timeScale).round()} раз(и), '
            'щоб було видно структуру сигналу.',
            style: text.bodySmall,
          ),
      ],
    );
    final waterfall = LiveWaterfall(scene: scene);
    return Scaffold(
      appBar: AppBar(title: Text(entry.title)),
      body: LayoutBuilder(builder: (context, c) {
        if (c.maxWidth >= 900) {
          return Row(children: [
            Expanded(flex: 3, child: waterfall),
            const VerticalDivider(width: 1),
            Expanded(flex: 2, child: info),
          ]);
        }
        return Column(children: [
          SizedBox(height: c.maxHeight * 0.45, child: waterfall),
          const Divider(height: 1),
          Expanded(child: info),
        ]);
      }),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field(this.label, this.value, this.icon);

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label, style: Theme.of(context).textTheme.labelLarge),
              Text(value),
            ]),
          ),
        ]),
      );
}
