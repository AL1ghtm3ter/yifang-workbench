param([string]$OutputPath, [string]$IconPath)
$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path (Split-Path $PSScriptRoot)
if (-not $OutputPath) { $OutputPath = Join-Path $repositoryRoot 'release\windows\YifangWorkbench.exe' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# compiler was not found.' }
New-Item -ItemType Directory -Path (Split-Path ([IO.Path]::GetFullPath($OutputPath))) -Force | Out-Null
$arguments = @('/nologo', '/target:winexe', '/optimize+', '/reference:System.Windows.Forms.dll', '/reference:System.Management.dll', '/reference:System.Web.Extensions.dll', ('/out:' + $OutputPath))
if ($IconPath) { $arguments += '/win32icon:' + (Resolve-Path -LiteralPath $IconPath).Path }
$arguments += Join-Path $PSScriptRoot 'YifangLauncher.cs'
& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Write-Output ('Built ' + $OutputPath)
