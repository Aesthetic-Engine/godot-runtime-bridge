#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { baselineBlockedText, baselineReasonText, blockedNextStep } from "../cli/lib/baseline_reason_text.mjs";
import { renderComparisonSummary } from "../cli/lib/render_comparison_summary.mjs";
import { writeProofBundle } from "../cli/lib/proof_bundle.mjs";
import { parseSimpleYaml } from "../cli/lib/simple_yaml.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, needle, label) {
  assert(String(text).includes(needle), `${label} missing expected text: ${needle}`);
}

function assertReadableReason(raw, expected, forbidden = raw) {
  const rendered = baselineReasonText(raw);
  assertIncludes(rendered, expected, `reason ${raw}`);
  assert(rendered !== forbidden, `reason ${raw} leaked raw/internal wording`);
}

function checkBaselineReasonText() {
  assertReadableReason("candidate_self", "cannot be used as its own baseline");
  assertReadableReason("mission_mismatch", "different mission");
  assertReadableReason("missing_run_json", "does not contain run.json");
  assertReadableReason("unusable_result:blocked", "result 'blocked'");
  assertReadableReason("load_failed:Unexpected token", "could not be loaded");

  const blocked = baselineBlockedText("No eligible passing baseline found for mission hud_state_check.");
  assertIncludes(blocked, "No prior passing run exists yet", "blocked baseline text");
  assertIncludes(
    blockedNextStep("No eligible passing baseline found for mission hud_state_check."),
    "Run this mission once",
    "blocked next step"
  );
}

function syntheticBlockedComparison() {
  return {
    comparison_version: 1,
    mission_name: "HUD State Check",
    result: "blocked",
    expectation: "no_unintended_change",
    human_review_required: true,
    reason: "No eligible passing baseline found for mission hud_state_check.",
    human_next_step: "Select an explicit trustworthy baseline or create a passing baseline run, then compare again.",
    unresolved_question: "Which prior run is a trustworthy baseline for this candidate?",
    stats: {
      screenshot_matched: 0,
      screenshot_changed: 0,
      screenshot_missing: 0,
      runtime_differences: 0,
      issue_delta: null,
      stderr_changed: false,
    },
    baseline_selection: {
      requested_mode: "latest",
      effective_mode: "latest_successful_same_mission",
      fallback: true,
      blocked_reason: "No eligible passing baseline found for mission hud_state_check.",
      selected: null,
      rejected: [
        { run_id: "candidate", path: "grb_reports/candidate", reason: "candidate_self" },
        { run_id: "other_mission", path: "grb_reports/other", reason: "mission_mismatch" },
        { run_id: "blocked_run", path: "grb_reports/blocked", reason: "unusable_result:blocked" },
        { path: "grb_reports/corrupt", reason: "load_failed:Unexpected token" },
      ],
    },
    baseline: { run_id: null, path: null, result: null },
    candidate: { run_id: "candidate", path: "grb_reports/candidate", result: "pass" },
    parts: {
      screenshots: { status: "blocked", pairs: [], missing: [] },
      runtime: { status: "blocked", differences: [] },
      errors: {
        status: "blocked",
        baseline_total_issues: null,
        candidate_total_issues: null,
        issue_delta: null,
        stderr_changed: false,
      },
    },
  };
}

