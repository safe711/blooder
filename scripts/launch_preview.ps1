param(
  [int]$Port = 8080,
  [string]$Page = "STYLE_PREVIEW.html"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverScript = Join-Path $PSScriptRoot "serve_preview.ps1"

function Test-PortOpen([int]$p) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $p, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(150)
    if (-not $ok) {
      $client.Close()
      return $false
    }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Find-AvailablePort([int]$startPort, [int]$maxOffset = 60) {
  for ($offset = 0; $offset -le $maxOffset; $offset += 1) {
    $candidate = $startPort + $offset
    if (-not (Test-PortOpen -p $candidate)) {
      return $candidate
    }
  }
  throw "No available port found in range $startPort..$($startPort + $maxOffset)"
}

if (-not (Test-Path $serverScript)) {
  throw "Missing server script: $serverScript"
}

$targetPort = Find-AvailablePort -startPort $Port
$url = "http://localhost:$targetPort/$Page"

if ($targetPort -ne $Port) {
  Write-Host "Port $Port is busy, using $targetPort instead." -ForegroundColor Yellow
}

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$serverScript`"",
  "-Port", "$targetPort",
  "-Root", "`"$root`""
) -WorkingDirectory $root -WindowStyle Normal | Out-Null

for ($i = 0; $i -lt 40; $i += 1) {
  Start-Sleep -Milliseconds 120
  if (Test-PortOpen -p $targetPort) { break }
}

if (-not (Test-PortOpen -p $targetPort)) {
  Write-Warning "Preview server did not report ready on port $targetPort. Trying to open anyway."
}

try {
  Start-Process $url | Out-Null
} catch {
  try {
    Start-Process "cmd.exe" -ArgumentList "/c", "start", "", $url | Out-Null
  } catch {
    Write-Warning "Failed to auto-open browser. Open this URL manually: $url"
  }
}
