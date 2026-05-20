$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$readmePath = Join-Path $repoRoot "README.md"
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $envPath)) {
  throw ".env file not found at $envPath"
}

# Minimal .env parser for KEY=VALUE pairs.
$envMap = @{}
Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith("#")) { return }
  $parts = $line -split "=", 2
  if ($parts.Count -eq 2) {
    $envMap[$parts[0].Trim()] = $parts[1].Trim()
  }
}

$username = $envMap["GITHUB_USERNAME"]
$token = $envMap["GITHUB_TOKEN"]

if ($username) {
  $username = $username.Trim().Trim('"').Trim("'")
}

if ($token) {
  $token = $token.Trim().Trim('"').Trim("'")
}

$headers = @{
  Accept = "application/vnd.github+json"
  "User-Agent" = "profile-readme-updater-ps"
}

if ($token) {
  $headers["Authorization"] = "Bearer $token"
}

$profile = $null
$repos = $null

if ($token) {
  # Authenticated path: reliable for private/renamed accounts and avoids anonymous API limits.
  $profile = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
  $username = $profile.login
  $repos = Invoke-RestMethod -Uri "https://api.github.com/user/repos?per_page=100&sort=updated" -Headers $headers
} else {
  if (-not $username) {
    throw "Missing GITHUB_USERNAME in .env"
  }

  $encodedUser = [uri]::EscapeDataString($username)
  $profileUrl = "https://api.github.com/users/$encodedUser"
  $reposUrl = "https://api.github.com/users/$encodedUser/repos?per_page=100&sort=updated"

  try {
    $profile = Invoke-RestMethod -Uri $profileUrl -Headers $headers
    $repos = Invoke-RestMethod -Uri $reposUrl -Headers $headers
  } catch {
    throw "GitHub API returned 404 for username '$username'. Add GITHUB_TOKEN in .env to use authenticated profile lookup."
  }
}
$repos = @($repos | Where-Object { -not $_.fork })

$totalStars = ($repos | Measure-Object -Property stargazers_count -Sum).Sum
if (-not $totalStars) { $totalStars = 0 }

$topRepos = @($repos | Sort-Object stargazers_count -Descending | Select-Object -First 6)
$latestRepos = @($repos | Sort-Object pushed_at -Descending | Select-Object -First 5)

$topRows = if ($topRepos.Count -gt 0) {
  ($topRepos | ForEach-Object {
    $lang = if ($_.language) { $_.language } else { "N/A" }
    $pushed = (Get-Date $_.pushed_at).ToString("yyyy-MM-dd")
    "| [$($_.name)]($($_.html_url)) | $lang | $($_.stargazers_count) | $($_.forks_count) | $pushed |"
  }) -join "`n"
} else {
  "| - | - | - | - | - |"
}

$latestRows = if ($latestRepos.Count -gt 0) {
  ($latestRepos | ForEach-Object {
    $date = (Get-Date $_.pushed_at).ToString("yyyy-MM-dd")
    "- [$($_.name)]($($_.html_url)) - updated $date"
  }) -join "`n"
} else {
  "- No public repositories found"
}

$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd HH:mm")

$section = @"
## Live GitHub Snapshot

<p align="center">
  <img src="https://img.shields.io/badge/Public%20Repos-$($profile.public_repos)-0284c7?style=for-the-badge&logo=github" alt="Public repos" />
  <img src="https://img.shields.io/badge/Followers-$($profile.followers)-16a34a?style=for-the-badge&logo=github" alt="Followers" />
  <img src="https://img.shields.io/badge/Following-$($profile.following)-d97706?style=for-the-badge&logo=github" alt="Following" />
  <img src="https://img.shields.io/badge/Total%20Stars-$totalStars-0f172a?style=for-the-badge&logo=github" alt="Total stars" />
</p>

<p align="center">
  <img src="https://github-readme-stats.vercel.app/api?username=$username&show_icons=true&theme=transparent&hide_border=true&rank_icon=github&include_all_commits=true&count_private=true" alt="Profile summary" />
</p>

> Last refreshed: **$stamp UTC**

### Starred highlights

| Repository | Primary language | Stars | Forks | Last push |
|---|---|---:|---:|---:|
$topRows

### Recently active repositories

$latestRows

### Profile quick links

<p align="center">
  <a href="https://github.com/${username}?tab=repositories"><img src="https://img.shields.io/badge/Explore%20Repos-111827?style=for-the-badge&logo=github" alt="Explore repos" /></a>
  <a href="https://github.com/${username}?tab=stars"><img src="https://img.shields.io/badge/Starred%20Projects-0f766e?style=for-the-badge&logo=github" alt="Starred projects" /></a>
  <a href="https://github.com/${username}?tab=followers"><img src="https://img.shields.io/badge/Connect%20on%20GitHub-1d4ed8?style=for-the-badge&logo=github" alt="Connect on GitHub" /></a>
</p>
"@

$start = "<!-- GITHUB_DYNAMIC_SECTION:START -->"
$end = "<!-- GITHUB_DYNAMIC_SECTION:END -->"

$readme = Get-Content $readmePath -Raw
$block = "$start`n$section`n$end"

$startIndex = $readme.IndexOf($start)
$endIndex = $readme.IndexOf($end)

if ($startIndex -ge 0 -and $endIndex -ge 0 -and $endIndex -gt $startIndex) {
  $endIndex = $endIndex + $end.Length
  $prefix = $readme.Substring(0, $startIndex)
  $suffix = $readme.Substring($endIndex)
  $updated = "$prefix$block$suffix"
} else {
  $updated = "$readme`n`n$block`n"
}

Set-Content -Path $readmePath -Value $updated -Encoding UTF8
Write-Output "README updated successfully from .env using PowerShell."
