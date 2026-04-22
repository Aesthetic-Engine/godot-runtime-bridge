import fs from "fs";
import path from "path";
import { toPosixRelative } from "./paths.mjs";

function findFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, results);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function artifactType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "screenshot";
  if (ext === ".md") return "report";
  if (ext === ".log") return "log";
  if (ext === ".json") return "json";
  return "file";
}

function selectInspectArtifact(artifacts, fallback) {
  return artifacts.find((a) => a.path.endsWith("boot_screen.png"))
    || artifacts.find((a) => a.type === "screenshot")
    || artifacts.find((a) => a.type === "report")
    || artifacts[0]
    || fallback;
}

function targetedProofTier(mission) {
  return mission.targeted_proof_tier || "W";
}

function reachedProofTier(status) {
  return status === "pass" ? "W" : "none";
}

export function writeProofBundle(options) {
  const {
    runDir,
    runId,
    projectDir,
    mission,
    status,
    startedAt,
    finishedAt,
    runner,
    error,
    humanNextStep: explicitHumanNextStep,
    unresolvedQuestion: explicitUnresolvedQuestion,
  } = options;

  const artifacts = findFiles(runDir)
    .filter((filePath) => !filePath.endsWith("run.json") && !filePath.endsWith("summary.md"))
    .map((filePath) => ({
      path: toPosixRelative(runDir, filePath),
      type: artifactType(filePath),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const fallbackArtifact = { path: "summary.md", type: "report" };
  const inspectArtifact = selectInspectArtifact(artifacts, fallbackArtifact);
  const passed = status === "pass";
  const targetedTier = targetedProofTier(mission);
  const reachedTier = reachedProofTier(status);
  const screenshotCount = artifacts.filter((a) => a.type === "screenshot").length;
  const reportCount = artifacts.filter((a) => a.type === "report").length;
  const handoff = mission.human_handoff || {};
  const blockedProof = mission.blocked_proof || {};
  const preferredBlockedArtifact = blockedProof.artifact_to_inspect;
  const preferredHandoffArtifact = handoff.artifact_to_inspect;
  const preferredBlockedArtifactExists = artifacts.some((a) => a.path === preferredBlockedArtifact);
  const preferredHandoffArtifactExists = artifacts.some((a) => a.path === preferredHandoffArtifact);
  const blockedArtifactPath = preferredBlockedArtifactExists
    ? preferredBlockedArtifact
    : inspectArtifact.path;
  const handoffArtifactPath = preferredHandoffArtifactExists
    ? preferredHandoffArtifact
    : blockedArtifactPath;
  const blockedCheckNext = preferredBlockedArtifactExists
    ? blockedProof.human_should_check_next
    : "Inspect the listed artifact, resolve the runner blockage, then rerun the mission to capture runtime screenshots.";
  const handoffCheckNext = preferredHandoffArtifactExists
    ? handoff.check_next
    : "Inspect the listed artifact and rerun the mission once the blockage is resolved.";
  const runtimeVisualClaim = screenshotCount > 0
    ? "Screenshots were captured as visual evidence, but no project-specific baseline, layout rule, or design intent was validated automatically."
    : "No runtime screenshot was captured, so runtime visual proof was not reached.";

  const proofTiers = {
    W: {
      status: passed ? "reached" : "not_reached",
      claim: "Godot launch, GRB connection, runtime inspection, screenshot capture, scene tree capture, and engine error check.",
      evidence: artifacts.filter((a) => a.type === "report" || a.type === "log").map((a) => a.path),
    },
    R: {
      status: screenshotCount > 0 ? "evidence_captured_not_validated" : "not_reached",
      claim: runtimeVisualClaim,
      evidence: artifacts.filter((a) => a.type === "screenshot").map((a) => a.path),
    },
    E: {
      status: "not_reached_human_required",
      claim: "Experiential proof requires human play/review and is not claimed by this automation.",
      evidence: [],
    },
  };

  const evidence = artifacts.map((a) => ({ ...a }));
  const unproven = [];
  if (!passed) {
    unproven.push("W-tier wiring proof was not reached because the mission did not complete successfully.");
  }
  unproven.push("R-tier visual correctness is not claimed; screenshots are evidence for inspection, not automatic visual validation.");
  unproven.push("E-tier experience, feel, timing, and design intent require human confirmation.");

  const blockedReason = passed ? null : (error || "The mission was blocked before meaningful proof could be completed.");
  const higherProofReason = blockedProof.what_blocked_higher_proof || "Higher proof requires human review.";
  const humanNextStep = explicitHumanNextStep || (passed
    ? (handoffCheckNext || "Inspect the captured screenshot and mission report.")
    : (blockedCheckNext || "Resolve the blockage, then rerun the mission."));
  const unresolvedQuestion = explicitUnresolvedQuestion || blockedProof.unresolved_question || handoff.unresolved_question || "Does the captured state match the intended player experience?";

  const runJson = {
    schema_version: 1,
    run_id: runId,
    mission_id: mission.id,
    mission_name: mission.name || mission.id,
    project_dir: projectDir,
    result: status,
    status,
    targeted_proof_tier: targetedTier,
    reached_proof_tier: reachedTier,
    evidence,
    unproven,
    blocked_reason: blockedReason,
    human_next_step: humanNextStep,
    unresolved_question: unresolvedQuestion,
    started_at: startedAt,
    finished_at: finishedAt,
    runner,
    error: error || null,
    proof_tiers: proofTiers,
    blocked_proof: {
      what_blocked_higher_proof: higherProofReason,
      artifact_to_inspect: blockedArtifactPath,
      human_should_check_next: humanNextStep,
      unresolved_question: unresolvedQuestion,
    },
    human_handoff: {
      artifact_to_inspect: handoffArtifactPath,
      check_next: humanNextStep,
      unresolved_question: unresolvedQuestion,
    },
    artifacts,
  };

  const summary = [
    `# GRB Proof Bundle: ${mission.name || mission.id}`,
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Run ID | \`${runId}\` |`,
    `| Mission | ${mission.name || mission.id} (\`${mission.id}\`) |`,
    `| Result | **${status.toUpperCase()}** |`,
    `| Targeted proof tier | ${targetedTier} |`,
    `| Reached proof tier | ${reachedTier} |`,
    `| Started | ${startedAt} |`,
    `| Finished | ${finishedAt} |`,
    `| Screenshots | ${screenshotCount} |`,
    `| Reports | ${reportCount} |`,
    "",
    "## Proof Tiers",
    "",
    `- **W**: ${proofTiers.W.status}. ${proofTiers.W.claim}`,
    `- **R**: ${proofTiers.R.status}. ${proofTiers.R.claim}`,
    `- **E**: ${proofTiers.E.status}. ${proofTiers.E.claim}`,
    "",
    "## Evidence",
    "",
    evidence.length > 0 ? evidence.map((a) => `- ${a.type}: \`${a.path}\``).join("\n") : "- No artifacts were captured.",
    "",
    "## Still Unproven",
    "",
    unproven.map((item) => `- ${item}`).join("\n"),
    "",
    "## Human Handoff",
    "",
    blockedReason ? `- Blocked reason: ${blockedReason}` : `- Higher proof not claimed because: ${higherProofReason}`,
    `- Artifact to inspect: \`${runJson.blocked_proof.artifact_to_inspect}\``,
    `- Human should check next: ${humanNextStep}`,
    `- Unresolved question: ${unresolvedQuestion}`,
    "",
  ];

  if (error) {
    summary.push("## Runner Error", "", "```", error, "```", "");
  }

  fs.writeFileSync(path.join(runDir, "run.json"), `${JSON.stringify(runJson, null, 2)}\n`);
  fs.writeFileSync(path.join(runDir, "summary.md"), `${summary.join("\n")}\n`);

  return {
    runJsonPath: path.join(runDir, "run.json"),
    summaryPath: path.join(runDir, "summary.md"),
    runJson,
  };
}
