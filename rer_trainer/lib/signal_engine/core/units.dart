import 'dart:math' as math;

const double speedOfLight = 299792458.0;

double dbmToMw(double dbm) => math.pow(10, dbm / 10).toDouble();

double mwToDbm(double mw) => 10 * math.log(mw <= 0 ? 1e-30 : mw) / math.ln10;

/// Довжина хвилі в метрах для частоти в герцах.
double wavelengthM(double hz) => speedOfLight / hz;

/// Ширина смуги одного біна БПФ з вікном Ганна (еквівалентна шумова смуга).
double rbwHz(double sampleRate, int fftSize) => 1.5 * sampleRate / fftSize;

String formatMhz(double hz, {int digits = 1}) =>
    '${(hz / 1e6).toStringAsFixed(digits)} МГц';
