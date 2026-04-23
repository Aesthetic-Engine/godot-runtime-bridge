export function renderComparisonSummary(comparison) {
  const stats = comparison.stats || {};
  const meaning = comparison.result === "matched"
    ? "Compared artifacts matched within the current GRB checks."
    : comparison.result === "blocked"
      ? "No trustworthy comparison was completed; fix baseline selection or choose an explicit baseline."
      : comparison.result === "regression_suspected"
        ? "A difference conflicts with the comparison expectation and should be treated as a suspected regression until reviewed."
        : comparison.result === "difference_detected"
          ? "Differences were detected and need review; they may be intended changes or regressions."
          : comparison.result === "human_review_required"
            ? "Automation found evidence that needs human judgment before the result can be trusted."
            : "Review this comparison before drawing a conclusion.";
  const support = comparison.result === "matched"
    ? "The candidate appears consistent with the selected baseline for the screenshot/runtime/error surfaces GRB compared."
    : comparison.result === "difference_detected"
      ? "The candidate differs from the baseline in at least one compared surface, giving reviewers a focused place to inspect."
      : comparison.result === "regression_suspected"
        ? "The candidate should be treated as suspect until the changed evidence is reviewed or the baseline/expectation is intentionally updated."
        : comparison.result === "blocked"
          ? "No regression conclusion is supported yet because the baseline or comparison setup was not trustworthy."
          : "The comparison supports human review, not an automated correctness claim.";
  const nextAction = comparison.result === "matched"
    ? "Inspect the primary artifacts and confirm they cover the behavior you care about before treating this as acceptable."
    : comparison.result === "difference_detected"
      ? "Inspect changed screenshot pairs, runtime deltas, and error/log changes; decide whether the difference is intended."
      : comparison.result === "regression_suspected"
        ? "Do not accept the candidate on automation alone; fix the regression or explicitly confirm the change is intended."
        : comparison.result === "blocked"
          ? "Create or choose a trustworthy baseline, then compare again."
          : comparison.human_next_step;

  const lines = [
    `# GRB Run Comparison: ${comparison.mission_name}`,
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Result | **${comparison.result.toUpperCase()}** |`,
    `| Baseline | \`${comparison.baseline.run_id || "none"}\` |`,
    `| Candidate | \`${comparison.candidate.run_id}\` |`,
    `| Baseline mode requested | ${comparison.baseline_selection?.requested_mode || "unknown"} |`,
    `| Baseline mode used | ${comparison.baseline_selection?.effective_mode || "unknown"} |`,
    `| Baseline fallback | ${comparison.baseline_selection?.fallback ? "yes" : "no"} |`,
    `| Expectation | ${comparison.expectation} |`,
    `| Human review required | ${comparison.human_review_required ? "yes" : "no"} |`,
    "",
    "## Comparison Verdict",
    "",
    `- Meaning: ${meaning}`,
    `- Compared: \`${comparison.baseline.run_id || "none"}\` -> \`${comparison.candidate.run_id || "unknown"}\``,
    `- Screenshot pairs: ${stats.screenshot_matched ?? "unknown"} matched, ${stats.screenshot_changed ?? "unknown"} changed, ${stats.screenshot_missing ?? "unknown"} missing`,
    `- Runtime differences: ${stats.runtime_differences ?? "unknown"}`,
    `- Issue delta: ${stats.issue_delta ?? "unknown"}`,
    `- Next step: ${nextAction}`,
    "",
    "## What This Comparison Supports",
    "",
    `- ${support}`,
    "- It can support regression review for the artifacts GRB paired and summarized.",
    "- It does not prove product correctness, design intent, accessibility, fun, or E-tier experience.",
    "",
    "## Still Needs Human Judgment",
    "",
    `- ${comparison.unresolved_question}`,
    "- Whether the selected baseline was actually a trustworthy reference for this surface.",
    "- Whether the mission covers the behavior users actually care about.",
    "",
    "## Baseline Selection",
    "",
    comparison.baseline_selection?.selected
      ? `- Selected: \`${comparison.baseline_selection.selected.run_id}\` (${comparison.baseline_selection.selected.reason})`
      : "- Selected: none",
    comparison.baseline_selection?.selected?.path
      ? `- Path: \`${comparison.baseline_selection.selected.path}\``
      : "",
    "",
    "### Rejected Candidates",
    "",
    ...(comparison.baseline_selection?.rejected?.length
      ? comparison.baseline_selection.rejected.map((item) => `- \`${item.run_id || item.path}\`: ${item.reason}`)
      : ["- None"]),
    "",
    "## Screenshot Comparison",
    "",
  ];

  const screenshots = comparison.parts.screenshots;
  if (screenshots.pairs.length === 0) {
    lines.push("- No screenshot pairs compared.");
  } else {
    for (const pair of screenshots.pairs) {
      lines.push(`- \`${pair.key}\`: ${pair.changed ? "changed" : "matched"} (${pair.detail})`);
    }
  }
  for (const missing of screenshots.missing || []) {
    lines.push(`- blocked pair \`${missing.key}\`: ${missing.reason}`);
  }

  lines.push("", "## Runtime Summary", "");
  const runtime = comparison.parts.runtime;
  if (runtime.differences?.length) {
    for (const diff of runtime.differences) {
      lines.push(`- ${diff.field}: \`${diff.baseline}\` -> \`${diff.candidate}\``);
    }
  } else {
    lines.push(`- ${runtime.status}`);
  }

  lines.push("", "## Errors / Issues", "");
  const errors = comparison.parts.errors;
  lines.push(`- Baseline issues: ${errors.baseline_total_issues ?? "unknown"}`);
  lines.push(`- Candidate issues: ${errors.candidate_total_issues ?? "unknown"}`);
  lines.push(`- Issue delta: ${errors.issue_delta ?? "unknown"}`);
  lines.push(`- stderr changed: ${errors.stderr_changed ? "yes" : "no"}`);

  lines.push("", "## Human Handoff", "");
  lines.push(`- Reason: ${comparison.reason}`);
  lines.push(`- Next step: ${comparison.human_next_step}`);
  lines.push(`- Unresolved question: ${comparison.unresolved_question}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}
