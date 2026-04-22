import fs from "fs";

function missionReports(bundle) {
  return bundle.artifacts
    .filter((artifact) => artifact.kind === "report" && /mission_runner\/.+\/report-/.test(artifact.path.replace(/\\/g, "/")))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function readReport(bundle) {
  const report = missionReports(bundle)[0];
  if (!report || !fs.existsSync(report.absolute_path)) return { report: null, fields: {} };
  const text = fs.readFileSync(report.absolute_path, "utf-8");
  const fields = {};

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase().replace(/\s+/g, "_");
    const value = match[2].trim().replace(/^`|`$/g, "");
    fields[key] = value;
  }

  return { report, fields };
}

export function compareRuntimeSummary(baseline, candidate) {
  const base = readReport(baseline);
  const cand = readReport(candidate);
  const keys = ["engine", "scene", "tier_used"];
  const differences = [];

  if (!base.report || !cand.report) {
    return {
      status: "blocked",
      differences,
      reason: "mission report missing",
    };
  }

  for (const key of keys) {
    if ((base.fields[key] || "") !== (cand.fields[key] || "")) {
      differences.push({ field: key, baseline: base.fields[key] || null, candidate: cand.fields[key] || null });
    }
  }

  return {
    status: differences.length > 0 ? "difference_detected" : "matched",
    baseline_report: base.report.path,
    candidate_report: cand.report.path,
    differences,
  };
}
