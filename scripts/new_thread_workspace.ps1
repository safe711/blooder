param(
  [Parameter(Mandatory = $true)]
  [string]$Name
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stableDir = Join-Path $root 'code\stable'
$threadsDir = Join-Path $root 'code\threads'
$timeTag = Get-Date -Format 'yyyyMMdd-HHmmss'
$safeName = ($Name -replace '[^a-zA-Z0-9_-]', '_')
$threadId = "$safeName-$timeTag"
$targetDir = Join-Path $threadsDir $threadId

if (-not (Test-Path $stableDir)) {
  throw '未找到 code\stable，请先确保稳定版已生成。'
}
if (Test-Path $targetDir) {
  throw "线程目录已存在：$targetDir"
}

New-Item -ItemType Directory -Path $targetDir | Out-Null
Copy-Item -Path (Join-Path $stableDir '*.js') -Destination $targetDir -Force

$configSource = Join-Path $root 'code\config\upgrade_effects.json'
if (Test-Path $configSource) {
  $configTargetDir = Join-Path $targetDir 'config'
  New-Item -ItemType Directory -Path $configTargetDir -Force | Out-Null
  Copy-Item -Path $configSource -Destination (Join-Path $configTargetDir 'upgrade_effects.json') -Force
}
$templatePath = Join-Path $root 'STYLE_PREVIEW.html'
$raw = Get-Content $templatePath -Raw
$raw = $raw -replace 'code/stable/00_core.js', "code/threads/$threadId/00_core.js"
$raw = $raw -replace 'code/stable/05_heroes.js', "code/threads/$threadId/05_heroes.js"
$raw = $raw -replace 'code/stable/10_world.js', "code/threads/$threadId/10_world.js"
$raw = $raw -replace 'code/stable/20_systems.js', "code/threads/$threadId/20_systems.js"

$outHtml = Join-Path $root ("STYLE_PREVIEW_THREAD_" + $threadId + ".html")
Set-Content -Path $outHtml -Value $raw -Encoding utf8

Write-Output "Created: $targetDir"
Write-Output "Entry:   $outHtml"

