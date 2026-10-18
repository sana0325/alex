import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';

import 'palettes.dart';

/// Приймає рядки спектра (дБм), зберігає історію в кільцевому буфері
/// і перетворює її на зображення водоспаду через decodeImageFromPixels.
class WaterfallController extends ChangeNotifier {
  WaterfallController({this.height = 256});

  /// Кількість рядків історії (висота зображення).
  final int height;

  int _width = 0;
  Float32List _history = Float32List(0);
  Uint8List _rgba = Uint8List(0);
  late Uint32List _pixels = _rgba.buffer.asUint32List();

  /// Індекс найновішого рядка. Рядки пишуться «знизу вгору», тож
  /// від [head] і далі вниз ідуть дедалі старіші.
  int _head = 0;
  int _imageHead = 0;

  Float32List? _latest;
  Float32List? _peak;

  ui.Image? _image;
  bool _decoding = false;
  bool _dirty = false;
  bool _disposed = false;

  WaterfallPalette _palette = WaterfallPalette.classic;
  Uint32List _lut = WaterfallPalette.classic.buildLut();
  double _blackDb = -110;
  double _whiteDb = -55;

  // Лічильники продуктивності.
  int _framesInWindow = 0;
  int _rowsInWindow = 0;
  final Stopwatch _clock = Stopwatch()..start();
  double fps = 0;
  double rowsPerSecond = 0;

  int get width => _width;
  ui.Image? get image => _image;
  int get imageHead => _imageHead;
  Float32List? get latest => _latest;
  Float32List? get peak => _peak;
  WaterfallPalette get palette => _palette;
  double get blackDb => _blackDb;
  double get whiteDb => _whiteDb;

  set palette(WaterfallPalette value) {
    if (value == _palette) return;
    _palette = value;
    _lut = value.buildLut();
    _recolorAll();
  }

  void setLevels(double black, double white) {
    _blackDb = black;
    _whiteDb = math.max(white, black + 1);
    _recolorAll();
  }

  void clearPeak() {
    _peak = null;
    notifyListeners();
  }

  void addRow(Float32List row) {
    if (_disposed) return;
    if (row.length != _width) _resize(row.length);
    _head = (_head - 1 + height) % height;
    _history.setRange(_head * _width, (_head + 1) * _width, row);
    _colorRow(_head);
    _latest = row;
    final peak = _peak;
    if (peak == null || peak.length != row.length) {
      _peak = Float32List.fromList(row);
    } else {
      for (var i = 0; i < row.length; i++) {
        peak[i] = math.max(peak[i] - 0.15, row[i]);
      }
    }
    _rowsInWindow++;
    _requestImage();
  }

  void _resize(int width) {
    _width = width;
    _history = Float32List(width * height)..fillRange(0, width * height, -200);
    _rgba = Uint8List(width * height * 4);
    _pixels = _rgba.buffer.asUint32List();
    _head = 0;
    _peak = null;
    _recolorAll(notify: false);
  }

  void _colorRow(int y) {
    final scale = 255 / (_whiteDb - _blackDb);
    final base = y * _width;
    for (var x = 0; x < _width; x++) {
      final idx = ((_history[base + x] - _blackDb) * scale).round();
      _pixels[base + x] = _lut[idx < 0 ? 0 : (idx > 255 ? 255 : idx)];
    }
  }

  void _recolorAll({bool notify = true}) {
    for (var y = 0; y < height; y++) {
      _colorRow(y);
    }
    if (_width > 0) _requestImage();
    if (notify) notifyListeners();
  }

  void _requestImage() {
    if (_decoding) {
      _dirty = true;
      return;
    }
    _decoding = true;
    final head = _head;
    ui.decodeImageFromPixels(
      _rgba,
      _width,
      height,
      ui.PixelFormat.rgba8888,
      (img) {
        if (_disposed) {
          img.dispose();
          return;
        }
        _image?.dispose();
        _image = img;
        _imageHead = head;
        _decoding = false;
        _framesInWindow++;
        _updateRates();
        notifyListeners();
        if (_dirty) {
          _dirty = false;
          _requestImage();
        }
      },
    );
  }

  void _updateRates() {
    final ms = _clock.elapsedMilliseconds;
    if (ms >= 1000) {
      fps = _framesInWindow * 1000 / ms;
      rowsPerSecond = _rowsInWindow * 1000 / ms;
      _framesInWindow = 0;
      _rowsInWindow = 0;
      _clock.reset();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _image?.dispose();
    _image = null;
    super.dispose();
  }
}
