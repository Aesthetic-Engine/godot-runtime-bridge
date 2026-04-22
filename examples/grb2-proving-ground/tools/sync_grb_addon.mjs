#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(toolDir, "..");
const repoRoot = path.resolve(projectDir, "..", "..");
const sourceDir = path.join(repoRoot, "addons", "godot-runtime-bridge");
const addonsDir = path.join(projectDir, "addons");
const targetDir = path.join(addonsDir, "godot-runtime-bridge");
const projectFile = path.join(projectDir, "project.godot");
const sourcePluginFile = path.join(sourceDir, "plugin.cfg");

function assertInsideProject(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(projectDir + path.sep)) {
    throw new Error(`Refusing to write outside proving-ground project: ${resolved}`);
  }
}

if (!fs.existsSync(projectFile)) {
  console.error(`Proving-ground project file not found: ${projectFile}`);
  process.exit(1);
}

if (!fs.existsSync(sourcePluginFile)) {
  console.error(`Canonical addon not found: ${sourceDir}`);
  process.exit(1);
}

assertInsideProject(addonsDir);
assertInsideProject(targetDir);

fs.mkdirSync(addonsDir, { recursive: true });
fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, {
  recursive: true,
  filter: (src) => !src.includes(`${path.sep}.godot${path.sep}`),
});

console.log(`Source addon: ${sourceDir}`);
console.log(`Synced canonical addon to: ${targetDir}`);
console.log("This copy is ignored by git and should not be committed.");
console.log("");
console.log("Next:");
console.log("  Open the project once in Godot if .godot metadata is missing.");
console.log("  Run a mission, for example:");
console.log("  node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe <godot_exe>");
