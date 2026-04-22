import fs from "fs";
import path from "path";
import { resolveProjectDir, templateRoot } from "./paths.mjs";

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

  return { projectDir, entries };
}
