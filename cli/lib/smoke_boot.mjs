import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { parseSimpleYaml } from "./simple_yaml.mjs";
import { missionRunnerPath, resolveProjectDir, toPosixRelative } from "./paths.mjs";
import { writeProofBundle } from "./proof_bundle.mjs";

function makeRunId(missionId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${timestamp}-${missionId}`;
}

function toRunnerMission(mission) {
  if (!Array.isArray(mission.steps) || mission.steps.length === 0) {
    throw new Error("smoke_boot.yaml must define at least one mission step.");
  }

  return {
    id: mission.id || "smoke_boot",
    name: mission.name || "Smoke Boot",
    goal: mission.goal || "Launch the project and capture basic runtime proof.",
    estimated_time_sec: mission.estimated_time_sec || 15,
    tier_required: mission.tier_required ?? 1,
    steps: mission.steps,
  };
}

function writeLog(filePath, content) {
  fs.writeFileSync(filePath, content || "");
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

export async function runSmokeBoot(options = {}) {
  const projectDir = resolveProjectDir(options.projectDir);
  const missionPath = path.join(projectDir, "grb", "missions", "smoke_boot.yaml");
  const runId = makeRunId("smoke_boot");
  const runDir = path.join(projectDir, "grb_reports", runId);
  const runnerOutputDir = path.join(runDir, "mission_runner");
  const startedAt = new Date().toISOString();

  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(runnerOutputDir, { recursive: true });

  if (!fs.existsSync(missionPath)) {
    const finishedAt = new Date().toISOString();
    const mission = { id: "smoke_boot", name: "Smoke Boot" };
    const error = `Mission source not found: ${missionPath}. Run "node cli/grb.mjs init" from the project first.`;
    const bundle = writeProofBundle({
      runDir,
      runId,
      projectDir,
      mission,
      status: "blocked",
      startedAt,
      finishedAt,
      runner: { command: null, exit_code: null },
      error,
    });
    console.error(error);
    console.error(`Proof bundle: ${bundle.summaryPath}`);
    return { exitCode: 2, runDir };
  }

  const mission = parseSimpleYaml(fs.readFileSync(missionPath, "utf-8"));
  const runnerMission = toRunnerMission(mission);
  const runnerMissionsFile = path.join(runDir, "smoke_boot.runner.json");
  fs.writeFileSync(runnerMissionsFile, `${JSON.stringify([runnerMission], null, 2)}\n`);

  if (!options.exe) {
    const finishedAt = new Date().toISOString();
    const error = "No Godot executable provided. Pass --exe <path> or set GODOT_EXE.";
    const bundle = writeProofBundle({
      runDir,
      runId,
      projectDir,
      mission,
      status: "blocked",
      startedAt,
      finishedAt,
      runner: {
        command: null,
        exit_code: null,
        generated_missions_file: toPosixRelative(runDir, runnerMissionsFile),
      },
      error,
    });
    console.error(error);
    console.error(`Proof bundle: ${bundle.summaryPath}`);
    return { exitCode: 2, runDir };
  }

  const runnerArgs = [
    missionRunnerPath,
    "--mission", runnerMission.id,
    "--missions-file", runnerMissionsFile,
    "--output-dir", runnerOutputDir,
    "--exe", options.exe,
    "--project", projectDir,
  ];

  if (options.mode) runnerArgs.push("--mode", options.mode);
  if (options.allowBootErrors) runnerArgs.push("--allow-boot-errors");

  console.log(`GRB smoke_boot run: ${runId}`);
  console.log(`Project: ${projectDir}`);
  console.log(`Reports: ${runDir}`);

  const result = await runMissionRunner(runnerArgs, { projectDir });
  const stdoutLog = path.join(runDir, "runner.stdout.log");
  const stderrLog = path.join(runDir, "runner.stderr.log");
  writeLog(stdoutLog, result.stdout);
  writeLog(stderrLog, result.stderr);

  const finishedAt = new Date().toISOString();
  const status = result.code === 0 ? "pass" : "fail";
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
    error: result.code === 0 ? null : `Mission runner exited with code ${result.code}.`,
  });

  console.log(`Proof summary: ${bundle.summaryPath}`);
  console.log(`Proof JSON: ${bundle.runJsonPath}`);

  return { exitCode: result.code, runDir };
}
