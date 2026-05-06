#!/usr/bin/env node

import { spawnSync } from "child_process";
import path from "path";

const targetDir = path.resolve(process.argv[2] || process.cwd());

function normalizePath(input) {
  return input.replace(/\\/g, "/");
}

function parseStatusLine(line) {
  const status = line.slice(0, 2);
  const rawPath = line.slice(3).trim();
  const displayPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop() : rawPath;
  return { status, path: displayPath };
}

function classify(filePath) {
  const normalized = normalizePath(filePath);
  const lower = normalized.toLowerCase();
  const ext = path.extname(lower);

  if (
    lower.includes("/grb_reports/") ||
    lower.startsWith("grb_reports/") ||
    lower.includes("/reports/") ||
    lower.includes("/mission_runner/") ||
    lower.includes("/debug/screenshots/")
  ) {
    return "proof reports / validation artifacts";
  }

  if (
    lower.startsWith(".godot/") ||
    lower.includes("/.godot/") ||
    lower.startsWith("node_modules/") ||
    lower.includes("/node_modules/") ||
    lower.startsWith(".cache/") ||
    lower.includes("/.cache/") ||
    lower.startsWith("coverage/") ||
    lower.includes("/coverage/")
  ) {
    return "generated artifacts / local caches";
  }

  if (
    ext === ".md" ||
    lower === "readme.md" ||
    lower === "changelog.md" ||
    lower === "security.md" ||
    lower === "protocol.md" ||
    lower.startsWith("docs/") ||
    lower.includes("/readme.md") ||
    lower.startsWith("templates/") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml")
  ) {
    return "docs / project contract";
  }

  if (
    [".gd", ".mjs", ".js", ".ts", ".json", ".cmd", ""].includes(ext) &&
    (
      lower.startsWith("addons/") ||
      lower.startsWith("cli/") ||
      lower.startsWith("mcp/") ||
      lower.startsWith("missions/") ||
      lower.startsWith("tools/") ||
      lower === "grb" ||
      lower === "grb.cmd"
    )
  ) {
    return "source / tooling";
  }

  return "suspicious or out-of-scope until reviewed";
}

function runGitStatus(cwd) {
  return spawnSync("git", ["status", "--short", "--untracked-files=all"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
}

function printHeader() {
  console.log("GRB worktree preflight");
  console.log(`Path: ${targetDir}`);
  console.log("");
  console.log("This helper is informational. Categories are likely review hints, not definitive truth.");
  console.log("Do not revert or overwrite dirty work unless the user explicitly asks.");
  console.log("");
}

function printGuidance() {
  console.log("");
  console.log("Suggested agent preflight statement:");
  console.log("- Current dirty state: summarize the categories above.");
  console.log("- Intended touch paths: list the files/folders this slice will edit.");
  console.log("- Preservation note: say which existing dirty files are prior/user work to preserve.");
}

printHeader();

const result = runGitStatus(targetDir);

if (result.error) {
  const message = result.error.code === "ENOENT"
    ? "git was not found on PATH, so dirty-state inspection could not run."
    : `git status could not run: ${result.error.message}`;
  console.log(`Status: unavailable - ${message}`);
  printGuidance();
  process.exit(0);
}

if (result.status !== 0) {
  const stderr = (result.stderr || "").trim();
  const stdout = (result.stdout || "").trim();
  const details = stderr || stdout || `git exited with code ${result.status}`;
  console.log(`Status: unavailable - ${details}`);
  console.log("This may mean the path is not inside a git worktree.");
  printGuidance();
  process.exit(0);
}

const lines = (result.stdout || "").split(/\r?\n/).filter(Boolean);

if (lines.length === 0) {
  console.log("Status: clean");
  printGuidance();
  process.exit(0);
}

const grouped = new Map();

for (const line of lines) {
  const entry = parseStatusLine(line);
  const category = classify(entry.path);
  if (!grouped.has(category)) grouped.set(category, []);
  grouped.get(category).push(entry);
}

console.log("Status: dirty");
for (const [category, entries] of grouped.entries()) {
  console.log(`\n${category}:`);
  for (const entry of entries) {
    console.log(`- ${entry.status.trim() || "modified"} ${entry.path}`);
  }
}

printGuidance();
