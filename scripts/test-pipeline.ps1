# ============================================================
# Sirius IDE — Test Pipeline
# Запуск: .\scripts\test-pipeline.ps1
# Опции:  -Watch  (watch-mode, не выходит)
#         -Cover  (собирает coverage)
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
$ok      = '[  OK  ]'
$fail    = '[ FAIL ]'
$info    = '[ INFO ]'

function Write-Step([string]$msg) {
  Write-Host "`n$divider" -ForegroundColor DarkCyan
  Write-Host "  $msg" -ForegroundColor Cyan
  Write-Host $divider -ForegroundColor DarkCyan
}

function Write-Result([bool]$success, [string]$msg) {
  if ($success) {
    Write-Host "  $ok  $msg" -ForegroundColor Green
  } else {
    Write-Host "  $fail  $msg" -ForegroundColor Red
  }
}

$totalFailed = 0
$startTime   = Get-Date

Write-Host "`n  Sirius IDE — Autotest Pipeline" -ForegroundColor Magenta
Write-Host "  Started: $($startTime.ToString('HH:mm:ss'))" -ForegroundColor DarkGray

# ── Step 1: TypeScript compilation ───────────────────────────
Write-Step "Step 1/3 — TypeScript Build"
try {
  $tscOut = & npx tsc --noEmit 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host $tscOut -ForegroundColor Yellow
    Write-Result $false "TypeScript compile errors found"
    $totalFailed++
  } else {
    Write-Result $true "TypeScript compiles clean"
  }
} catch {
  Write-Result $false "tsc failed: $_"
  $totalFailed++
}

# ── Step 2: Unit tests (Vitest) ───────────────────────────────
Write-Step "Step 2/3 — Unit Tests (Vitest)"

if ($Watch) {
  Write-Host "  $info  Watch mode — Ctrl+C to exit" -ForegroundColor Yellow
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
  Write-Result $false "Vitest error: $_"
  $totalFailed++
}

# ── Step 3: Static checks ─────────────────────────────────────
Write-Step "Step 3/3 — Static Checks"

# Check for console.log leaks in production source
$consoleLogs = Get-ChildItem -Path src -Filter '*.ts' -Recurse |
  Select-String -Pattern 'console\.log' -List
if ($consoleLogs) {
  Write-Host "  [WARN]  console.log found in src/ (not a failure, just FYI):" -ForegroundColor Yellow
  $consoleLogs | ForEach-Object { Write-Host "          $($_.Path):$($_.LineNumber)" -ForegroundColor DarkYellow }
} else {
  Write-Result $true "No console.log leaks in src/"
}

# Check renderer JS for obvious syntax issues (node --check)
$rendererFiles = @(
  'renderer\js\utils.js',
  'renderer\js\ai.js',
  'renderer\app.js'
)
$syntaxOk = $true
foreach ($f in $rendererFiles) {
  if (Test-Path $f) {
    $chk = & node --check $f 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Host "  [WARN]  Syntax issue in $f" -ForegroundColor Yellow
      Write-Host "          $chk" -ForegroundColor DarkYellow
      $syntaxOk = $false
    }
  }
}
if ($syntaxOk) {
  Write-Result $true "Renderer JS syntax OK (node --check)"
}

# Check dist/ outputs are up to date
$srcMain  = Get-Item 'src\main.ts'     -ErrorAction SilentlyContinue
$distMain = Get-Item 'dist\main.js'    -ErrorAction SilentlyContinue
if ($distMain -and $srcMain -and ($srcMain.LastWriteTime -gt $distMain.LastWriteTime)) {
  Write-Host "  [WARN]  dist/ may be stale — run npm run build" -ForegroundColor Yellow
} else {
  Write-Result $true "dist/ is up to date"
}

# ── Summary ───────────────────────────────────────────────────
$elapsed = (Get-Date) - $startTime
Write-Host "`n$divider" -ForegroundColor DarkCyan

if ($totalFailed -eq 0) {
  Write-Host "  ALL CHECKS PASSED  ($([math]::Round($elapsed.TotalSeconds,1))s)" -ForegroundColor Green
} else {
  Write-Host "  $totalFailed CHECK(S) FAILED  ($([math]::Round($elapsed.TotalSeconds,1))s)" -ForegroundColor Red
}

Write-Host $divider -ForegroundColor DarkCyan
Write-Host ""

exit $totalFailed
