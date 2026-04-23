#!/usr/bin/env node

import { initProject } from "./lib/init.mjs";
import { scaffoldMission, VALID_MISSION_PATTERNS } from "./lib/mission_scaffold.mjs";
import { runProjectMission } from "./lib/smoke_boot.mjs";
import { compareRuns, printComparisonCloseout } from "./lib/compare_runs.mjs";

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
  console.log(`Godot Runtime Bridge 2.0 CLI

Usage:
  node cli/grb.mjs init [--project <path>]
  node cli/grb.mjs mission scaffold <mission_id> [--project <path>] [--recipe <recipe_id>] [--pattern <pattern_id>]
  node cli/grb.mjs mission run <mission_id> [--project <path>] --exe <godot_exe>
  node cli/grb.mjs compare <baseline-run-dir> <candidate-run-dir>

Examples:
  # From the GRB repo
  node cli/grb.mjs init --project C:\\path\\to\\YourGodotProject
  node cli/grb.mjs mission scaffold pause_menu --project C:\\path\\to\\YourGodotProject
  node cli/grb.mjs mission scaffold title_to_gameplay --project C:\\path\\to\\YourGodotProject --pattern transition
  node cli/grb.mjs mission scaffold inventory_panel --project C:\\path\\to\\YourGodotProject --pattern toggle
  node cli/grb.mjs mission scaffold hud_counter --project C:\\path\\to\\YourGodotProject --pattern state_check
  node cli/grb.mjs mission run smoke_boot --project C:\\path\\to\\YourGodotProject --exe C:\\path\\to\\Godot_console.exe
  node cli/grb.mjs mission run scene_transition --project C:\\path\\to\\YourGodotProject --exe C:\\path\\to\\Godot_console.exe
  node cli/grb.mjs mission run smoke_boot --project C:\\path\\to\\YourGodotProject --exe C:\\path\\to\\Godot_console.exe --compare-to latest

  # From inside a Godot project
  node C:\\path\\to\\grb-main\\cli\\grb.mjs init
  node C:\\path\\to\\grb-main\\cli\\grb.mjs mission scaffold pause_menu
  node C:\\path\\to\\grb-main\\cli\\grb.mjs mission run smoke_boot --exe C:\\path\\to\\Godot_console.exe

Environment:
  GODOT_EXE may be used instead of --exe for mission runs.

Mission scaffold patterns:
  ${VALID_MISSION_PATTERNS.join(", ")}
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
    if (!result.projectGodotExists) {
      console.log("Note: project.godot was not found in this folder.");
      console.log("  Run init from a Godot project root, or pass --project <path-to-project>.");
      console.log("");
    }
    console.log("Review first:");
    console.log("  AGENTS.md");
    console.log("  grb.project.yaml");
    console.log("  grb/proof_policy.yaml");
    console.log("");
    console.log("Then run the first trustworthy proof mission:");
    console.log(`  node ${process.argv[1]} mission run smoke_boot --project "${result.projectDir}" --exe <godot_exe>`);
    console.log("");
    console.log("Proof bundles will be written to:");
    console.log(`  ${result.projectDir}\\grb_reports\\<run-id>\\`);
    return;
  }

  if (command === "mission" && subcommand === "run" && target) {
    const result = await runProjectMission({
      missionId: target,
      projectDir: flags.project || process.cwd(),
      exe: flags.exe || flags["godot-exe"] || process.env.GODOT_EXE,
      mode: flags.mode,
      allowBootErrors: Boolean(flags["allow-boot-errors"]),
      compareTo: flags["compare-to"] || flags.compareTo,
    });
    process.exit(result.exitCode);
  }

  if (command === "mission" && subcommand === "scaffold" && target) {
    const result = scaffoldMission({
      missionId: target,
      projectDir: flags.project || process.cwd(),
      recipe: flags.recipe,
      pattern: flags.pattern,
    });
    console.log(`GRB mission scaffold created: ${result.missionPath}`);
    console.log(`Pattern: ${result.pattern}`);
    console.log(`Recipe: ${result.recipe} (${result.recipeSource})`);
    console.log("");
    console.log("Customize first:");
    console.log("  - Replace the TODO goal with the exact project surface this mission proves.");
    if (result.pattern === "state_check") {
      console.log("  - Replace the TODO state reads with one call_method or get_property source.");
      console.log("  - Replace the state_check placeholder interaction with one small real action.");
    } else {
      console.log(`  - Replace the ${result.pattern} placeholder interaction with one small real action.`);
    }
    console.log("  - Update human_handoff so a reviewer knows what to inspect.");
    console.log("");
    console.log("Then run:");
    console.log(`  node ${process.argv[1]} mission run ${result.missionId} --project "${result.projectDir}" --exe <godot_exe>`);
    console.log("");
    console.log("Optional:");
    console.log(`  Add ${result.missionId} to grb.project.yaml if you keep a mission list there.`);
    return;
  }

  if (command === "compare") {
    const baseline = subcommand;
    const candidate = target;
    if (!baseline || !candidate) {
      console.error("Usage: node cli/grb.mjs compare <baseline-run-dir> <candidate-run-dir>");
      process.exit(1);
    }
    const result = compareRuns(baseline, candidate);
    printComparisonCloseout(result.comparison, result.comparisonMdPath, result.comparisonJsonPath);
    process.exit(["blocked", "regression_suspected"].includes(result.comparison.result) ? 1 : 0);
  }

  console.error(`Unknown command: ${positional.join(" ")}`);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
