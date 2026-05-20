const fs = require("fs");
const path = require("path");
require("dotenv").config();

const readmePath = path.join(process.cwd(), "README.md");

const envUsername = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-readme-updater",
};

if (token) {
  headers.Authorization = `Bearer ${token}`;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }
  return response.json();
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

function languagePill(language) {
  if (!language) return "N/A";
  return `![${language}](https://img.shields.io/badge/${encodeURIComponent(language)}-111827?style=flat-square)`;
}

function escapeShieldMessage(value) {
  return String(value).replace(/-/g, "--");
}

function renderMetrics(profile, username, totalStars) {
  return [
    "<p align=\"center\">",
    `  <a href=\"https://github.com/${username}\"><img src=\"https://komarev.com/ghpvc/?username=${encodeURIComponent(
      username,
    )}&label=Profile%20views&color=8A2BE2&style=for-the-badge\" alt=\"Profile views\" /></a>`,
    `  <a href=\"https://github.com/${username}?tab=followers\"><img src=\"https://img.shields.io/badge/Followers-${profile.followers}-1E90FF?style=for-the-badge&logo=github\" alt=\"Followers\" /></a>`,
    `  <a href=\"https://github.com/${username}?tab=repositories\"><img src=\"https://img.shields.io/badge/Public%20Repos-${profile.public_repos}-00C9FF?style=for-the-badge&logo=github\" alt=\"Public repos\" /></a>`,
    `  <img src=\"https://img.shields.io/badge/Total%20Stars-${totalStars}-8A2BE2?style=for-the-badge&logo=github\" alt=\"Total stars\" />`,
    `  <img src=\"https://img.shields.io/badge/Open%20to-Collab-success?style=for-the-badge&logo=handshake&logoColor=white&color=22C55E\" alt=\"Open to collab\" />`,
    "</p>",
    "",
  ].join("\n");
}

function renderMilestones(profile, topRepos, latestRepos) {
  const joinedYear = new Date(profile.created_at).getFullYear();

  if (topRepos.length > 0 && latestRepos.length > 0) {
    const top = topRepos[0];
    const latest = latestRepos[0];
    return [
      "<p align=\"center\">",
      `  <img src=\"https://img.shields.io/badge/Member%20since-${joinedYear}-161b22?style=for-the-badge&logo=github&logoColor=white\" alt=\"Member since\" />`,
      `  <a href=\"${top.html_url}\"><img src=\"https://img.shields.io/badge/Top%20repo-${escapeShieldMessage(
        top.name,
      )}-8A2BE2?style=for-the-badge&logo=github\" alt=\"Top repository\" /></a>`,
      `  <a href=\"${latest.html_url}\"><img src=\"https://img.shields.io/badge/Latest%20ship-${escapeShieldMessage(
        latest.name,
      )}-00C9FF?style=for-the-badge&logo=github\" alt=\"Latest push\" /></a>`,
      "</p>",
      "",
    ].join("\n");
  }

  return [
    "<p align=\"center\">",
    `  <img src=\"https://img.shields.io/badge/Member%20since-${joinedYear}-161b22?style=for-the-badge&logo=github&logoColor=white\" alt=\"Member since\" />`,
    "</p>",
    "",
  ].join("\n");
}

