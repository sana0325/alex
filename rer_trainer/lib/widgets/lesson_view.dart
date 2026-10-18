import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:provider/provider.dart';

import '../services/content_service.dart';

/// Показує урок із Markdown-файлу в assets.
class LessonView extends StatefulWidget {
  const LessonView({super.key, required this.asset});

  final String asset;

  @override
  State<LessonView> createState() => _LessonViewState();
}

class _LessonViewState extends State<LessonView> {
  late final Future<String> _text =
      context.read<ContentService>().lesson(widget.asset);

  @override
  Widget build(BuildContext context) => FutureBuilder<String>(
        future: _text,
        builder: (context, snap) {
          if (snap.hasError) {
            return Center(child: Text('Не вдалося відкрити урок: ${snap.error}'));
          }
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final theme = Theme.of(context);
          return Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 860),
              child: Markdown(
                data: snap.data!,
                selectable: true,
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 48),
                styleSheet: MarkdownStyleSheet.fromTheme(theme).copyWith(
                  p: theme.textTheme.bodyLarge?.copyWith(height: 1.45),
                  blockquoteDecoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer
                        .withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(8),
                    border: Border(
                        left: BorderSide(
                            color: theme.colorScheme.primary, width: 3)),
                  ),
                  tableBorder: TableBorder.all(
                      color: theme.colorScheme.outlineVariant),
                  tableCellsPadding: const EdgeInsets.all(6),
                ),
              ),
            ),
          );
        },
      );
}
