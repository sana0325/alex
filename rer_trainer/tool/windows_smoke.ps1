# Перевірка запуску Windows-збірки: розпакувати архів у теку з кирилицею й
# пробілами, запустити, переконатися, що процес живий і не впав.
param([string]$Zip)
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:RUNNER_TEMP "Тест запуску\РЕР Тренажер"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Expand-Archive -Path $Zip -DestinationPath $dir -Force
Get-ChildItem $dir | Format-Table Name, Length
$exe = Join-Path $dir "rer_trainer.exe"
$p = Start-Process -FilePath $exe -WorkingDirectory $dir -PassThru
Start-Sleep -Seconds 25
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
[System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save((Join-Path $env:GITHUB_WORKSPACE "win-screen.png"))
$log = Join-Path $env:TEMP "rer_trainer_error.txt"
if (Test-Path $log) { Write-Host "Журнал помилки:"; Get-Content $log; exit 1 }
if ($p.HasExited) { Write-Host "ЗБІЙ: процес завершився з кодом $($p.ExitCode)"; exit 1 }
Write-Host "OK: процес працює, вікно: '$((Get-Process -Id $p.Id).MainWindowTitle)'"
Stop-Process -Id $p.Id