function renderSection(profile, repos) {
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const topRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6);

  const latestRepos = [...repos]
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .slice(0, 5);

  const rowsTop = topRepos
    .map((repo) => {
      return `| [${repo.name}](${repo.html_url}) | ${languagePill(repo.language)} | ${repo.stargazers_count} | ${repo.forks_count} | ${formatDate(repo.pushed_at)} |`;
    })
    .join("\n");

  const rowsLatest = latestRepos
    .map((repo) => {
      return `- [${repo.name}](${repo.html_url}) - updated ${formatDate(repo.pushed_at)}`;
    })
    .join("\n");

  return [
    "## Live GitHub Snapshot",
    "",
    "<p align=\"center\">",
    `  <img src=\"https://img.shields.io/badge/Public%20Repos-${profile.public_repos}-0284c7?style=for-the-badge&logo=github\" alt=\"Public repos\" />`,
    `  <img src=\"https://img.shields.io/badge/Followers-${profile.followers}-16a34a?style=for-the-badge&logo=github\" alt=\"Followers\" />`,
    `  <img src=\"https://img.shields.io/badge/Following-${profile.following}-d97706?style=for-the-badge&logo=github\" alt=\"Following\" />`,
    `  <img src=\"https://img.shields.io/badge/Total%20Stars-${totalStars}-0f172a?style=for-the-badge&logo=github\" alt=\"Total stars\" />`,
    "</p>",
    "",
    "<p align=\"center\">",
    `  <img src=\"https://readme-stats-github.vercel.app/api?username=${encodeURIComponent(
      profile.login,
    )}&show_icons=true&theme=transparent&hide_border=true&rank_icon=github&include_all_commits=true&count_private=true\" alt=\"Profile summary\" />`,
    "</p>",
    "",
    `> Last refreshed: **${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC**`,
    "",
    "### Starred highlights",
    "",
    "| Repository | Primary language | Stars | Forks | Last push |",
    "|---|---|---:|---:|---:|",
    rowsTop || "| - | - | - | - | - |",
    "",
    "### Recently active repositories",
    "",
    rowsLatest || "- No public repositories found",
    "",
    "### Profile quick links",
    "",
    "<p align=\"center\">",
    `  <a href=\"https://github.com/${profile.login}?tab=repositories\"><img src=\"https://img.shields.io/badge/Explore%20Repos-111827?style=for-the-badge&logo=github\" alt=\"Explore repos\" /></a>`,
    `  <a href=\"https://github.com/${profile.login}?tab=stars\"><img src=\"https://img.shields.io/badge/Starred%20Projects-0f766e?style=for-the-badge&logo=github\" alt=\"Starred projects\" /></a>`,
    `  <a href=\"https://github.com/${profile.login}?tab=followers\"><img src=\"https://img.shields.io/badge/Connect%20on%20GitHub-1d4ed8?style=for-the-badge&logo=github\" alt=\"Connect on GitHub\" /></a>`,
    "</p>",
    "",
  ].join("\n");
}

function replaceBlock(readme, startMarker, endMarker, inner) {
  const block = `${startMarker}\n${inner}\n${endMarker}`;
  if (!readme.includes(startMarker) || !readme.includes(endMarker)) {
    return readme;
  }

  const pattern = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "m");
  return readme.replace(pattern, block);
}

function updateReadme(sectionContent, metricsContent, milestonesContent) {
  let readme = fs.readFileSync(readmePath, "utf8");

  readme = replaceBlock(readme, "<!-- GITHUB_DYNAMIC_SECTION:START -->", "<!-- GITHUB_DYNAMIC_SECTION:END -->", sectionContent);
  readme = replaceBlock(readme, "<!-- PROFILE_METRICS_BADGES:START -->", "<!-- PROFILE_METRICS_BADGES:END -->", metricsContent);
  readme = replaceBlock(readme, "<!-- PROFILE_MILESTONES:START -->", "<!-- PROFILE_MILESTONES:END -->", milestonesContent);

  fs.writeFileSync(readmePath, readme, "utf8");
}

(async function main() {
  try {
    let profile;
    let repos;

    if (token) {
      profile = await fetchJson("https://api.github.com/user");
      repos = await fetchJson("https://api.github.com/user/repos?per_page=100&sort=updated");
    } else {
      if (!envUsername) {
        console.error("Missing GITHUB_USERNAME in .env");
        process.exit(1);
      }

      try {
        profile = await fetchJson(`https://api.github.com/users/${encodeURIComponent(envUsername)}`);
        repos = await fetchJson(`https://api.github.com/users/${encodeURIComponent(envUsername)}/repos?per_page=100&sort=updated`);
      } catch (error) {
        console.error(`GitHub API returned 404 for username '${envUsername}'. Add GITHUB_TOKEN in .env for authenticated lookup.`);
        process.exit(1);
      }
    }

    const nonForkRepos = repos.filter((repo) => !repo.fork);
    const totalStars = nonForkRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const topRepos = [...nonForkRepos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6);
    const latestRepos = [...nonForkRepos]
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
      .slice(0, 5);

    const section = renderSection(profile, nonForkRepos);
    const metrics = renderMetrics(profile, profile.login, totalStars);
    const milestones = renderMilestones(profile, topRepos, latestRepos);

    updateReadme(section, metrics, milestones);

    console.log("README updated successfully.");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
