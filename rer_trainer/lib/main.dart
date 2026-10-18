import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app/app.dart';
import 'services/content_service.dart';
import 'services/progress_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final progress = await ProgressService.load();
  runApp(MultiProvider(
    providers: [
      Provider(create: (_) => ContentService()),
      ChangeNotifierProvider.value(value: progress),
    ],
    child: const RerTrainerApp(),
  ));
}
