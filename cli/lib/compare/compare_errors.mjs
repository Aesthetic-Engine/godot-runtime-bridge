import fs from "fs";

function readTextArtifact(bundle, predicate) {
  const artifact = bundle.artifacts.find(predicate);
  if (!artifact || !fs.existsSync(artifact.absolute_path)) return { artifact: null, text: "" };
  return { artifact, text: fs.readFileSync(artifact.absolute_path, "utf-8") };
}

function parseOverall(text) {
  const totalMatch = text.match(/\|\s*Total issues\s*\|\s*\*\*(\d+)\*\*\s*\|/i);
  const resultMatch = text.match(/\|\s*Result\s*\|\s*([^|]+?)\s*\|/i);
  return {
    total_issues: totalMatch ? Number(totalMatch[1]) : null,
    result: resultMatch ? resultMatch[1].trim() : null,
  };
}

export function compareErrors(baseline, candidate) {
  const baseOverall = readTextArtifact(baseline, (a) => a.path.replace(/\\/g, "/") === "mission_runner/OVERALL.md");
  const candOverall = readTextArtifact(candidate, (a) => a.path.replace(/\\/g, "/") === "mission_runner/OVERALL.md");
  const baseStderr = readTextArtifact(baseline, (a) => a.path === "runner.stderr.log");
  const candStderr = readTextArtifact(candidate, (a) => a.path === "runner.stderr.log");

  const base = parseOverall(baseOverall.text);
  const cand = parseOverall(candOverall.text);
  const stderrChanged = (baseStderr.text || "").trim() !== (candStderr.text || "").trim();
  const issueDelta = (base.total_issues == null || cand.total_issues == null)
    ? null
    : cand.total_issues - base.total_issues;

  const blocked = !baseOverall.artifact || !candOverall.artifact;
  const regression = issueDelta != null && issueDelta > 0;

  return {
    status: blocked ? "blocked" : regression ? "regression_suspected" : stderrChanged ? "difference_detected" : "matched",
    baseline_total_issues: base.total_issues,
    candidate_total_issues: cand.total_issues,
    issue_delta: issueDelta,
    stderr_changed: stderrChanged,
    baseline_overall: baseOverall.artifact?.path || null,
    candidate_overall: candOverall.artifact?.path || null,
  };
}
