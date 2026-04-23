#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from "url";
import { initProject } from "./lib/init.mjs";
import { scaffoldMission, VALID_MISSION_PATTERNS } from "./lib/mission_scaffold.mjs";
import { runProjectMission } from "./lib/smoke_boot.mjs";
import { compareRuns, printComparisonCloseout } from "./lib/compare_runs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function repoRootLauncherName() {
  return process.platform === "win32" ? "grb.cmd" : "./grb";
}

function repoRootLauncherPath() {
  return process.platform === "win32"
    ? `${repoRoot}\\grb.cmd`
    : `${repoRoot}/grb`;
}

function quotedRepoRootLauncherPath() {
  return `"${repoRootLauncherPath()}"`;
}

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
  ${process.platform === "win32" ? "grb.cmd" : "./grb"} init [--project <path>]
  ${process.platform === "win32" ? "grb.cmd" : "./grb"} mission scaffold <mission_id> [--project <path>] [--recipe <recipe_id>] [--pattern <pattern_id>]
  ${process.platform === "win32" ? "grb.cmd" : "./grb"} mission run <mission_id> [--project <path>] --exe <godot_exe>
  ${process.platform === "win32" ? "grb.cmd" : "./grb"} compare <baseline-run-dir> <candidate-run-dir>

Examples:
  # From the GRB repo root on Windows
  grb.cmd init --project C:\\path\\to\\YourGodotProject
  grb.cmd mission scaffold pause_menu --project C:\\path\\to\\YourGodotProject
  grb.cmd mission scaffold title_to_gameplay --project C:\\path\\to\\YourGodotProject --pattern transition
  grb.cmd mission scaffold inventory_panel --project C:\\path\\to\\YourGodotProject --pattern toggle
  grb.cmd mission scaffold hud_counter --project C:\\path\\to\\YourGodotProject --pattern state_check
  grb.cmd mission run smoke_boot --project C:\\path\\to\\YourGodotProject --exe C:\\path\\to\\Godot_console.exe
  grb.cmd mission run scene_transition --project C:\\path\\to\\YourGodotProject --exe C:\\path\\to\\Godot_console.exe
  grb.cmd mission run smoke_boot --project C:\\path\\to\\YourGodotProject --exe C:\\path\\to\\Godot_console.exe --compare-to latest

  # From the GRB repo root on POSIX
  ./grb init --project /path/to/YourGodotProject
  ./grb mission run smoke_boot --project /path/to/YourGodotProject --exe /path/to/Godot_console

  # From another directory, call the repo-root launcher directly
  ${process.platform === "win32" ? "C:\\path\\to\\grb-main\\grb.cmd init --project C:\\path\\to\\YourGodotProject" : "/path/to/grb-main/grb init --project /path/to/YourGodotProject"}

Environment:
  GODOT_EXE may be used instead of --exe for mission runs.

Repo-root launchers:
  Windows: grb.cmd
  POSIX:   ./grb
  Current repo: ${repoRootLauncherPath()}

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
    console.log("Recorded local GRB repo linkage in grb.project.yaml:");
    console.log(`  grb_repo_root: ${result.repoLinkage.repoRoot}`);
    console.log(`  launcher: ${result.repoLinkage.launcherPath}`);
    console.log("");
    console.log("GRB 2.0 staged path:");
    console.log("  1. Read now:");
    console.log("     - AGENTS.md");
    console.log("     - grb.project.yaml");
    console.log("     - grb/proof_policy.yaml");
    console.log("     - grb/missions/smoke_boot.yaml");
    console.log("");
    console.log("  2. Run the first trustworthy proof mission:");
    console.log(`     ${result.repoLinkage.firstProofCommand}`);
    console.log("");
    console.log("  3. Inspect the proof bundle summary:");
    console.log(`     ${result.projectDir}\\grb_reports\\<run-id>\\summary.md`);
    console.log("");
    console.log("  4. After smoke_boot passes:");
    console.log("     - Use grb/mission_authoring.md to scaffold one small project-specific mission.");
    console.log("     - Use grb/runtime_proof_hooks.md only when that mission needs runtime-readable state.");
    console.log("");
    console.log("  5. After a small mission passes:");
    console.log("     - Use grb/regression_workflow.md before treating the run as a baseline candidate.");
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
    if (result.canonicalExamplePath) {
      console.log(`Canonical example: ${result.canonicalExamplePath}`);
    }
    console.log("");
    console.log("Customize first:");
    console.log("  - Replace the TODO goal with the exact project surface this mission proves.");
    if (result.pattern === "state_check") {
      console.log("  - Replace the TODO state reads with one call_method or get_property source.");
      console.log("  - Use grb/runtime_proof_hooks.md if you need to add a safe state helper.");
      console.log("  - Replace the state_check placeholder interaction with one small real action.");
    } else {
      console.log(`  - Replace the ${result.pattern} placeholder interaction with one small real action.`);
    }
    console.log("  - Update human_handoff so a reviewer knows what to inspect.");
    console.log("  - Use grb/mission_authoring.md for step examples and honest handoff wording.");
    console.log("");
    console.log("Then run:");
    console.log(`  ${quotedRepoRootLauncherPath()} mission run ${result.missionId} --project "${result.projectDir}" --exe <godot_exe>`);
    console.log("");
    console.log("After a trustworthy pass:");
    console.log("  Read grb/regression_workflow.md before treating the run as a baseline candidate.");
    console.log("");
    console.log("Optional:");
    console.log(`  Add ${result.missionId} to grb.project.yaml if you keep a mission list there.`);
    return;
  }

  if (command === "compare") {
    const baseline = subcommand;
    const candidate = target;
    if (!baseline || !candidate) {
      console.error(`Usage: ${repoRootLauncherName()} compare <baseline-run-dir> <candidate-run-dir>`);
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
