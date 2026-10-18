# РЕР-Тренажер

Офлайн навчальний застосунок для підготовки операторів радіоелектронної розвідки. Він вчить читати водоспад і спектрограму, розпізнавати типи сигналів, відрізняти справжні сигнали від імітаційних і розуміти пеленгування.

Застосунок суто навчальний. Усі сигнали синтетичні й генеруються в ньому самому. З реальним радіообладнанням він не працює.

## Збірка

Готові збірки викладає GitHub Actions: вкладка **Actions** → workflow «РЕР-Тренажер — збірка» → потрібний запуск → блок **Artifacts**.

| Артефакт | Вміст |
|---|---|
| `rer-trainer-android-apk` | `app-release.apk` для встановлення на телефон |
| `rer-trainer-windows` | тека з `rer_trainer.exe` |
| `rer-trainer-linux` | тека з виконуваним файлом `rer_trainer` |

Локальна збірка (потрібен Flutter stable):

```bash
cd rer_trainer
flutter pub get
flutter analyze
flutter test
flutter run -d windows        # або linux, або підключений Android
flutter build apk --release
```

## Структура

- `lib/signal_engine/` — генератор синтетичних сигналів на чистому Dart, БПФ, робота в ізоляті.
- `lib/rendering/` — водоспад (кільцевий буфер → `decodeImageFromPixels`), спектр, палітри.
- `lib/features/` — екрани модулів.
- `assets/lessons/*.md` — тексти уроків. Їх можна редагувати без зміни коду.
- `assets/quizzes/*.json` — тести у форматі `{q, options, answer, explain, topic}`.
