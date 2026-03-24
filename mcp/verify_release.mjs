#!/usr/bin/env node

import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeExe = process.execPath;
const forwardedArgs = process.argv.slice(2);

run("check_versions.mjs", []);
run("verify_grb_release.mjs", forwardedArgs);

function run(scriptName, args) {
  const result = spawnSync(nodeExe, [path.join(__dirname, scriptName), ...args], {
    cwd: __dirname,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
