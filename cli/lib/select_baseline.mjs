import fs from "fs";
import path from "path";
import { loadRunBundle } from "./load_run_bundle.mjs";

export class BaselineSelectionError extends Error {
  constructor(message, decision) {
    super(message);
    this.name = "BaselineSelectionError";
    this.decision = decision;
  }
}

function runTimestamp(bundle) {
  return Date.parse(bundle.run.finished_at || bundle.run.started_at || 0) || 0;
}

function bundleSummary(bundle, reason) {
  return {
    run_id: bundle.run.run_id || path.basename(bundle.runDir),
    path: bundle.runDir,
    mission_id: bundle.run.mission_id || null,
    result: bundle.run.result || bundle.run.status || null,
    finished_at: bundle.run.finished_at || null,
    reason,
  };
}

function rejection(runDir, reason, extra = {}) {
  return {
    path: runDir,
    reason,
    ...extra,
  };
}

function modeFor(selector) {
  if (!selector || selector === "latest" || selector === "latest_successful_same_mission") {
    return {
      requested_mode: selector || "latest_successful_same_mission",
      effective_mode: "latest_successful_same_mission",
      explicit_path: null,
      fallback: selector === "latest",
    };
  }

  return {
    requested_mode: "explicit_path",
    effective_mode: "explicit_path",
    explicit_path: selector,
    fallback: false,
  };
}

function baseDecision(mode, projectDir, candidate) {
  return {
    requested_mode: mode.requested_mode,
    effective_mode: mode.effective_mode,
    project_dir: projectDir,
    candidate: bundleSummary(candidate, "candidate run excluded from baseline selection"),
    selected: null,
    rejected: [],
    fallback: mode.fallback,
    blocked_reason: null,
  };
}

function requireUsableBundle(runDir, candidate, requireSameMission = true) {
  const bundle = loadRunBundle(runDir);
  const result = bundle.run.result || bundle.run.status;
  const missionId = bundle.run.mission_id || null;

  if (path.resolve(bundle.runDir) === path.resolve(candidate.runDir)) {
    return { bundle, rejected: "candidate_self" };
  }
  if (!missionId) {
    return { bundle, rejected: "missing_mission_id" };
  }
  if (requireSameMission && missionId !== (candidate.run.mission_id || null)) {
    return { bundle, rejected: "mission_mismatch" };
  }
  if (result !== "pass") {
    return { bundle, rejected: `unusable_result:${result || "unknown"}` };
  }

  return { bundle, rejected: null };
}

export function selectBaseline(projectDir, candidateRunDir, selector = "latest_successful_same_mission") {
  const candidate = loadRunBundle(candidateRunDir);
  const mode = modeFor(selector);
  const decision = baseDecision(mode, projectDir, candidate);

  if (mode.effective_mode === "explicit_path") {
    const baselineDir = path.resolve(projectDir, mode.explicit_path);
    try {
      const { bundle, rejected } = requireUsableBundle(baselineDir, candidate, false);
      if (rejected) {
        decision.rejected.push(bundleSummary(bundle, rejected));
        decision.blocked_reason = `Explicit baseline rejected: ${rejected}`;
        throw new BaselineSelectionError(decision.blocked_reason, decision);
      }
      decision.selected = bundleSummary(bundle, "explicit baseline path supplied by user");
      return decision;
    } catch (err) {
      if (err instanceof BaselineSelectionError) throw err;
      decision.rejected.push(rejection(baselineDir, `load_failed:${err.message}`));
      decision.blocked_reason = `Explicit baseline could not be loaded: ${err.message}`;
      throw new BaselineSelectionError(decision.blocked_reason, decision);
    }
  }

  const reportsDir = path.join(projectDir, "grb_reports");
  if (!fs.existsSync(reportsDir)) {
    decision.blocked_reason = `No grb_reports directory found: ${reportsDir}`;
    throw new BaselineSelectionError(decision.blocked_reason, decision);
  }

  const eligible = [];
  for (const entry of fs.readdirSync(reportsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runDir = path.join(reportsDir, entry.name);
    const runJson = path.join(runDir, "run.json");
    if (!fs.existsSync(runJson)) {
      decision.rejected.push(rejection(runDir, "missing_run_json"));
      continue;
    }

    try {
      const { bundle, rejected } = requireUsableBundle(runDir, candidate, true);
      if (rejected) {
        decision.rejected.push(bundleSummary(bundle, rejected));
      } else {
        eligible.push(bundle);
      }
    } catch (err) {
      decision.rejected.push(rejection(runDir, `load_failed:${err.message}`));
    }
  }

  eligible.sort((a, b) => runTimestamp(b) - runTimestamp(a));
  if (eligible.length === 0) {
    decision.blocked_reason = `No eligible passing baseline found for mission ${candidate.run.mission_id || "unknown"}.`;
    throw new BaselineSelectionError(decision.blocked_reason, decision);
  }

  decision.selected = bundleSummary(
    eligible[0],
    "newest eligible passing run with the same mission_id"
  );
  return decision;
}
