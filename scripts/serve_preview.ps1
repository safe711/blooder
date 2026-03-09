param(
  [int]$Port = 8080,
  [string]$Root = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
} else {
  $Root = (Resolve-Path $Root).Path
}

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".js"   { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".css"  { "text/css; charset=utf-8"; break }
    ".png"  { "image/png"; break }
    ".jpg"  { "image/jpeg"; break }
    ".jpeg" { "image/jpeg"; break }
    ".gif"  { "image/gif"; break }
    ".webp" { "image/webp"; break }
    ".svg"  { "image/svg+xml"; break }
    ".ico"  { "image/x-icon"; break }
    default  { "application/octet-stream" }
  }
}

function Write-HttpResponse {
  param(
    [Parameter(Mandatory = $true)][System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [byte[]]$Body,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  if (-not $Body) { $Body = [byte[]]::new(0) }
  $headerText = "HTTP/1.1 $StatusCode $Reason`r`nContent-Length: $($Body.Length)`r`nContent-Type: $ContentType`r`nConnection: close`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($headerText)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Send-TextResponse {
  param(
    [Parameter(Mandatory = $true)][System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [string]$Text
  )
  $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
  Write-HttpResponse -Stream $Stream -StatusCode $StatusCode -Reason $Reason -Body $bytes -ContentType "text/plain; charset=utf-8"
}

$ip = [System.Net.IPAddress]::Loopback
$listener = [System.Net.Sockets.TcpListener]::new($ip, $Port)
$listener.Start()

$prefix = "http://localhost:$Port/"
Write-Host "Preview server started: $prefix" -ForegroundColor Green
Write-Host "Root: $Root" -ForegroundColor DarkGray
Write-Host "Open in browser:" -ForegroundColor Cyan
Write-Host "  $prefix`STYLE_PREVIEW.html"
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

while ($true) {
  $client = $null
  $stream = $null
  $reader = $null
  try {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 8192, $true)

    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      continue
    }

    while ($true) {
      $line = $reader.ReadLine()
      if ([string]::IsNullOrEmpty($line)) { break }
    }

    $parts = $requestLine.Split(' ')
    if ($parts.Length -lt 2) {
      Send-TextResponse -Stream $stream -StatusCode 400 -Reason "Bad Request" -Text "400 Bad Request"
      continue
    }

    $method = $parts[0].ToUpperInvariant()
    $target = $parts[1]
    if ($method -ne "GET" -and $method -ne "HEAD") {
      Send-TextResponse -Stream $stream -StatusCode 405 -Reason "Method Not Allowed" -Text "405 Method Not Allowed"
      continue
    }

    $rawPath = $target.Split('?')[0]
    if ([string]::IsNullOrWhiteSpace($rawPath) -or $rawPath -eq "/") {
      $rawPath = "/STYLE_PREVIEW.html"
    }

    try {
      $decodedPath = [System.Uri]::UnescapeDataString($rawPath)
    } catch {
      Send-TextResponse -Stream $stream -StatusCode 400 -Reason "Bad Request" -Text "400 Bad Request"
      continue
    }

    $relPath = $decodedPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
    $fullPath = [IO.Path]::GetFullPath((Join-Path $Root $relPath))

    if (-not $fullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-TextResponse -Stream $stream -StatusCode 403 -Reason "Forbidden" -Text "403 Forbidden"
      continue
    }

    if (Test-Path $fullPath -PathType Container) {
      $fullPath = Join-Path $fullPath "index.html"
    }

    if (-not (Test-Path $fullPath -PathType Leaf)) {
      Send-TextResponse -Stream $stream -StatusCode 404 -Reason "Not Found" -Text "404 Not Found"
      continue
    }

    $data = [IO.File]::ReadAllBytes($fullPath)
    if ($method -eq "HEAD") {
      Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body ([byte[]]::new(0)) -ContentType (Get-ContentType $fullPath)
    } else {
      Write-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -Body $data -ContentType (Get-ContentType $fullPath)
    }
  } catch {
    if ($stream) {
      try {
        Send-TextResponse -Stream $stream -StatusCode 500 -Reason "Internal Server Error" -Text "500 Internal Server Error"
      } catch {}
    }
  } finally {
    if ($reader) { $reader.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($client) { $client.Close() }
  }
}
