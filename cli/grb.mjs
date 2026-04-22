#!/usr/bin/env node

import { initProject } from "./lib/init.mjs";
import { runSmokeBoot } from "./lib/smoke_boot.mjs";

function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }

  return { positional, flags };
}

function printHelp() {
  console.log(`Godot Runtime Bridge 2.0 Sprint 1 CLI

Usage:
  node cli/grb.mjs init [--project <path>]
  node cli/grb.mjs mission run smoke_boot [--project <path>] --exe <godot_exe>

Environment:
  GODOT_EXE may be used instead of --exe for mission runs.
`);
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));

  if (flags.help || positional.length === 0) {
    printHelp();
    process.exit(positional.length === 0 ? 1 : 0);
  }

  const [command, subcommand, target] = positional;

  if (command === "init") {
    const result = initProject({ projectDir: flags.project || process.cwd() });
    console.log(`GRB project scaffold ready: ${result.projectDir}`);
    for (const entry of result.entries) {
      console.log(`  ${entry.status.padEnd(7)} ${entry.path}`);
    }
    console.log("");
    console.log("Next:");
    console.log(`  node ${process.argv[1]} mission run smoke_boot --project "${result.projectDir}" --exe <godot_exe>`);
    return;
  }

  if (command === "mission" && subcommand === "run" && target === "smoke_boot") {
    const result = await runSmokeBoot({
      projectDir: flags.project || process.cwd(),
      exe: flags.exe || flags["godot-exe"] || process.env.GODOT_EXE,
      mode: flags.mode,
      allowBootErrors: Boolean(flags["allow-boot-errors"]),
    });
    process.exit(result.exitCode);
  }

  console.error(`Unknown command: ${positional.join(" ")}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
