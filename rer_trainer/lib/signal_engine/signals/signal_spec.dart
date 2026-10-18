/// Типи синтетичних сигналів.
enum SignalKind {
  analogFpv,
  ofdmVideo,
  fhssControl,
  lora,
  telemetry,
  wifi,
  bluetooth,
  mesh,
}

extension SignalKindInfo on SignalKind {
  String get title => switch (this) {
        SignalKind.analogFpv => 'Аналогове FPV-відео',
        SignalKind.ofdmVideo => 'Цифрове відео (OFDM)',
        SignalKind.fhssControl => 'Керування FHSS',
        SignalKind.lora => 'LoRa (chirp)',
        SignalKind.telemetry => 'Телеметрія',
        SignalKind.wifi => 'Wi-Fi',
        SignalKind.bluetooth => 'Bluetooth',
        SignalKind.mesh => 'Mesh-мережа',
      };
}

/// Режими імітації: як фейковий сигнал відрізняється від справжнього.
enum FakeMode {
  none,

  /// Без завмирань і дрейфу — неприродно стабільний рівень.
  tooStable,

  /// Ідеально рівний період пакетів, без джитера.
  perfectPeriod,

  /// Повтор записаних пакетів: однаковий вміст кожного разу.
  replay,

  /// Ширина смуги не відповідає заявленому типу.
  wrongBandwidth,
}

/// Опис сигналу в сцені. Незмінний, тому його можна безпечно передавати
/// між ізолятами.
class SignalSpec {
  const SignalSpec({
    required this.id,
    required this.kind,
    required this.offsetHz,
    required this.powerDbm,
    this.enabled = true,
    this.seed = 1,
    this.fake = FakeMode.none,
    this.params = const {},
  });

  final String id;
  final SignalKind kind;

  /// Зсув відносно центральної частоти сцени.
  final double offsetHz;

  /// Повна потужність сигналу на вході приймача.
  final double powerDbm;
  final bool enabled;
  final int seed;
  final FakeMode fake;

  /// Додаткові параметри, специфічні для типу (девіація, крок каналів тощо).
  final Map<String, double> params;

  SignalSpec copyWith({
    bool? enabled,
    double? powerDbm,
    double? offsetHz,
    FakeMode? fake,
    Map<String, double>? params,
  }) =>
      SignalSpec(
        id: id,
        kind: kind,
        offsetHz: offsetHz ?? this.offsetHz,
        powerDbm: powerDbm ?? this.powerDbm,
        enabled: enabled ?? this.enabled,
        seed: seed,
        fake: fake ?? this.fake,
        params: params ?? this.params,
      );

  @override
  bool operator ==(Object other) {
    if (other is! SignalSpec ||
        other.id != id ||
        other.kind != kind ||
        other.offsetHz != offsetHz ||
        other.powerDbm != powerDbm ||
        other.enabled != enabled ||
        other.seed != seed ||
        other.fake != fake ||
        other.params.length != params.length) {
      return false;
    }
    for (final e in params.entries) {
      if (other.params[e.key] != e.value) return false;
    }
    return true;
  }

  @override
  int get hashCode =>
      Object.hash(id, kind, offsetHz, powerDbm, enabled, seed, fake);
}
