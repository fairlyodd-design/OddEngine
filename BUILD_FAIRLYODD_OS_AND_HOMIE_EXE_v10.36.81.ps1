$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$launcher = Join-Path $root "RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat"
if (!(Test-Path $launcher)) {
  throw "Missing $launcher"
}

$iexpress = Join-Path $env:WINDIR "System32\iexpress.exe"
if (!(Test-Path $iexpress)) {
  throw "IExpress not found at $iexpress"
}

$work = Join-Path $root "build\fairlyodd_os_homie_launcher_v10.36.81"
New-Item -ItemType Directory -Force -Path $work | Out-Null

Copy-Item -Force $launcher (Join-Path $work "RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat")

$target = Join-Path $root "FairlyOdd_OS_and_Homie_v10.36.81.exe"
$sed = Join-Path $work "fairlyodd_os_homie_launcher_v10.36.81.sed"

$sedBody = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=0
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=
DisplayLicense=
FinishMessage=FairlyOdd launcher EXE was created and run target is bundled.
TargetName=$target
FriendlyName=FairlyOdd OS and Homie Launcher
AppLaunched=RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=
SourceFiles=SourceFiles
[SourceFiles]
SourceFiles0=$work
[SourceFiles0]
%FILE0%=

[Strings]
FILE0=RUN_FAIRLYODD_OS_AND_HOMIE_v10.36.81.bat
"@

Set-Content -Path $sed -Value $sedBody -Encoding ASCII

Write-Host "Building EXE with IExpress..."
& $iexpress /N $sed | Out-Null

if (!(Test-Path $target)) {
  throw "EXE was not created: $target"
}

Write-Host ""
Write-Host "Built:"
Write-Host $target
