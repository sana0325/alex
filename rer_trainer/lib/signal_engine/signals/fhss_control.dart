import 'dart:typed_data';

import '../core/rng.dart';
import 'signal_source.dart';

/// Узагальнений канал зі стрибками частоти (FHSS): короткі вузькосмугові
/// FSK-пакети на псевдовипадкових каналах. З іншими параметрами описує
/// також Bluetooth.
class FhssControlSignal extends SignalSource {
  FhssControlSignal(super.spec, {super.defaults});

  @override
  void synth(Float64List re, Float64List im, double t, double sampleRate) {
    final channels = param('channels', 60).round();
    final spacing = param('spacing', 0.5e6);
    final dwell = param('dwell', 8e-3);
    final airtime = param('airtime', 0.7);
    final period = param('period', 80).round();

    final hop = (t / dwell).floor();
    if (t - hop * dwell > airtime * dwell) return;

    final ch = hashInt(spec.seed, hop % period) % channels;
    final data = dataId(hop);
    addFsk(
      re,
      im,
      t: t - hop * dwell,
      sampleRate: sampleRate,
      amp: amplitude,
      centerHz: spec.offsetHz + (ch - (channels - 1) / 2) * spacing,
      deviation: param('deviation', 120e3) * bandwidthScale,
      symbolRate: param('symbolRate', 250e3),
      bitAt: (sym) => hashInt(data, sym) & 1,
      phase: rng.uniform() * twoPi,
    );
  }
}
