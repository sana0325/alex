import 'package:flutter/material.dart';

import 'waterfall_simulator.dart';

class SimulatorScreen extends StatelessWidget {
  const SimulatorScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Симулятор водоспаду'),
          actions: [
            IconButton(
              tooltip: 'Підказка',
              icon: const Icon(Icons.help_outline),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Як користуватися'),
                  content: const Text(
                    'Угорі — водоспад: кожен рядок є спектром у певний момент, '
                    'нові рядки з’являються зверху. Унизу — миттєвий спектр '
                    '(жовто-зелена лінія) та утримання піків (червона).\n\n'
                    'Торкніться або наведіть курсор, щоб побачити частоту й рівень. '
                    'Вмикайте сигнали, змінюйте розмір БПФ, палітру та рівні '
                    'й спостерігайте, як змінюється картинка.\n\n'
                    'Усі сигнали синтетичні й генеруються в застосунку.',
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Зрозуміло'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        body: const WaterfallSimulator(),
      );
}
