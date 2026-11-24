# ============================================================
# Sirius IDE - Test Pipeline
# Run: .\scripts\test-pipeline.ps1
# Options: -Watch  (watch mode)
#          -Cover  (coverage)
# ============================================================
param(
  [switch]$Watch,
  [switch]$Cover
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$divider = '=' * 60
$ok = '[  OK  ]'
$fail = '[ FAIL ]'
$info = '[ INFO ]'

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host $divider -ForegroundColor DarkCyan
  Write-Host ("  " + $msg) -ForegroundColor Cyan
  Write-Host $divider -ForegroundColor DarkCyan
}

function Write-Result([bool]$success, [string]$msg) {
  if ($success) {
    Write-Host ("  " + $ok + "  " + $msg) -ForegroundColor Green
  } else {
    Write-Host ("  " + $fail + "  " + $msg) -ForegroundColor Red
  }
}

$totalFailed = 0
$startTime = Get-Date

Write-Host ""
Write-Host "  Sirius IDE - Autotest Pipeline" -ForegroundColor Magenta
Write-Host ("  Started: " + $startTime.ToString('HH:mm:ss')) -ForegroundColor DarkGray

# Step 1: TypeScript
Write-Step "Step 1/3 - TypeScript Build"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$tscOut = & npx tsc --noEmit 2>&1
$tscCode = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($tscCode -ne 0) {
  Write-Host $tscOut -ForegroundColor Yellow
  Write-Result $false "TypeScript compile errors found"
  $totalFailed++
} else {
  Write-Result $true "TypeScript compiles clean"
}

# Step 2: Vitest
Write-Step "Step 2/3 - Unit Tests (Vitest)"

if ($Watch) {
  Write-Host ("  " + $info + "  Watch mode - Ctrl+C to exit") -ForegroundColor Yellow
  & npx vitest
  exit 0
}

$vitestArgs = @('run', '--reporter=verbose')
if ($Cover) { $vitestArgs += '--coverage' }

try {
  & npx vitest @vitestArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Result $false "Some unit tests failed (see above)"
    $totalFailed++
  } else {
    Write-Result $true "All unit tests passed"
  }
} catch {
  Write-Result $false ("Vitest error: " + $_)
  $totalFailed++
}

# Step 3: Static checks
Write-Step "Step 3/3 - Static Checks"

$consoleLogs = Get-ChildItem -Path src -Filter '*.ts' -Recurse |
  Select-String -Pattern 'console\.log' -List
if ($consoleLogs) {
  Write-Host "  [WARN]  console.log found in src/ (FYI):" -ForegroundColor Yellow
  $consoleLogs | ForEach-Object {
    Write-Host ("          " + $_.Path + ":" + $_.LineNumber) -ForegroundColor DarkYellow
  }
} else {
  Write-Result $true "No console.log leaks in src/"
}

$rendererCheckPaths = @(Join-Path $Root 'renderer\app.js')
$jsDir = Join-Path $Root 'renderer\js'
if (Test-Path $jsDir) {
  $rendererCheckPaths += @(Get-ChildItem -Path $jsDir -Filter '*.js' -File |
    ForEach-Object { $_.FullName })
}

$syntaxOk = $true
$checked = 0
foreach ($path in $rendererCheckPaths) {
  if (-not (Test-Path $path)) { continue }
  $checked++
  $rel = $path
  if ($path.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
    $rel = $path.Substring($Root.Length).TrimStart('\', '/')
  }
  $chk = & node --check $path 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("  [FAIL]  Syntax issue in " + $rel) -ForegroundColor Red
    Write-Host ("          " + $chk) -ForegroundColor DarkYellow
    $syntaxOk = $false
    $totalFailed++
  }
}
if ($syntaxOk) {
  Write-Result $true ("Renderer JS syntax OK (" + $checked + " files)")
} else {
  Write-Result $false "Renderer JS syntax errors"
}

$srcMain = Get-Item 'src\main.ts' -ErrorAction SilentlyContinue
$distMain = Get-Item 'dist\main.js' -ErrorAction SilentlyContinue
if ($null -ne $distMain -and $null -ne $srcMain -and ($srcMain.LastWriteTime -gt $distMain.LastWriteTime)) {
  Write-Host "  [WARN]  dist/ may be stale - run npm run build" -ForegroundColor Yellow
} else {
  Write-Result $true "dist/ is up to date"
}

# Summary
$elapsed = (Get-Date) - $startTime
Write-Host ""
Write-Host $divider -ForegroundColor DarkCyan

if ($totalFailed -eq 0) {
  $secs = [math]::Round($elapsed.TotalSeconds, 1)
  Write-Host ("  ALL CHECKS PASSED  (" + $secs + "s)") -ForegroundColor Green
} else {
  $secs = [math]::Round($elapsed.TotalSeconds, 1)
  Write-Host ("  " + $totalFailed + " CHECK(S) FAILED  (" + $secs + "s)") -ForegroundColor Red
}

Write-Host $divider -ForegroundColor DarkCyan
Write-Host ""

exit $totalFailed
