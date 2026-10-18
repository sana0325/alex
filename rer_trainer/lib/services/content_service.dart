import 'dart:convert';

import 'package:flutter/services.dart';

import '../models/quiz.dart';

/// Завантажує уроки (Markdown) і тести (JSON) з assets.
class ContentService {
  ContentService({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;
  final Map<String, Quiz> _quizCache = {};

  Future<String> lesson(String asset) => _bundle.loadString(asset);

  Future<Quiz> quiz(String asset) async {
    final cached = _quizCache[asset];
    if (cached != null) return cached;
    final raw = await _bundle.loadString(asset);
    final quiz = Quiz.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    return _quizCache[asset] = quiz;
  }
}
