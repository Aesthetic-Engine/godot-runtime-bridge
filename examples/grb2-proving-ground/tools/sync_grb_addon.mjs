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

function assertInsideProject(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(projectDir + path.sep)) {
    throw new Error(`Refusing to write outside proving-ground project: ${resolved}`);
  }
}

if (!fs.existsSync(sourceDir)) {
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

console.log(`Synced canonical addon to: ${targetDir}`);
console.log("This copy is ignored by git and should not be committed.");
