/// Генератор в ізоляті на Android/Windows/Linux і в основному потоці у браузері.
library;

export 'engine_handle_io.dart' if (dart.library.js_interop) 'engine_handle_web.dart';
