import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { parseSimpleYaml } from "./simple_yaml.mjs";
import { missionRunnerPath, resolveProjectDir, toPosixRelative } from "./paths.mjs";
import { writeProofBundle } from "./proof_bundle.mjs";
import { BaselineSelectionError, selectBaseline } from "./select_baseline.mjs";
import { compareRuns, printComparisonCloseout, writeBlockedComparison } from "./compare_runs.mjs";

function makeRunId(missionId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${timestamp}-${missionId}`;
}

function toRunnerMission(mission, missionId) {
  if (!Array.isArray(mission.steps) || mission.steps.length === 0) {
    throw new Error(`${missionId}.yaml must define at least one mission step.`);
  }

  return {
    id: mission.id || missionId,
    name: mission.name || missionId,
    goal: mission.goal || "Launch the project and capture basic runtime proof.",
    estimated_time_sec: mission.estimated_time_sec || 15,
    tier_required: mission.tier_required ?? 1,
    steps: mission.steps,
  };
}

function writeLog(filePath, content) {
  fs.writeFileSync(filePath, content || "");
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch (_) {
    return false;
  }
}

function defaultMission(missionId = "smoke_boot") {
  return {
    id: missionId,
    name: missionId,
    tier_required: 1,
    blocked_proof: {
      what_blocked_higher_proof: "The mission was blocked before runtime evidence could be collected.",
      human_should_check_next: `Resolve the preflight issue, then rerun ${missionId}.`,
      unresolved_question: "Can the project launch with GRB enabled and produce runtime evidence?",
    },
    human_handoff: {
      check_next: `Resolve the preflight issue, then rerun ${missionId}.`,
      unresolved_question: "Can the project launch with GRB enabled and produce runtime evidence?",
    },
  };
}

function writeBlockedBundle({ runDir, runId, projectDir, mission, startedAt, runner, error, humanNextStep, unresolvedQuestion }) {
  fs.mkdirSync(runDir, { recursive: true });
  const finishedAt = new Date().toISOString();
  const bundle = writeProofBundle({
    runDir,
    runId,
    projectDir,
    mission,
    status: "blocked",
    startedAt,
    finishedAt,
    runner,
    error,
    humanNextStep,
    unresolvedQuestion,
  });
  console.error(error);
  console.error(`Proof summary: ${bundle.summaryPath}`);
  console.error(`Proof JSON: ${bundle.runJsonPath}`);
  printProofCloseout(bundle.runJson, bundle.summaryPath, (line) => console.error(line));
  return { exitCode: 2, runDir };
}

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function printList(log, label, items) {
  log(`  ${label}:`);
  for (const item of items || []) {
    log(`    - ${oneLine(item)}`);
  }
}

function printProofCloseout(runJson, summaryPath, log = console.log) {
  log("");
  log("Proof closeout:");
  log(`  Result: ${String(runJson.result || "unknown").toUpperCase()}`);
  printList(log, "Proven", runJson.proven || []);
  printList(log, "Not proven", runJson.unproven || []);
  printList(log, "Needs human review", runJson.needs_human_review || []);
  if (runJson.blocked_reason) {
    log(`  Blocked: ${oneLine(runJson.blocked_reason)}`);
  }
  log(`  Next: ${oneLine(runJson.human_next_step || runJson.next_step || "Inspect the proof bundle.")}`);
  log(`  Open: ${summaryPath}`);
  if (runJson.result === "pass" && runJson.mission_id && runJson.mission_id !== "smoke_boot") {
    log("  After a trustworthy pass:");
    log("    - This run may be a baseline candidate only after you inspect summary/artifacts/handoff.");
    log("    - Once trusted, rerun this mission with --compare-to latest after another passing run exists.");
    log("    - Guide: grb/regression_workflow.md");
  }
}

function summarizeRunnerError(result) {
  const combined = `${result.stderr || ""}\n${result.stdout || ""}`;
  const fatal = combined
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => line.startsWith("Fatal:"));
  return fatal || `Mission runner exited with code ${result.code}.`;
}

function runMissionRunner(args, options) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    function finish(code) {
      if (settled) return;
      settled = true;
      resolve({ code: code ?? 1, stdout, stderr });
    }

    let child;
    try {
      child = spawn(process.execPath, args, {
        cwd: options.projectDir,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      stderr += `${err.message}\n`;
      finish(1);
      return;
    }

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", (err) => {
      stderr += `${err.message}\n`;
      finish(1);
    });
    child.on("close", (code) => {
      finish(code);
    });
  });
}

export async function runProjectMission(options = {}) {
  const missionId = options.missionId || "smoke_boot";
  const projectDir = resolveProjectDir(options.projectDir);
  const missionPath = path.join(projectDir, "grb", "missions", `${missionId}.yaml`);
  const runId = makeRunId(missionId);
  const runDir = path.join(projectDir, "grb_reports", runId);
  const runnerOutputDir = path.join(runDir, "mission_runner");
  const startedAt = new Date().toISOString();

  if (!isDirectory(projectDir)) {
    console.error(`Project path not found or not a directory: ${projectDir}`);
    console.error("Run from inside a Godot project, or pass --project <path-to-project>.");
    return { exitCode: 2, runDir: null };
  }

  if (!isFile(path.join(projectDir, "project.godot"))) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission: defaultMission(missionId),
      startedAt,
      runner: { command: null, exit_code: null },
      error: `No project.godot found in: ${projectDir}\nRun from the Godot project root, or pass --project <path-to-project>.`,
      humanNextStep: "Run from the folder that contains project.godot, or pass --project <path-to-project>.",
      unresolvedQuestion: "Which Godot project should smoke_boot run against?",
    });
  }

  if (!fs.existsSync(missionPath)) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission: defaultMission(missionId),
      startedAt,
      runner: { command: null, exit_code: null },
      error: `GRB mission not found: ${missionPath}\nRun init first or add grb/missions/${missionId}.yaml to this project.`,
      humanNextStep: `Run init first or add grb/missions/${missionId}.yaml, then rerun ${missionId}.`,
      unresolvedQuestion: `Does this project define a GRB mission named ${missionId}?`,
    });
  }

  const addonDir = path.join(projectDir, "addons", "godot-runtime-bridge");
  if (!isDirectory(addonDir)) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission: defaultMission(missionId),
      startedAt,
      runner: { command: null, exit_code: null },
      error: `GRB addon not found: ${addonDir}\nInstall and enable the Godot Runtime Bridge addon. If this project was copied, open it once in Godot so plugin/import metadata is ready, then rerun ${missionId}.`,
      humanNextStep: `Install and enable the GRB addon, open the project once in Godot, then rerun ${missionId}.`,
      unresolvedQuestion: "Is the GRB addon installed and enabled for this project?",
    });
  }

  const godotMetadataDir = path.join(projectDir, ".godot");
  if (!isDirectory(godotMetadataDir)) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission: defaultMission(missionId),
      startedAt,
      runner: { command: null, exit_code: null },
      error: `Godot metadata not found: ${godotMetadataDir}\nOpen this project once in Godot so imports/plugins are ready, then rerun ${missionId}.`,
      humanNextStep: `Open this project once in Godot so imports/plugins are ready, then rerun ${missionId}.`,
      unresolvedQuestion: "Can Godot load this copied project with plugin metadata ready?",
    });
  }

  let mission;
  let runnerMission;
  try {
    mission = parseSimpleYaml(fs.readFileSync(missionPath, "utf-8"));
    runnerMission = toRunnerMission(mission, missionId);
  } catch (err) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission: defaultMission(missionId),
      startedAt,
      runner: { command: null, exit_code: null },
      error: `Could not read ${missionId} mission: ${err.message}`,
      humanNextStep: `Fix grb/missions/${missionId}.yaml, then rerun ${missionId}.`,
      unresolvedQuestion: `Is ${missionId}.yaml valid for the Sprint mission runner?`,
    });
  }

  const runnerMissionsFile = path.join(runDir, `${missionId}.runner.json`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(runnerOutputDir, { recursive: true });
  fs.writeFileSync(runnerMissionsFile, `${JSON.stringify([runnerMission], null, 2)}\n`);

  if (!options.exe) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission,
      startedAt,
      runner: {
        command: null,
        exit_code: null,
        generated_missions_file: toPosixRelative(runDir, runnerMissionsFile),
      },
      error: "No Godot executable provided.\nPass --exe <path-to-godot> or set GODOT_EXE.",
      humanNextStep: `Rerun ${missionId} with --exe <path-to-godot>, or set GODOT_EXE to a valid Godot executable.`,
      unresolvedQuestion: "Which Godot executable should launch this project?",
    });
  }

  const exePath = path.resolve(options.exe);
  if (!isFile(exePath)) {
    return writeBlockedBundle({
      runDir,
      runId,
      projectDir,
      mission,
      startedAt,
      runner: {
        command: null,
        exit_code: null,
        generated_missions_file: toPosixRelative(runDir, runnerMissionsFile),
      },
      error: `Godot executable not found: ${exePath}\nPass --exe <path-to-godot> or set GODOT_EXE to a valid Godot executable.`,
      humanNextStep: `Rerun ${missionId} with a valid --exe path, or set GODOT_EXE to a valid Godot executable.`,
      unresolvedQuestion: "Where is the Godot executable for this project?",
    });
  }

  const runnerArgs = [
    missionRunnerPath,
    "--mission", runnerMission.id,
    "--missions-file", runnerMissionsFile,
    "--output-dir", runnerOutputDir,
    "--exe", exePath,
    "--project", projectDir,
  ];

  if (options.mode) runnerArgs.push("--mode", options.mode);
  if (options.allowBootErrors) runnerArgs.push("--allow-boot-errors");

  console.log(`GRB ${missionId} run: ${runId}`);
  console.log(`Project: ${projectDir}`);
  console.log(`Reports: ${runDir}`);

  const result = await runMissionRunner(runnerArgs, { projectDir });
  const stdoutLog = path.join(runDir, "runner.stdout.log");
  const stderrLog = path.join(runDir, "runner.stderr.log");
  writeLog(stdoutLog, result.stdout);
  writeLog(stderrLog, result.stderr);

  const finishedAt = new Date().toISOString();
  const status = result.code === 0 ? "pass" : "fail";
  let exitCode = result.code;
  const bundle = writeProofBundle({
    runDir,
    runId,
    projectDir,
    mission,
    status,
    startedAt,
    finishedAt,
    runner: {
      command: [process.execPath, ...runnerArgs],
      exit_code: result.code,
      generated_missions_file: toPosixRelative(runDir, runnerMissionsFile),
      output_dir: toPosixRelative(runDir, runnerOutputDir),
    },
    error: result.code === 0 ? null : summarizeRunnerError(result),
  });

  console.log(`Proof summary: ${bundle.summaryPath}`);
  console.log(`Proof JSON: ${bundle.runJsonPath}`);
  printProofCloseout(bundle.runJson, bundle.summaryPath);

  if (result.code === 0 && options.compareTo) {
    try {
      const baselineDecision = selectBaseline(projectDir, runDir, options.compareTo);
      const comparison = compareRuns(baselineDecision.selected.path, runDir, { baselineSelection: baselineDecision });
      printComparisonCloseout(comparison.comparison, comparison.comparisonMdPath, comparison.comparisonJsonPath);
      if (["blocked", "regression_suspected"].includes(comparison.comparison.result)) {
        exitCode = 1;
      }
    } catch (err) {
      if (err instanceof BaselineSelectionError) {
        const comparison = writeBlockedComparison(runDir, err.decision, err.message);
        console.error(`Comparison blocked: ${err.message}`);
        printComparisonCloseout(comparison.comparison, comparison.comparisonMdPath, comparison.comparisonJsonPath, (line) => console.error(line));
        exitCode = 1;
      } else {
        console.error(`Comparison blocked: ${err.message}`);
        exitCode = 1;
      }
    }
  }

  return { exitCode, runDir };
}

export async function runSmokeBoot(options = {}) {
  return runProjectMission({ ...options, missionId: "smoke_boot" });
}
