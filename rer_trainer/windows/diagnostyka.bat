@echo off
chcp 65001 >nul
rem Діагностика запуску РЕР-Тренажера: створює звіт diagnostyka.txt поруч із програмою.
cd /d "%~dp0"
set R=%~dp0diagnostyka.txt
echo === РЕР-Тренажер: діагностика === > "%R%"
echo Дата: %DATE% %TIME% >> "%R%"
echo Тека: %~dp0 >> "%R%"
echo. >> "%R%"
echo --- Windows --- >> "%R%"
ver >> "%R%"
echo Розрядність процесора: %PROCESSOR_ARCHITECTURE% %PROCESSOR_ARCHITEW6432% >> "%R%"
powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem | Select Caption,Version,OSArchitecture | Format-List | Out-String).Trim()" >> "%R%" 2>&1
echo. >> "%R%"
echo --- Відеокарта --- >> "%R%"
powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController | Select Name,DriverVersion | Format-List | Out-String).Trim()" >> "%R%" 2>&1
echo. >> "%R%"
echo --- Файли програми --- >> "%R%"
if exist rer_trainer.exe (echo rer_trainer.exe: є >> "%R%") else (echo rer_trainer.exe: НЕМАЄ - архів не розпаковано повністю >> "%R%")
if exist flutter_windows.dll (echo flutter_windows.dll: є >> "%R%") else (echo flutter_windows.dll: НЕМАЄ >> "%R%")
if exist data\flutter_assets (echo data\flutter_assets: є >> "%R%") else (echo data\flutter_assets: НЕМАЄ >> "%R%")
if exist vcruntime140.dll (echo vcruntime140.dll: є >> "%R%") else (echo vcruntime140.dll: НЕМАЄ >> "%R%")
echo. >> "%R%"
echo --- Запуск (чекаємо 20 секунд) --- >> "%R%"
del "%TEMP%\rer_trainer_error.txt" >nul 2>&1
powershell -NoProfile -Command "$p = Start-Process -FilePath '.\rer_trainer.exe' -PassThru; Start-Sleep 20; if ($p.HasExited) { 'Програма завершилася, код: ' + $p.ExitCode + ' (0x' + $p.ExitCode.ToString('X') + ')' } else { 'Програма працює. Вікно: ' + (Get-Process -Id $p.Id).MainWindowTitle }" >> "%R%" 2>&1
echo. >> "%R%"
echo --- Журнал помилки запуску --- >> "%R%"
if exist "%TEMP%\rer_trainer_error.txt" (type "%TEMP%\rer_trainer_error.txt" >> "%R%") else (echo немає >> "%R%")
echo. >> "%R%"
echo --- Останні збої в журналі Windows --- >> "%R%"
powershell -NoProfile -Command "Get-WinEvent -FilterHashtable @{LogName='Application'; Id=1000,1001; StartTime=(Get-Date).AddMinutes(-5)} -ErrorAction SilentlyContinue | Where-Object { $_.Message -like '*rer_trainer*' } | Select -First 3 | ForEach-Object { $_.Message }" >> "%R%" 2>&1
start "" notepad "%R%"
