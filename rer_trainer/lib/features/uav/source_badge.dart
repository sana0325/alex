import 'package:flutter/material.dart';

import 'uav_profile.dart';

/// Значок джерела факту: [М], [М?] або [ВД].
class SourceBadge extends StatelessWidget {
  const SourceBadge(this.source, {super.key});

  final FactSource source;

  static Color colorOf(FactSource s) => switch (s) {
        FactSource.m => const Color(0xFF2EBD85),
        FactSource.mUnconfirmed => const Color(0xFFE0A030),
        FactSource.open => const Color(0xFF4A9EE8),
      };

  @override
  Widget build(BuildContext context) {
    final c = colorOf(source);
    return Tooltip(
      message: source.description,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.18),
          border: Border.all(color: c),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(source.badge,
            style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

/// Рядок «факт + значок джерела».
class FactTile extends StatelessWidget {
  const FactTile(this.fact, {super.key, this.icon});

  final Fact fact;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (icon != null) ...[
            Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
          ],
          Expanded(child: Text(fact.text)),
          const SizedBox(width: 6),
          SourceBadge(fact.source),
        ]),
      );
}

/// Легенда значків джерел.
class SourceLegend extends StatelessWidget {
  const SourceLegend({super.key});

  @override
  Widget build(BuildContext context) => Wrap(spacing: 12, runSpacing: 6, children: [
        for (final s in FactSource.values)
          Row(mainAxisSize: MainAxisSize.min, children: [
            SourceBadge(s),
            const SizedBox(width: 4),
            Text(s.description, style: Theme.of(context).textTheme.bodySmall),
          ]),
      ]);
}
