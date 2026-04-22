import fs from "fs";
import path from "path";

function toAbsolute(runDir, artifactPath) {
  return path.resolve(runDir, artifactPath.replace(/\//g, path.sep));
}

function normalizeArtifact(artifact, runDir) {
  const relPath = artifact.path || artifact.file || "";
  const kind = artifact.kind || artifact.type || "file";
  const name = path.basename(relPath, path.extname(relPath));
  const captureSlot = artifact.capture_slot || (kind === "screenshot" ? name : null);
  const role = artifact.role || (kind === "screenshot" ? "primary_screenshot" : kind);

  return {
    ...artifact,
    id: artifact.id || `${kind}:${captureSlot || relPath}`,
    kind,
    type: artifact.type || kind,
    role,
    capture_slot: captureSlot,
    path: relPath,
    absolute_path: toAbsolute(runDir, relPath),
  };
}

export function loadRunBundle(inputPath) {
  const resolved = path.resolve(inputPath);
  const runJsonPath = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()
    ? path.join(resolved, "run.json")
    : resolved;

  if (!fs.existsSync(runJsonPath)) {
    throw new Error(`run.json not found: ${runJsonPath}`);
  }

  const runDir = path.dirname(runJsonPath);
  const run = JSON.parse(fs.readFileSync(runJsonPath, "utf-8"));
  const rawArtifacts = run.artifacts || run.evidence || [];
  const artifacts = rawArtifacts.map((artifact) => normalizeArtifact(artifact, runDir));

  return {
    runDir,
    runJsonPath,
    run,
    artifacts,
  };
}
