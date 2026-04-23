#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { baselineBlockedText, baselineReasonText, blockedNextStep } from "../cli/lib/baseline_reason_text.mjs";
import { renderComparisonSummary } from "../cli/lib/render_comparison_summary.mjs";
import { initProject } from "../cli/lib/init.mjs";
import { inspectProjectReadiness } from "../cli/lib/smoke_boot.mjs";
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
  const required = ["name", "grb_repo_root", "default_recipe", "missions", "read_first", "proof_reports_dir"];
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

function checkInitStampedRepoLinkage() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grb2-init-linkage-"));

  try {
    writeFile(path.join(tempRoot, "project.godot"), "; synthetic project\n");
    const result = initProject({ projectDir: tempRoot });
    const contractPath = path.join(tempRoot, "grb.project.yaml");
    const contractText = fs.readFileSync(contractPath, "utf-8");
    const parsed = parseSimpleYaml(contractText);
    const expectedLauncher = process.platform === "win32"
      ? `${repoRoot}\\grb.cmd`
      : `${repoRoot}/grb`;

    assert(parsed.grb_repo_root === repoRoot, "init should stamp actual grb_repo_root into generated contract");
    assertIncludes(
      parsed.first_trustworthy_proof_run.command,
      `"${expectedLauncher}" mission run smoke_boot --project "${tempRoot}" --exe <godot_exe>`,
      "init-stamped first proof command"
    );
    assert(!contractText.includes("<set-by-grb-init>"), "generated contract should not keep repo-linkage placeholders after init");
    assert(result.repoLinkage.repoRoot === repoRoot, "init result should expose recorded repo root");
    assert(result.repoLinkage.launcherPath === expectedLauncher, "init result should expose recorded launcher path");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkInitRepoLinkagePatchSafety() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grb2-init-linkage-patch-"));

  try {
    const placeholderProject = path.join(tempRoot, "placeholder");
    fs.mkdirSync(placeholderProject, { recursive: true });
    writeFile(path.join(placeholderProject, "project.godot"), "; placeholder project\n");
    writeFile(
      path.join(placeholderProject, "grb.project.yaml"),
      [
        'name: Existing Project',
        'grb_version: "2.0"',
        'default_recipe: default',
        'missions:',
        '  - smoke_boot',
        'read_first:',
        '  - AGENTS.md',
        '  - grb.project.yaml',
        'proof_reports_dir: grb_reports',
        'first_trustworthy_proof_run:',
        '  command: C:\\path\\to\\grb-main\\grb.cmd mission run smoke_boot --project <project> --exe <godot_exe>',
        '  inspect: grb_reports/<run-id>/summary.md',
        '',
      ].join("\n")
    );

    initProject({ projectDir: placeholderProject });
    const patched = parseSimpleYaml(fs.readFileSync(path.join(placeholderProject, "grb.project.yaml"), "utf-8"));
    assert(patched.grb_repo_root === repoRoot, "init should patch placeholder contracts with the active repo root");
    assertIncludes(
      patched.first_trustworthy_proof_run.command,
      `"${process.platform === "win32" ? `${repoRoot}\\grb.cmd` : `${repoRoot}/grb`}" mission run smoke_boot --project "${placeholderProject}" --exe <godot_exe>`,
      "patched placeholder contract"
    );

    const preservedProject = path.join(tempRoot, "preserved");
    fs.mkdirSync(preservedProject, { recursive: true });
    writeFile(path.join(preservedProject, "project.godot"), "; preserved project\n");
    writeFile(
      path.join(preservedProject, "grb.project.yaml"),
      [
        'name: Existing Project',
        'grb_version: "2.0"',
        'grb_repo_root: "D:\\Custom\\grb-main"',
        'default_recipe: default',
        'missions:',
        '  - smoke_boot',
        'read_first:',
        '  - AGENTS.md',
        '  - grb.project.yaml',
        'proof_reports_dir: grb_reports',
        'first_trustworthy_proof_run:',
        "  command: '\"D:\\Custom\\grb-main\\grb.cmd\" mission run smoke_boot --project \"D:\\Games\\Proj\" --exe <godot_exe>'",
        '  inspect: grb_reports/<run-id>/summary.md',
        '',
      ].join("\n")
    );

    initProject({ projectDir: preservedProject });
    const preserved = parseSimpleYaml(fs.readFileSync(path.join(preservedProject, "grb.project.yaml"), "utf-8"));
    assert(preserved.grb_repo_root === "D:\\Custom\\grb-main", "init should preserve a real custom grb_repo_root");
    assert(
      preserved.first_trustworthy_proof_run.command === '"D:\\Custom\\grb-main\\grb.cmd" mission run smoke_boot --project "D:\\Games\\Proj" --exe <godot_exe>',
      "init should preserve a real custom first proof command"
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkDoctorReadiness() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "grb2-doctor-"));

  try {
    const readyProject = path.join(tempRoot, "ready");
    fs.mkdirSync(readyProject, { recursive: true });
    writeFile(path.join(readyProject, "project.godot"), "; ready project\n");
    initProject({ projectDir: readyProject });
    fs.mkdirSync(path.join(readyProject, "addons", "godot-runtime-bridge"), { recursive: true });
    fs.mkdirSync(path.join(readyProject, ".godot"), { recursive: true });
    const fakeExe = path.join(tempRoot, "Godot_console.exe");
    writeFile(fakeExe, "fake exe");

    const ready = inspectProjectReadiness({ projectDir: readyProject, exe: fakeExe });
    assert(ready.ready, "doctor should report a fully prepared synthetic project as ready");
    assert(ready.launcherPath && ready.launcherPath.endsWith(process.platform === "win32" ? "grb.cmd" : "grb"), "doctor should resolve the repo launcher path");
    assertIncludes(ready.smokeBootCommand, "mission run smoke_boot", "doctor ready command");

    const blockedProject = path.join(tempRoot, "blocked");
    fs.mkdirSync(blockedProject, { recursive: true });
    writeFile(path.join(blockedProject, "project.godot"), "; blocked project\n");
    initProject({ projectDir: blockedProject });

    const blocked = inspectProjectReadiness({ projectDir: blockedProject });
    assert(!blocked.ready, "doctor should report missing addon/metadata/exe setup as not ready");
    assert(blocked.checks.some((item) => item.label === "GRB addon" && item.status === "fail"), "doctor should flag a missing addon");
    assert(blocked.checks.some((item) => item.label === "Godot metadata" && item.status === "fail"), "doctor should flag missing .godot metadata");
    assert(blocked.checks.some((item) => item.label === "Godot executable" && item.status === "fail"), "doctor should flag a missing Godot executable");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function checkChannelAndDocTruth() {
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf-8");
  const legacyMissions = fs.readFileSync(path.join(repoRoot, "missions", "README.md"), "utf-8");
  const ciDoc = fs.readFileSync(path.join(repoRoot, "docs", "ci.md"), "utf-8");
  const authoring = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "grb", "mission_authoring.md"), "utf-8");
  const regression = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "grb", "regression_workflow.md"), "utf-8");
  const agents = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "AGENTS.md"), "utf-8");
  const projectYaml = fs.readFileSync(path.join(repoRoot, "templates", "grb2", "grb.project.yaml"), "utf-8");
  const provingGround = fs.readFileSync(path.join(repoRoot, "examples", "grb2-proving-ground", "README.md"), "utf-8");
  const cliHelp = fs.readFileSync(path.join(repoRoot, "cli", "grb.mjs"), "utf-8");
  const wrapperCmd = fs.readFileSync(path.join(repoRoot, "grb.cmd"), "utf-8");
  const wrapperPosix = fs.readFileSync(path.join(repoRoot, "grb"), "utf-8");

  assert(fs.existsSync(path.join(repoRoot, "grb.cmd")), "repo-root grb.cmd launcher missing");
  assert(fs.existsSync(path.join(repoRoot, "grb")), "repo-root grb launcher missing");
  assertIncludes(wrapperCmd, 'cli\\grb.mjs', "Windows launcher");
  assertIncludes(wrapperCmd, "GRB requires Node.js on PATH.", "Windows launcher");
  assertIncludes(wrapperPosix, "cli/grb.mjs", "POSIX launcher");
  assertIncludes(wrapperPosix, "GRB requires Node.js on PATH.", "POSIX launcher");

  assertIncludes(readme, "## Choose the Right Install Path", "README channel truth");
  assertIncludes(readme, "Addon-only / AssetLib path", "README channel truth");
  assertIncludes(readme, "Full repo clone", "README channel truth");
  assertIncludes(readme, "GRB 2.0 proof workflow", "README channel truth");
  assertIncludes(readme, "Current export/archive packaging is addon-oriented", "README channel truth");
  assertIncludes(readme, "This is a **full-repo workflow**, not an addon-only workflow.", "README proof channel truth");
  assertIncludes(readme, "grb.cmd ...` on Windows", "README launcher truth");
  assertIncludes(readme, "`./grb ...` on POSIX", "README launcher truth");
  assertIncludes(readme, "Run `grb doctor`", "README doctor truth");
  assertIncludes(readme, "doctor` is a no-launch preflight check", "README doctor truth");
  assert(!readme.includes("node C:\\path\\to\\grb-main\\cli\\grb.mjs"), "README should not primarily teach raw cli/grb.mjs path");

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
  assertIncludes(agents, "grb.project.yaml", "agent launcher contract");
  assertIncludes(agents, "grb_repo_root", "agent launcher contract");
  assertIncludes(agents, "local GRB repo linkage", "agent launcher contract");
  assertIncludes(agents, "repo-root `doctor` command", "agent doctor contract");
  assert(!agents.includes("node <path-to-grb-main>/cli/grb.mjs"), "AGENTS should not primarily teach raw cli/grb.mjs path");
  assertIncludes(projectYaml, "grb_repo_root", "project yaml launcher contract");
  assertIncludes(projectYaml, "<set-by-grb-init>", "project yaml launcher contract");
  assert(!projectYaml.includes("node <path-to-grb-main>/cli/grb.mjs"), "grb.project.yaml should not primarily teach raw cli/grb.mjs path");
  assertIncludes(provingGround, "grb.cmd mission run smoke_boot", "proving ground launcher truth");
  assertIncludes(provingGround, "..\\..\\grb.cmd mission run smoke_boot", "proving ground launcher truth");
  assert(!provingGround.includes("node cli/grb.mjs mission run smoke_boot"), "proving ground README should not primarily teach raw cli/grb.mjs path");
  assertIncludes(cliHelp, "grb.cmd init", "CLI help launcher truth");
  assertIncludes(cliHelp, "./grb init", "CLI help launcher truth");
  assertIncludes(cliHelp, "grb.cmd doctor", "CLI help doctor truth");
  assertIncludes(cliHelp, "doctor checks project readiness without launching Godot.", "CLI help doctor truth");
  assertIncludes(readme, "grb init` also records the full-repo GRB linkage", "README init linkage truth");
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

  checkInitStampedRepoLinkage();
  console.log("ok init-stamped repo linkage");

  checkInitRepoLinkagePatchSafety();
  console.log("ok init linkage patch safety");

  checkDoctorReadiness();
  console.log("ok doctor readiness");

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