function checkBlockedComparisonSummary() {
  const summary = renderComparisonSummary(syntheticBlockedComparison());

  assertIncludes(summary, "## Comparison Verdict", "blocked comparison summary");
  assertIncludes(summary, "No prior passing run exists yet", "blocked comparison summary");
  assertIncludes(summary, "## Baseline Selection", "blocked comparison summary");
  assertIncludes(summary, "### Rejected Candidates", "blocked comparison summary");
  assertIncludes(summary, "The candidate cannot be used as its own baseline", "blocked comparison summary");
  assertIncludes(summary, "This run belongs to a different mission", "blocked comparison summary");
  assertIncludes(summary, "This run ended with result 'blocked'", "blocked comparison summary");
  assertIncludes(summary, "This run bundle could not be loaded", "blocked comparison summary");
  assertIncludes(summary, "Run this mission once", "blocked comparison summary");
  assertIncludes(summary, "It does not prove product correctness", "blocked comparison summary");
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function makeProofBundle(tempRoot, name, status, files) {
  const projectDir = path.join(tempRoot, "project");
  const runDir = path.join(projectDir, "grb_reports", name);
  writeFile(path.join(projectDir, "grb", "regression_workflow.md"), "# Regression Workflow\n");

  for (const [relPath, content] of Object.entries(files)) {
    writeFile(path.join(runDir, relPath), content);
  }

  return writeProofBundle({
    runDir,
    runId: name,
    projectDir,
    mission: {
      id: "demo",
      name: "Demo Mission",
      targeted_proof_tier: "R",
      human_handoff: {
        artifact_to_inspect: "mission_runner/demo/after.png",
        check_next: "Confirm the after screenshot shows the intended state.",
        unresolved_question: "Does the UI look right?",
      },
      blocked_proof: {
        artifact_to_inspect: "runner.stderr.log",
        human_should_check_next: "Fix the launch error, then rerun.",
        unresolved_question: "Can the mission launch cleanly?",
      },
    },
    status,
    startedAt: "2026-04-23T00:00:00Z",
    finishedAt: "2026-04-23T00:00:01Z",
    runner: { command: null, exit_code: status === "pass" ? 0 : 1 },
    error: status === "pass" ? null : "Synthetic blocked error",
  });
}

function checkProofBundleSummary() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grb2-product-shape-"));

  try {
    const passing = makeProofBundle(tempRoot, "passing", "pass", {
      "mission_runner/demo/after.png": "png",
      "mission_runner/demo/report-1.md": "# Report\n",
    });
    const passSummary = fs.readFileSync(passing.summaryPath, "utf-8");
    const passJson = JSON.parse(fs.readFileSync(passing.runJsonPath, "utf-8"));

    assertIncludes(passSummary, "## Review Verdict", "passing proof summary");
    assertIncludes(passSummary, "Primary artifact: `mission_runner/demo/after.png`", "passing proof summary");
    assertIncludes(passSummary, "primary review screenshot", "passing proof summary");
    assertIncludes(passSummary, "Reviewer should check", "passing proof summary");
    assertIncludes(passSummary, "Trust boundary", "passing proof summary");
    assertIncludes(passSummary, "## Human Handoff", "passing proof summary");
    assert(passJson.primary_review_artifact?.path === "mission_runner/demo/after.png", "passing run.json primary review artifact mismatch");
    assert(passJson.artifacts.some((item) => item.review_primary), "passing run.json should mark a primary artifact");

    const blocked = makeProofBundle(tempRoot, "blocked", "blocked", {
      "runner.stderr.log": "stderr",
    });
    const blockedSummary = fs.readFileSync(blocked.summaryPath, "utf-8");
    const blockedJson = JSON.parse(fs.readFileSync(blocked.runJsonPath, "utf-8"));

    assertIncludes(blockedSummary, "runner.stderr.log", "blocked proof summary");
    assertIncludes(blockedSummary, "blocked-run review artifact", "blocked proof summary");
    assertIncludes(blockedSummary, "Safe assumption: no higher proof should be claimed", "blocked proof summary");
    assert(blockedJson.primary_review_artifact?.path === "runner.stderr.log", "blocked run.json primary review artifact mismatch");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkContractShape() {
  const required = ["name", "default_recipe", "missions", "read_first", "proof_reports_dir"];
  const files = [
    "templates/grb2/grb.project.yaml",
    "examples/grb2-proving-ground/grb.project.yaml",
  ];

  for (const relPath of files) {
    const fullPath = path.join(repoRoot, relPath);
    const parsed = parseSimpleYaml(fs.readFileSync(fullPath, "utf-8"));

    for (const key of required) {
      assert(key in parsed, `${relPath} missing required contract field: ${key}`);
    }
    assert(Array.isArray(parsed.missions), `${relPath} missions must be a list`);
    assert(parsed.missions.length > 0, `${relPath} missions must not be empty`);
    assert(Array.isArray(parsed.read_first), `${relPath} read_first must be a list`);
    assert(parsed.read_first.includes("AGENTS.md"), `${relPath} read_first should include AGENTS.md`);
    assert(parsed.read_first.includes("grb.project.yaml"), `${relPath} read_first should include grb.project.yaml`);
  }
}

function checkChannelAndDocTruth() {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf-8");
  const legacyMissions = fs.readFileSync(path.join(repoRoot, "missions", "README.md"), "utf-8");
  const ciDoc = fs.readFileSync(path.join(repoRoot, "docs", "ci.md"), "utf-8");
  const authoring = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "grb", "mission_authoring.md"), "utf-8");
  const regression = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "grb", "regression_workflow.md"), "utf-8");
  const agents = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "AGENTS.md"), "utf-8");

  assertIncludes(readme, "## Choose the Right Install Path", "README channel truth");
  assertIncludes(readme, "Addon-only / AssetLib path", "README channel truth");
  assertIncludes(readme, "Full repo clone", "README channel truth");
  assertIncludes(readme, "GRB 2.0 proof workflow", "README channel truth");
  assertIncludes(readme, "Current export/archive packaging is addon-oriented", "README channel truth");
  assertIncludes(readme, "This is a **full-repo workflow**, not an addon-only workflow.", "README proof channel truth");

  assertIncludes(legacyMissions, "# Legacy Built-In Mission Pack", "legacy mission doc");
  assertIncludes(legacyMissions, "project-local proof workflow", "legacy mission doc");
  assertIncludes(legacyMissions, "built-in pack ships **15** generic missions", "legacy mission doc");
  assertIncludes(legacyMissions, "--mission starters", "legacy mission doc");
  assertIncludes(ciDoc, "Repo-Level Release Smoke", "CI doc truth");
  assertIncludes(ciDoc, "Project-Level GRB 2.0 Proof Workflows", "CI doc truth");
  assertIncludes(ciDoc, "legacy mission runner", "CI doc truth");

  assertIncludes(authoring, "## Stable Capture Slots", "mission authoring contract");
  assertIncludes(authoring, "treat screenshot labels as", "mission authoring contract");
  assertIncludes(authoring, "stable surface rather than deep semantic understanding", "mission authoring contract");
  assertIncludes(regression, "## Stable Evidence Surfaces", "regression workflow contract");
  assertIncludes(regression, "not a strong regression surface yet", "regression workflow contract");
  assertIncludes(agents, "Treat screenshot labels as capture slots", "agent contract");
}

function checkContributorReadmeTruth() {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf-8");
  assertIncludes(readme, "### CLI Exit Codes", "README contributor closeout");
  assertIncludes(readme, "`mission run` exits:", "README contributor closeout");
  assertIncludes(readme, "`compare` exits:", "README contributor closeout");
  assertIncludes(readme, "compatible GRB proof bundle directories", "README contributor closeout");
  assertIncludes(readme, "This still does not prove product correctness", "README contributor closeout");
}

function main() {
  checkBaselineReasonText();
  console.log("ok baseline reason text");

  checkBlockedComparisonSummary();
  console.log("ok blocked comparison summary");

  checkProofBundleSummary();
  console.log("ok proof bundle review path");

  checkContractShape();
  console.log("ok GRB 2.0 contract shape");

  checkChannelAndDocTruth();
  console.log("ok channel and doc truth");

  checkContributorReadmeTruth();
  console.log("ok contributor README truth");
}

try {
  main();
} catch (err) {
  console.error(`GRB 2.0 product-shape verification failed: ${err.message}`);
  process.exit(1);
}
