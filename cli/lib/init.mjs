import fs from "fs";
import path from "path";
import { repoRoot, resolveProjectDir, templateRoot } from "./paths.mjs";

function copyTemplateTree(srcDir, destDir, projectDir, entries) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    const rel = path.relative(projectDir, dest).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyTemplateTree(src, dest, projectDir, entries);
      continue;
    }

    if (fs.existsSync(dest)) {
      entries.push({ status: "skipped", path: rel });
      continue;
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    entries.push({ status: "created", path: rel });
  }
}

function formatLauncherPath() {
  return process.platform === "win32"
    ? `${repoRoot}\\grb.cmd`
    : `${repoRoot}/grb`;
}

function formatFirstProofCommand(projectDir) {
  return `"${formatLauncherPath()}" mission run smoke_boot --project "${projectDir}" --exe <godot_exe>`;
}

function formatYamlSingleQuoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function shouldPatchTemplateValue(value) {
  const text = String(value || "").trim();
  return (
    text.length === 0 ||
    text.includes("<set-by-grb-init>") ||
    text.includes("<path-to-grb-main>") ||
    text.includes("node <path-to-grb-main>/cli/grb.mjs") ||
    text.includes("C:\\path\\to\\grb-main\\grb.cmd") ||
    text.includes("/path/to/grb-main/grb") ||
    text.includes("<project>")
  );
}

function patchProjectContract(projectDir) {
  const contractPath = path.join(projectDir, "grb.project.yaml");
  if (!fs.existsSync(contractPath)) {
    return {
      contractPath,
      repoRoot,
      launcherPath: formatLauncherPath(),
      firstProofCommand: formatFirstProofCommand(projectDir),
      repoRootRecorded: false,
      firstProofCommandRecorded: false,
    };
  }

  const original = fs.readFileSync(contractPath, "utf-8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const repoRootLine = `grb_repo_root: "${repoRoot}"`;
  const commandLine = `  command: ${formatYamlSingleQuoted(formatFirstProofCommand(projectDir))}`;
  let text = original;
  let repoRootRecorded = false;
  let firstProofCommandRecorded = false;

  const repoRootMatch = text.match(/^grb_repo_root:\s*(.+)$/m);
  if (!repoRootMatch) {
    text = text.replace(/^grb_version:.*$/m, (line) => `${line}${newline}${repoRootLine}`);
    repoRootRecorded = true;
  } else if (shouldPatchTemplateValue(repoRootMatch[1])) {
    text = text.replace(/^grb_repo_root:\s*.+$/m, repoRootLine);
    repoRootRecorded = true;
  }

  const commandMatch = text.match(/^  command:\s*(.+)$/m);
  if (commandMatch && shouldPatchTemplateValue(commandMatch[1])) {
    text = text.replace(/^  command:\s*.+$/m, commandLine);
    firstProofCommandRecorded = true;
  }

  if (text !== original) {
    fs.writeFileSync(contractPath, text);
  }

  return {
    contractPath,
    repoRoot,
    launcherPath: formatLauncherPath(),
    firstProofCommand: formatFirstProofCommand(projectDir),
    repoRootRecorded,
    firstProofCommandRecorded,
  };
}

export function initProject(options = {}) {
  const projectDir = resolveProjectDir(options.projectDir);
  const entries = [];

  if (!fs.existsSync(templateRoot)) {
    throw new Error(`Template directory not found: ${templateRoot}`);
  }

  fs.mkdirSync(projectDir, { recursive: true });
  copyTemplateTree(templateRoot, projectDir, projectDir, entries);

  const reportsDir = path.join(projectDir, "grb_reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  entries.push({ status: "ready", path: "grb_reports/" });

  const repoLinkage = patchProjectContract(projectDir);

  return {
    projectDir,
    entries,
    repoLinkage,
    projectGodotExists: fs.existsSync(path.join(projectDir, "project.godot")),
  };
}
