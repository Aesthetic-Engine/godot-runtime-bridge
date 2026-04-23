import fs from "fs";
import path from "path";
import { loadRunBundle } from "./load_run_bundle.mjs";
import { compareScreenshotArtifacts } from "./compare/compare_screenshots.mjs";
import { compareRuntimeSummary } from "./compare/compare_runtime_summary.mjs";
import { compareErrors } from "./compare/compare_errors.mjs";
import { classifyRegression } from "./regression_classifier.mjs";
import { renderComparisonSummary } from "./render_comparison_summary.mjs";

const SUMMARY_START = "<!-- GRB_COMPARISON_START -->";
const SUMMARY_END = "<!-- GRB_COMPARISON_END -->";

function missionName(bundle) {
  return bundle.run.mission_name || bundle.run.mission_id || "unknown";
}

function readExpectation(candidate) {
  return candidate.run.compare_expectation || "no_unintended_change";
}

function oneLine(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function comparisonStats(comparison) {
  const pairs = comparison.parts?.screenshots?.pairs || [];
  const changedPairs = pairs.filter((pair) => pair.changed);
  const missingPairs = comparison.parts?.screenshots?.missing || [];
  const runtimeDiffs = comparison.parts?.runtime?.differences || [];
  const issueDelta = comparison.parts?.errors?.issue_delta;
  const stderrChanged = Boolean(comparison.parts?.errors?.stderr_changed);

  return {
    screenshot_pairs: pairs.length,
    screenshot_matched: pairs.length - changedPairs.length,
    screenshot_changed: changedPairs.length,
    screenshot_missing: missingPairs.length,
    runtime_differences: runtimeDiffs.length,
    issue_delta: issueDelta ?? null,
    stderr_changed: stderrChanged,
  };
}

function resultMeaning(result) {
  switch (result) {
    case "matched":
      return "Compared artifacts matched within the current GRB checks.";
    case "difference_detected":
      return "Differences were detected and need review; they may be intended changes or regressions.";
    case "regression_suspected":
      return "A difference conflicts with the comparison expectation and should be treated as a suspected regression until reviewed.";
    case "blocked":
      return "No trustworthy comparison was completed; fix baseline selection or choose an explicit baseline.";
    case "human_review_required":
      return "Automation found something that needs human judgment before the result can be trusted.";
    default:
      return "Review comparison.md before drawing a conclusion.";
  }
}

function resultSupport(result) {
  switch (result) {
    case "matched":
      return "This supports treating the candidate as consistent with the selected baseline for the paired artifacts.";
    case "difference_detected":
      return "This supports a focused review of changed screenshots, runtime summaries, or error surfaces.";
    case "regression_suspected":
      return "This supports holding the candidate as suspect until a human confirms the change is intended or fixes it.";
    case "blocked":
      return "This supports no regression conclusion yet because comparison did not complete trustworthily.";
    case "human_review_required":
      return "This supports a human review decision before trusting the candidate.";
    default:
      return "This supports review only after reading the comparison artifacts.";
  }
}

function nextAction(result, fallback) {
  switch (result) {
    case "matched":
      return "Inspect comparison.md and the primary artifacts; if they cover the surface you care about, continue normal review.";
    case "difference_detected":
      return "Inspect changed pairs and runtime/error deltas, then decide whether the difference was intended.";
    case "regression_suspected":
      return "Review the changed evidence before accepting the candidate; fix the regression or update the expectation/baseline only if the change is intentional.";
    case "blocked":
      return "Create or choose a trustworthy baseline, then compare again.";
    case "human_review_required":
      return oneLine(fallback || "Inspect comparison.md, then decide whether the candidate is acceptable.");
    default:
      return oneLine(fallback || "Inspect comparison.md before drawing a conclusion.");
  }
}

export function printComparisonCloseout(comparison, comparisonMdPath, comparisonJsonPath, log = console.log) {
  const stats = comparison.stats || comparisonStats(comparison);
  const selected = comparison.baseline_selection?.selected;
  const action = nextAction(comparison.result, comparison.human_next_step);

  log("");
  log("Comparison closeout:");
  log(`  Result: ${String(comparison.result || "unknown").toUpperCase()}`);
  log(`  Meaning: ${resultMeaning(comparison.result)}`);
  log(`  Supports: ${resultSupport(comparison.result)}`);
  log("  Does not prove: product correctness, design intent, or E-tier experience.");
  log(`  Baseline: ${comparison.baseline?.run_id || "none"}`);
  log(`  Candidate: ${comparison.candidate?.run_id || "unknown"}`);
  log(`  Baseline mode: ${comparison.baseline_selection?.requested_mode || "unknown"} -> ${comparison.baseline_selection?.effective_mode || "unknown"}`);
  log(`  Baseline selected because: ${selected?.reason || comparison.baseline_selection?.blocked_reason || "not selected"}`);
  log(`  Screenshot pairs: ${stats.screenshot_matched} matched, ${stats.screenshot_changed} changed, ${stats.screenshot_missing} missing`);
  log(`  Runtime differences: ${stats.runtime_differences}`);
  log(`  Issue delta: ${stats.issue_delta ?? "unknown"}; stderr changed: ${stats.stderr_changed ? "yes" : "no"}`);
  log(`  Next: ${action}`);
  log(`  Open: ${comparisonMdPath}`);
  log(`  JSON: ${comparisonJsonPath}`);
}

function defaultBaselineSelection(baseline, candidate) {
  return {
    requested_mode: "explicit_path",
    effective_mode: "explicit_path",
    candidate: {
      run_id: candidate.run.run_id || path.basename(candidate.runDir),
      path: candidate.runDir,
      mission_id: candidate.run.mission_id || null,
      result: candidate.run.result || candidate.run.status || null,
      reason: "candidate run",
    },
    selected: {
      run_id: baseline.run.run_id || path.basename(baseline.runDir),
      path: baseline.runDir,
      mission_id: baseline.run.mission_id || null,
      result: baseline.run.result || baseline.run.status || null,
      reason: "explicit baseline path supplied by user",
    },
    rejected: [],
    fallback: false,
    blocked_reason: null,
  };
}

function updateCandidateSummary(candidateRunDir, comparison) {
  const summaryPath = path.join(candidateRunDir, "summary.md");
  if (!fs.existsSync(summaryPath)) return;

  const current = fs.readFileSync(summaryPath, "utf-8");
  const action = nextAction(comparison.result, comparison.human_next_step);
  const section = [
    SUMMARY_START,
    "## Comparison",
    "",
    `- Result: **${comparison.result}**`,
    `- Baseline: \`${comparison.baseline.run_id || "none"}\``,
    `- Baseline mode: ${comparison.baseline_selection.requested_mode}`,
    `- Human review required: ${comparison.human_review_required ? "yes" : "no"}`,
    `- Meaning: ${resultMeaning(comparison.result)}`,
    `- Supports: ${resultSupport(comparison.result)}`,
    "- Does not prove: product correctness, design intent, or E-tier experience.",
    `- Next step: ${action}`,
    `- Summary: \`comparison/comparison.md\``,
    `- JSON: \`comparison/comparison.json\``,
    SUMMARY_END,
    "",
  ].join("\n");

  const pattern = new RegExp(`${SUMMARY_START}[\\s\\S]*?${SUMMARY_END}\\n?`, "m");
  const next = pattern.test(current)
    ? current.replace(pattern, section)
    : `${current.trimEnd()}\n\n${section}`;
  fs.writeFileSync(summaryPath, next);
}

export function writeBlockedComparison(candidatePath, decision, message) {
  const candidate = loadRunBundle(candidatePath);
  const comparisonDir = path.join(candidate.runDir, "comparison");
  fs.mkdirSync(comparisonDir, { recursive: true });

  const comparison = {
    comparison_version: 1,
    created_at: new Date().toISOString(),
    mission_id: candidate.run.mission_id || null,
    mission_name: missionName(candidate),
    expectation: readExpectation(candidate),
    result: "blocked",
    human_review_required: true,
    reason: message,
    stats: null,
    baseline_selection: decision,
    baseline: decision?.selected ? {
      run_id: decision.selected.run_id,
      path: decision.selected.path,
      result: decision.selected.result,
    } : {
      run_id: null,
      path: null,
      result: null,
    },
    candidate: {
      run_id: candidate.run.run_id || path.basename(candidate.runDir),
      path: candidate.runDir,
      result: candidate.run.result || candidate.run.status || null,
    },
    parts: {
      screenshots: { status: "blocked", pairs: [], missing: [] },
      runtime: { status: "blocked", differences: [], reason: "baseline selection blocked" },
      errors: { status: "blocked", baseline_total_issues: null, candidate_total_issues: null, issue_delta: null, stderr_changed: false },
    },
    human_next_step: "Select an explicit trustworthy baseline or create a passing baseline run, then compare again.",
    unresolved_question: "Which prior run is a trustworthy baseline for this candidate?",
  };
  comparison.stats = comparisonStats(comparison);

  const comparisonJsonPath = path.join(comparisonDir, "comparison.json");
  const comparisonMdPath = path.join(comparisonDir, "comparison.md");
  fs.writeFileSync(comparisonJsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
  fs.writeFileSync(comparisonMdPath, renderComparisonSummary(comparison));
  updateCandidateSummary(candidate.runDir, comparison);

  return { comparison, comparisonJsonPath, comparisonMdPath };
}

export function compareRuns(baselinePath, candidatePath, options = {}) {
  const candidate = loadRunBundle(candidatePath);
  const baseline = loadRunBundle(baselinePath);
  const comparisonDir = path.join(candidate.runDir, "comparison");
  const pairsDir = path.join(comparisonDir, "pairs");
  fs.mkdirSync(pairsDir, { recursive: true });

  if (path.resolve(baseline.runDir) === path.resolve(candidate.runDir)) {
    const decision = {
      requested_mode: options.baselineSelection?.requested_mode || "explicit_path",
      effective_mode: options.baselineSelection?.effective_mode || "explicit_path",
      selected: null,
      rejected: [{
        run_id: candidate.run.run_id || path.basename(candidate.runDir),
        path: candidate.runDir,
        mission_id: candidate.run.mission_id || null,
        result: candidate.run.result || candidate.run.status || null,
        reason: "candidate_self",
      }],
      fallback: false,
      blocked_reason: "Candidate run cannot be used as its own baseline.",
    };
    return writeBlockedComparison(candidatePath, decision, decision.blocked_reason);
  }

  const expectation = options.expectation || readExpectation(candidate);
  const baselineSelection = options.baselineSelection || defaultBaselineSelection(baseline, candidate);
  const parts = {
    screenshots: compareScreenshotArtifacts(baseline, candidate, options.screenshots || {}),
    runtime: compareRuntimeSummary(baseline, candidate),
    errors: compareErrors(baseline, candidate),
  };
  const classification = classifyRegression(parts, expectation);

  const comparison = {
    comparison_version: 1,
    created_at: new Date().toISOString(),
    mission_id: candidate.run.mission_id || null,
    mission_name: missionName(candidate),
    expectation,
    result: classification.result,
    human_review_required: classification.human_review_required,
    reason: classification.reason,
    baseline_selection: baselineSelection,
    baseline: {
      run_id: baseline.run.run_id || path.basename(baseline.runDir),
      path: baseline.runDir,
      result: baseline.run.result || baseline.run.status || null,
    },
    candidate: {
      run_id: candidate.run.run_id || path.basename(candidate.runDir),
      path: candidate.runDir,
      result: candidate.run.result || candidate.run.status || null,
    },
    parts,
    stats: null,
    human_next_step: classification.human_review_required
      ? "Inspect comparison.md, then review the paired screenshots and mission reports."
      : "No regression was suspected by the current GRB comparison checks.",
    unresolved_question: classification.human_review_required
      ? "Are the detected differences intended, acceptable, or regressions?"
      : "Do the compared artifacts cover the behavior you care about?",
  };
  comparison.stats = comparisonStats(comparison);

  for (const pair of parts.screenshots.pairs) {
    const pairPath = path.join(pairsDir, `${pair.key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
    fs.writeFileSync(pairPath, `${JSON.stringify(pair, null, 2)}\n`);
  }

  const comparisonJsonPath = path.join(comparisonDir, "comparison.json");
  const comparisonMdPath = path.join(comparisonDir, "comparison.md");
  fs.writeFileSync(comparisonJsonPath, `${JSON.stringify(comparison, null, 2)}\n`);
  fs.writeFileSync(comparisonMdPath, renderComparisonSummary(comparison));
  updateCandidateSummary(candidate.runDir, comparison);

  return {
    comparison,
    comparisonJsonPath,
    comparisonMdPath,
  };
}
