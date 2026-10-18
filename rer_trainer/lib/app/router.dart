import 'package:go_router/go_router.dart';

import '../features/home/home_screen.dart';
import '../features/modules/module_screen.dart';
import '../features/modules/modules_screen.dart';
import '../features/training/quiz_screen.dart';
import '../features/training/training_screen.dart';
import '../features/waterfall_lab/simulator_screen.dart';
import 'adaptive_shell.dart';

GoRouter buildRouter() => GoRouter(
      initialLocation: '/',
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, shell) => AdaptiveShell(shell: shell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(path: '/', builder: (_, _) => const HomeScreen()),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/modules',
                builder: (_, _) => const ModulesScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, state) =>
                        ModuleScreen(moduleId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/simulator',
                builder: (_, _) => const SimulatorScreen(),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/training',
                builder: (_, _) => const TrainingScreen(),
                routes: [
                  GoRoute(
                    path: 'quiz/:id',
                    builder: (_, state) =>
                        QuizScreen(moduleId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ]),
          ],
        ),
      ],
    );
