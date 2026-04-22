import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "..", "..");
export const templateRoot = path.join(repoRoot, "templates", "grb2");
export const missionRunnerPath = path.join(repoRoot, "missions", "run_mission.mjs");

export function resolveProjectDir(projectDir) {
  return path.resolve(projectDir || process.cwd());
}

export function toPosixRelative(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).replace(/\\/g, "/");
}
