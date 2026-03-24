#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const targets = [
  {
    label: "package.json",
    path: path.join(__dirname, "package.json"),
    readVersion: (text) => JSON.parse(text).version,
  },
  {
    label: "plugin.cfg",
    path: path.join(repoRoot, "addons", "godot-runtime-bridge", "plugin.cfg"),
    readVersion: (text) => matchRequired(text, /version="([^"]+)"/, "plugin.cfg version"),
  },
  {
    label: "EditorDock.gd",
    path: path.join(repoRoot, "addons", "godot-runtime-bridge", "runtime_bridge", "EditorDock.gd"),
    readVersion: (text) => matchRequired(text, /const VERSION := "([^"]+)"/, "EditorDock VERSION"),
  },
  {
    label: "index.js server version",
    path: path.join(__dirname, "index.js"),
    readVersion: (text) => matchRequired(text, /name: "godot-runtime-bridge", version: "([^"]+)"/, "index.js MCP server version"),
  },
  {
    label: "index.js startup banner",
    path: path.join(__dirname, "index.js"),
    readVersion: (text) => matchRequired(text, /\[GRB\] MCP server started \(godot-runtime-bridge v([0-9.]+)\)\\n"\s*\+/, "index.js startup banner version"),
  },
];

function matchRequired(text, regex, label) {
  const match = text.match(regex);
  if (!match) {
    throw new Error(`Could not find ${label}`);
  }
  return match[1];
}

const results = targets.map((target) => {
  const text = fs.readFileSync(target.path, "utf8");
  return {
    label: target.label,
    path: target.path,
    version: target.readVersion(text),
  };
});

const expected = results[0].version;
const mismatches = results.filter((result) => result.version !== expected);

console.log(`Expected GRB version: ${expected}`);
for (const result of results) {
  console.log(`- ${result.label}: ${result.version}`);
}

if (mismatches.length > 0) {
  console.error("\nVersion mismatch detected:");
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch.label}: ${mismatch.version} (${mismatch.path})`);
  }
  process.exit(1);
}

console.log("\nVersion sync check passed.");
