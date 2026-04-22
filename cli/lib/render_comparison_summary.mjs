export function renderComparisonSummary(comparison) {
  const lines = [
    `# GRB Run Comparison: ${comparison.mission_name}`,
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Result | **${comparison.result.toUpperCase()}** |`,
    `| Baseline | \`${comparison.baseline.run_id}\` |`,
    `| Candidate | \`${comparison.candidate.run_id}\` |`,
    `| Baseline mode requested | ${comparison.baseline_selection?.requested_mode || "unknown"} |`,
    `| Baseline mode used | ${comparison.baseline_selection?.effective_mode || "unknown"} |`,
    `| Baseline fallback | ${comparison.baseline_selection?.fallback ? "yes" : "no"} |`,
    `| Expectation | ${comparison.expectation} |`,
    `| Human review required | ${comparison.human_review_required ? "yes" : "no"} |`,
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
