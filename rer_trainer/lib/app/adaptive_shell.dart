import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class _Destination {
  const _Destination(this.label, this.icon, this.selectedIcon);

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

const _destinations = [
  _Destination('Головна', Icons.home_outlined, Icons.home),
  _Destination('Модулі', Icons.menu_book_outlined, Icons.menu_book),
  _Destination('Симулятор', Icons.waterfall_chart_outlined, Icons.waterfall_chart),
  _Destination('Тренування', Icons.quiz_outlined, Icons.quiz),
];

/// Оболонка з навігацією: нижня панель на телефоні, бічна — на ПК.
class AdaptiveShell extends StatelessWidget {
  const AdaptiveShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _go(int index) =>
      shell.goBranch(index, initialLocation: index == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 720) {
      return Scaffold(
        body: shell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: shell.currentIndex,
          onDestinationSelected: _go,
          destinations: [
            for (final d in _destinations)
              NavigationDestination(
                icon: Icon(d.icon),
                selectedIcon: Icon(d.selectedIcon),
                label: d.label,
              ),
          ],
        ),
      );
    }
    return Scaffold(
      body: Row(children: [
        NavigationRail(
          extended: width >= 1100,
          selectedIndex: shell.currentIndex,
          onDestinationSelected: _go,
          labelType: width >= 1100
              ? NavigationRailLabelType.none
              : NavigationRailLabelType.all,
          leading: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Icon(Icons.radar,
                size: 32, color: Theme.of(context).colorScheme.primary),
          ),
          destinations: [
            for (final d in _destinations)
              NavigationRailDestination(
                icon: Icon(d.icon),
                selectedIcon: Icon(d.selectedIcon),
                label: Text(d.label),
              ),
          ],
        ),
        const VerticalDivider(width: 1),
        Expanded(child: shell),
      ]),
    );
  }
}
