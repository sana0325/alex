import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:rer_trainer/app/app.dart';
import 'package:rer_trainer/services/content_service.dart';
import 'package:rer_trainer/services/progress_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('Головний екран відкривається українською', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final progress = await ProgressService.load();
    await tester.pumpWidget(MultiProvider(
      providers: [
        Provider(create: (_) => ContentService()),
        ChangeNotifierProvider.value(value: progress),
      ],
      child: const RerTrainerApp(),
    ));
    await tester.pumpAndSettle();
    expect(find.text('РЕР-Тренажер'), findsOneWidget);
    expect(find.textContaining('Основи радіо'), findsWidgets);
  });
}
