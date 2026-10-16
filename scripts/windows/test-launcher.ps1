param([Parameter(Mandatory = $true)][string]$InstallRoot)
$ErrorActionPreference = 'Stop'
$install = (Resolve-Path -LiteralPath $InstallRoot).Path
$exe = Join-Path $install '一方工作台.exe'
$pidFile = Join-Path $install '.runtime\server.pid'
function Read-Health { Invoke-RestMethod 'http://127.0.0.1:4591/api/health' -TimeoutSec 3 }
function Invoke-Check([string]$File, [string]$Argument = '--check') {
    $run = Start-Process -FilePath $File -ArgumentList $Argument -WindowStyle Hidden -PassThru
    if (-not $run.WaitForExit(30000)) { throw 'Launcher did not exit within 30 seconds.' }
    return $run.ExitCode
}
function Assert-True([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message }; Write-Output ('PASS: ' + $Message) }
$initial = Read-Health
if ([IO.Path]::GetFullPath($initial.root).TrimEnd('\') -ne (Join-Path $install 'app').TrimEnd('\')) { throw 'The running server belongs to another install; test did not change it.' }
Assert-True ((Invoke-Check $exe) -eq 0) 'existing local server is reused'
Assert-True ((Read-Health).pid -eq $initial.pid) 'repeated launch does not replace the server'
Assert-True ([int](Get-Content -LiteralPath $pidFile -Raw) -eq $initial.pid) 'PID file matches the running server'
[IO.File]::WriteAllText($pidFile, '0')
Assert-True ((Invoke-Check $exe) -eq 0) 'stale PID recovers without a port conflict'
Assert-True ([int](Get-Content -LiteralPath $pidFile -Raw) -eq $initial.pid) 'stale PID was repaired'
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('yifang-launcher-check-' + [guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $fixture | Out-Null
    $foreignExe = Join-Path $fixture '一方工作台.exe'
    Copy-Item -LiteralPath $exe -Destination $foreignExe
    Assert-True ((Invoke-Check $foreignExe) -eq 1) 'different installation refuses ownership'
    [IO.File]::WriteAllText((Join-Path $fixture '.runtime\server.pid'), [string]$initial.pid)
    Invoke-Check $foreignExe '--stop' | Out-Null
    Assert-True ((Read-Health).pid -eq $initial.pid) 'foreign stop with a copied PID leaves the real server running'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixture)
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ($resolvedFixture.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedFixture -Leaf).StartsWith('yifang-launcher-check-')) {
        Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
    } else { throw 'Refused cleanup outside the temporary fixture.' }
}
