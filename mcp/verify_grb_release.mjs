#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs";
import net from "net";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const args = parseArgs(process.argv.slice(2));

const projectPath = path.resolve(args.project || process.env.GRB_SMOKE_PROJECT || repoRoot);
const godotExe = args["godot-exe"] || process.env.GODOT_PATH || process.env.GRBB_GODOT_PATH;
const outDir = path.resolve(args["out-dir"] || path.join(__dirname, "reports", "release-smoke"));
const timeoutMs = Number(args.timeout_ms || 30000);
const allowWarnings = args["allow-warnings"] === "1" || args["allow-warnings"] === "true";

if (!godotExe) {
  console.error("Missing Godot executable. Pass --godot-exe or set GODOT_PATH.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const token = crypto.randomBytes(24).toString("hex");
const stdoutLog = path.join(outDir, "godot-stdout.log");
const stderrLog = path.join(outDir, "godot-stderr.log");
const screenshotPath = path.join(outDir, "smoke-screenshot.png");

fs.writeFileSync(stdoutLog, "", "utf8");
fs.writeFileSync(stderrLog, "", "utf8");
try {
  fs.unlinkSync(screenshotPath);
} catch {}

let child = null;
let grbPort = null;
let grbToken = token;

try {
  const ready = await launchGame();
  grbPort = ready.port;

  const ping = await sendCommand("ping");
  const auth = await sendCommand("auth_info");
  const capabilities = await sendCommand("capabilities");
  const runtimeInfo = await sendCommand("runtime_info");
  const errors = await sendCommand("get_errors", { since_index: 0 });
  const screenshot = await sendCommand("screenshot");

  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.png_base64, "base64"));

  if (!ping.ok || !auth.ok || !capabilities.ok || !runtimeInfo.ok || !errors.ok || !screenshot.ok) {
    throw new Error("One or more GRB smoke commands returned ok=false.");
  }

  if ((errors.error_count || 0) > 0) {
    throw new Error(`Smoke test found ${errors.error_count} runtime errors.`);
  }
  if (!allowWarnings && (errors.warning_count || 0) > 0) {
    throw new Error(`Smoke test found ${errors.warning_count} runtime warnings. Re-run with --allow-warnings true to permit warnings.`);
  }

  const requiredCommands = ["ping", "screenshot", "get_errors", "quit", "find_nodes", "grb_performance", "run_custom_command"];
  const missing = requiredCommands.filter((cmd) => !capabilities.commands.includes(cmd));
  if (missing.length > 0) {
    throw new Error(`Capability list is missing expected commands: ${missing.join(", ")}`);
  }

  const quit = await sendCommand("quit");
  if (!quit.ok) {
    throw new Error("Quit command failed during smoke verification.");
  }

  await waitForExit(5000);

  console.log(JSON.stringify({
    ok: true,
    project: projectPath,
    godot_exe: godotExe,
    scene: runtimeInfo.current_scene_name || runtimeInfo.current_scene || "",
    screenshot: screenshotPath,
    capability_count: capabilities.commands.length,
    warning_count: errors.warning_count || 0,
    error_count: errors.error_count || 0,
  }, null, 2));
} catch (error) {
  console.error(`[verify:grb] ${error.message}`);
  process.exitCode = 1;
} finally {
  await shutdownChild();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const part = argv[i];
    if (!part.startsWith("--")) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function launchGame() {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      GDRB_TOKEN: token,
      GDRB_TIER: "2",
      GDRB_INPUT_MODE: "synthetic",
      GDRB_FORCE_WINDOWED: "1",
      GDRB_WINDOW_WIDTH: "1280",
      GDRB_WINDOW_HEIGHT: "720",
      GDRB_SKIP_MIC_CHECK: "1",
    };
    child = spawn(godotExe, ["--path", projectPath, "--windowed"], {
      cwd: projectPath,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let settled = false;

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      fs.appendFileSync(stdoutLog, text);
      stdoutBuffer += text;
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("GDRB_READY:")) {
          settled = true;
          const ready = JSON.parse(line.slice("GDRB_READY:".length));
          resolve(ready);
          return;
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      fs.appendFileSync(stderrLog, text);
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(`Godot exited before GRB ready (code ${code}).`));
    });

    setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out waiting for GDRB_READY after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
}

function sendCommand(cmd, cmdArgs = {}) {
  return new Promise((resolve, reject) => {
    if (!grbPort || !grbToken) {
      reject(new Error(`Cannot send ${cmd}: missing GRB port/token.`));
      return;
    }

    const socket = new net.Socket();
    let buffer = "";
    const request = JSON.stringify({
      id: `verify_${cmd}_${Date.now()}`,
      proto: "grb/1",
      cmd,
      args: cmdArgs,
      token: grbToken,
    }) + "\n";

    socket.setTimeout(5000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Timeout waiting for ${cmd}.`));
    });
    socket.on("error", (error) => reject(error));
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const line = buffer.slice(0, newline);
      socket.destroy();
      const response = JSON.parse(line);
      if (response.ok === false) {
        reject(new Error(`${cmd} failed: ${response.error?.code || "error"}: ${response.error?.message || "unknown"}`));
        return;
      }
      resolve(response);
    });
    socket.connect(grbPort, "127.0.0.1", () => socket.write(request));
  });
}

function waitForExit(maxWaitMs) {
  return new Promise((resolve) => {
    if (!child) {
      resolve();
      return;
    }
    const started = Date.now();
    const poll = () => {
      if (!child || child.exitCode !== null || child.killed) {
        resolve();
        return;
      }
      if (Date.now() - started >= maxWaitMs) {
        resolve();
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

async function shutdownChild() {
  if (!child) return;
  if (child.exitCode !== null) {
    child = null;
    return;
  }
  try {
    child.kill();
  } catch {}
  await waitForExit(2000);
  child = null;
}
