import fs from "fs";
import { compareScreenshots as comparePngBase64 } from "../../../missions/perceptual_diff.mjs";

function screenshotKey(artifact) {
  return artifact.capture_slot || artifact.id || artifact.path;
}

export function compareScreenshotArtifacts(baseline, candidate, options = {}) {
  const baselineShots = baseline.artifacts.filter((a) => a.kind === "screenshot");
  const candidateShots = candidate.artifacts.filter((a) => a.kind === "screenshot");
  const baselineByKey = new Map(baselineShots.map((artifact) => [screenshotKey(artifact), artifact]));
  const pairs = [];
  const missing = [];

  for (const candidateShot of candidateShots) {
    const key = screenshotKey(candidateShot);
    const baselineShot = baselineByKey.get(key);
    if (!baselineShot) {
      missing.push({ key, candidate: candidateShot.path, reason: "missing_baseline_pair" });
      continue;
    }

    if (!fs.existsSync(baselineShot.absolute_path) || !fs.existsSync(candidateShot.absolute_path)) {
      missing.push({ key, baseline: baselineShot.path, candidate: candidateShot.path, reason: "missing_file" });
      continue;
    }

    const baselineB64 = fs.readFileSync(baselineShot.absolute_path).toString("base64");
    const candidateB64 = fs.readFileSync(candidateShot.absolute_path).toString("base64");
    const result = comparePngBase64(baselineB64, candidateB64, options);

    pairs.push({
      key,
      baseline: baselineShot.path,
      candidate: candidateShot.path,
      changed: result.changed,
      ratio: result.ratio,
      detail: result.detail,
    });
  }

  return {
    status: missing.length > 0 ? "blocked" : pairs.some((pair) => pair.changed) ? "difference_detected" : "matched",
    pairs,
    missing,
  };
}
