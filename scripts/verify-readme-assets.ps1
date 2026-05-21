#Requires -Version 5.1
<#
.SYNOPSIS
  Verify profile README SVG assets using GitHub CLI (authenticated API), not anonymous curl.

.EXAMPLE
  ./scripts/verify-readme-assets.ps1
  ./scripts/verify-readme-assets.ps1 -Ref main
#>
param(
  [string] $OwnerRepo = "PRAJWAL-BR-0304/PRAJWAL-BR-0304",
  [string] $Ref = "main"
)

$ErrorActionPreference = "Stop"
$assets = @(
  "orbit-banner.svg",
  "tech-orbit.svg",
  "skill-bars.svg",
  "echo-chase.svg",
  "snake-light.svg",
  "snake-dark.svg"
)

Write-Host "Checking assets on $OwnerRepo @ $Ref via gh api (raw)..." -ForegroundColor Cyan
$failed = 0
foreach ($f in $assets) {
  $raw = gh api "repos/$OwnerRepo/contents/assets/$f`?ref=$Ref" -H "Accept: application/vnd.github.raw" 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL $f — gh api error: $raw" -ForegroundColor Red
    $failed++
    continue
  }
  $head = ($raw | Select-Object -First 1).ToString().TrimStart()
  if (-not $head.StartsWith("<svg")) {
    Write-Host "FAIL $f — response does not start with <svg" -ForegroundColor Red
    $failed++
    continue
  }
  Write-Host "OK   $f" -ForegroundColor Green
}

if ($failed -gt 0) {
  Write-Host "`n$failed file(s) failed. Push to $Ref first if you changed assets." -ForegroundColor Red
  exit 1
}

Write-Host "`nAll $($assets.Count) SVG assets returned valid raw SVG from GitHub." -ForegroundColor Green
exit 0
