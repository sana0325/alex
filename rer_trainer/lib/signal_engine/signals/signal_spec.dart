/// Типи синтетичних сигналів.
enum SignalKind { analogFpv, fhssControl, telemetry }

extension SignalKindInfo on SignalKind {
  String get title => switch (this) {
        SignalKind.analogFpv => 'Аналогове FPV-відео',
        SignalKind.fhssControl => 'Керування FHSS',
        SignalKind.telemetry => 'Телеметрія',
      };
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

  /// Додаткові параметри, специфічні для типу (девіація, крок каналів тощо).
  final Map<String, double> params;

  double param(String key, double fallback) => params[key] ?? fallback;

  SignalSpec copyWith({bool? enabled, double? powerDbm, double? offsetHz}) =>
      SignalSpec(
        id: id,
        kind: kind,
        offsetHz: offsetHz ?? this.offsetHz,
        powerDbm: powerDbm ?? this.powerDbm,
        enabled: enabled ?? this.enabled,
        seed: seed,
        params: params,
      );

  @override
  bool operator ==(Object other) =>
      other is SignalSpec &&
      other.id == id &&
      other.kind == kind &&
      other.offsetHz == offsetHz &&
      other.powerDbm == powerDbm &&
      other.enabled == enabled &&
      other.seed == seed;

  @override
  int get hashCode => Object.hash(id, kind, offsetHz, powerDbm, enabled, seed);
}
