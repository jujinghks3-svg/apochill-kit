param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework 4.x C# compiler is required to build the helper.' }
$stage = Join-Path $projectRoot 'deployment/helper-package'
$output = Join-Path $projectRoot 'assets/web/downloads'
New-Item -ItemType Directory -Force $stage,$output | Out-Null
$exe = Join-Path $stage 'Apochill Helper.exe'
& $compiler /nologo /target:winexe /platform:anycpu /optimize+ "/out:$exe" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll (Join-Path $projectRoot 'native/activity-helper/Program.cs')
if ($LASTEXITCODE -ne 0) { throw 'Helper compilation failed.' }
$report = Join-Path $projectRoot 'deployment/helper-self-test.json'
$run = Start-Process -FilePath $exe -ArgumentList ('--self-test "' + $report + '"') -WindowStyle Hidden -Wait -PassThru
if ($run.ExitCode -ne 0) { throw (Get-Content $report -Raw) }
Copy-Item -LiteralPath (Join-Path $projectRoot 'native/activity-helper/README.txt') -Destination (Join-Path $stage '읽어주세요.txt') -Force
$zip = Join-Path $output 'Apochill-Helper-Windows.zip'
Compress-Archive -LiteralPath $exe,(Join-Path $stage '읽어주세요.txt') -DestinationPath $zip -Force
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $output 'Apochill-Helper-Windows.sha256') -Value ($hash + '  Apochill-Helper-Windows.zip') -Encoding ascii
Write-Output ('Helper built and tested: ' + $zip)
Get-Content -LiteralPath $report
