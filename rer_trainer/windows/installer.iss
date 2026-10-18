; Інсталятор РЕР-Тренажера (Inno Setup 6). Встановлює без прав адміністратора.
#define AppName "РЕР-Тренажер"
#define AppVersion "1.0"

[Setup]
AppId={{6E2B7A51-3C4D-4F1B-9A0E-7D5C2B8F1A11}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=РЕР-Тренажер
DefaultDirName={localappdata}\Programs\RER-Trener
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
OutputBaseFilename=RER-Trener-Setup
OutputDir=..\build\installer
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
UninstallDisplayIcon={app}\rer_trainer.exe

[Languages]
Name: "uk"; MessagesFile: "compiler:Languages\Ukrainian.isl"

[Tasks]
Name: "desktopicon"; Description: "Створити ярлик на робочому столі"; GroupDescription: "Ярлики:"

[Files]
Source: "..\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\rer_trainer.exe"
Name: "{group}\Діагностика запуску"; Filename: "{app}\Діагностика.bat"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\rer_trainer.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\rer_trainer.exe"; Description: "Запустити {#AppName}"; Flags: nowait postinstall skipifsilent
