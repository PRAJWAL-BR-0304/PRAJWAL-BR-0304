const fs = require("fs");
const path = require("path");
require("dotenv").config();

const readmePath = path.join(process.cwd(), "README.md");

const envUsername = process.env.GITHUB_USERNAME;
const token = process.env.GITHUB_TOKEN;

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "profile-readme-updater"
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

function renderSection(profile, repos) {
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6);

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
    `  <img src=\"https://github-readme-stats.vercel.app/api?username=${profile.login}&show_icons=true&theme=transparent&hide_border=true&rank_icon=github&include_all_commits=true&count_private=true\" alt=\"Profile summary\" />`,
    "</p>",
    "",
    `> Last refreshed: **${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC**`,
    "",
    "### Starred highlights",
    "",
    "| Repository | Stack | Stars | Forks | Last push |",
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
    ""
  ].join("\n");
}

function updateReadme(sectionContent) {
  const start = "<!-- GITHUB_DYNAMIC_SECTION:START -->";
  const end = "<!-- GITHUB_DYNAMIC_SECTION:END -->";

  let readme = fs.readFileSync(readmePath, "utf8");

  const block = `${start}\n${sectionContent}\n${end}`;

  if (readme.includes(start) && readme.includes(end)) {
    const pattern = new RegExp(`${start}[\\s\\S]*?${end}`, "m");
    readme = readme.replace(pattern, block);
  } else {
    readme += `\n\n${block}\n`;
  }

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

    const section = renderSection(profile, repos.filter((repo) => !repo.fork));
    updateReadme(section);

    console.log("README updated successfully.");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
