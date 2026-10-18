import 'dart:async';
import 'dart:isolate';
import 'dart:typed_data';

import '../scene/scene_config.dart';
import '../spectrum_engine.dart';

/// Керує генератором спектра, що працює в окремому ізоляті.
class EngineHandle {
  EngineHandle._(this._isolate, this._inbox, this._send, this._rows);

  final Isolate _isolate;
  final ReceivePort _inbox;
  final SendPort _send;
  final StreamController<Float32List> _rows;

  Stream<Float32List> get rows => _rows.stream;

  static Future<EngineHandle> spawn(SceneConfig config) async {
    final inbox = ReceivePort();
    final rows = StreamController<Float32List>();
    final ready = Completer<SendPort>();
    inbox.listen((message) {
      if (message is SendPort) {
        ready.complete(message);
      } else if (message is TransferableTypedData && !rows.isClosed) {
        rows.add(message.materialize().asFloat32List());
      }
    });
    final isolate = await Isolate.spawn(
      _engineMain,
      [inbox.sendPort, config],
      debugName: 'signal_engine',
    );
    final send = await ready.future;
    return EngineHandle._(isolate, inbox, send, rows);
  }

  void update(SceneConfig config) => _send.send(config);

  void dispose() {
    _send.send('stop');
    _inbox.close();
    _rows.close();
    _isolate.kill(priority: Isolate.beforeNextEvent);
  }
}

void _engineMain(List<Object> args) {
  final out = args[0] as SendPort;
  var config = args[1] as SceneConfig;
  final inbox = ReceivePort();
  out.send(inbox.sendPort);

  final engine = SpectrumEngine(config);
  Timer? timer;

  void schedule() {
    timer?.cancel();
    if (config.paused) return;
    final period = Duration(microseconds: (1e6 / config.rowsPerSecond).round());
    timer = Timer.periodic(period, (_) {
      final row = engine.nextRow();
      out.send(TransferableTypedData.fromList([row]));
    });
  }

  inbox.listen((message) {
    if (message is SceneConfig) {
      final restart = message.paused != config.paused ||
          message.rowsPerSecond != config.rowsPerSecond;
      config = message;
      engine.configure(message);
      if (restart) schedule();
    } else if (message == 'stop') {
      timer?.cancel();
      inbox.close();
    }
  });
  schedule();
}
