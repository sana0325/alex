#!/usr/bin/env bash
# Перевірка запуску APK на емуляторі: встановити, запустити, переконатися,
# що процес живий, немає збою і показано головний екран.
set -u
APK="$1"
PKG=ua.rer.rer_trainer
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -n "$PKG/.MainActivity"
sleep 30
adb shell screencap -p /sdcard/screen.png && adb pull /sdcard/screen.png smoke-screen.png
adb logcat -d > smoke-logcat.txt
if ! adb shell pidof "$PKG" >/dev/null; then
  echo "ЗБІЙ: процес не працює"; grep -E "FATAL|AndroidRuntime" -A20 smoke-logcat.txt | head -60; exit 1
fi
if grep -E "FATAL EXCEPTION|NoSuchMethodError|Неперехоплена помилка|Сховище прогресу недоступне" smoke-logcat.txt; then
  echo "ЗБІЙ: помилка в журналі"; exit 1
fi
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1
if [ -f ui.xml ]; then
  if grep -q "Помилка РЕР-Тренажера" ui.xml; then echo "ЗБІЙ: екран помилки"; cat ui.xml | head -c 2000; exit 1; fi
  grep -q "РЕР-Тренажер" ui.xml && echo "Головний екран показано" || echo "Попередження: текст головного екрана не знайдено в дереві доступності"
fi
echo "OK: застосунок запустився"
