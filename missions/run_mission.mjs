#!/usr/bin/env node
/**
 * Godot Runtime Bridge — Mission Runner
 *
 * Executes scripted QA missions against a running (or auto-launched) Godot game.
 * Produces a markdown report with screenshots and ticketable issue cards.
 *
 * Usage:
 *   node run_mission.mjs --mission smoke_test --exe "C:\Godot\godot.exe" --project "C:\MyGame"
 *   node run_mission.mjs --mission all --exe "..." --project "..."
 *   node run_mission.mjs --list
 *
 * Flags:
 *   --mode background   Run in background: windowed, no cursor theft (default)
 *   --mode watch        Run in foreground: fullscreen, OS cursor, visible to user
 *   --reset             Reset to home screen before each mission (implied for --mission all)
 *   --no-reset          Disable auto-reset even for --mission all
 *   --diff-block-thresh Per-block channel diff threshold, 0-255 (default: 8)
 *   --diff-change-thresh Fraction of blocks that must differ, 0.0-1.0 (default: 0.03)
 */

import net from "net";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { compareScreenshots, compareToReference } from "./perceptual_diff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MISSIONS_FILE = path.join(__dirname, "missions.json");
const OUTPUT_DIR = path.join(__dirname, "reports");
const REFS_DIR = path.join(__dirname, "references");

// ── CLI args ──

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--list") { flags.list = true; }
  else if (args[i] === "--reset") { flags.reset = true; }
  else if (args[i] === "--no-reset") { flags.noReset = true; }
  else if (args[i] === "--capture-refs") { flags.captureRefs = true; }
  else if (args[i] === "--allow-boot-errors") { flags["allow-boot-errors"] = true; }
  else if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
    flags[args[i].slice(2)] = args[i + 1];
    i++;
  }
}

const _mf = flags["missions-file"] || flags.missionsFile;
const missionsFile = _mf
  ? (path.isAbsolute(_mf) ? _mf : path.join(__dirname, _mf))
  : DEFAULT_MISSIONS_FILE;
const missions = JSON.parse(fs.readFileSync(missionsFile, "utf-8"));

if (flags.list) {
  console.log("\nAvailable Missions:\n");
  for (const m of missions) {
    const star = m.starter ? " ★" : "";
    console.log(`  ${m.id.padEnd(35)} ${m.name}${star}`);
  }
  console.log("\n★ = 1-minute starter mission\n");
  process.exit(0);
}

if (!flags.mission) {
  console.error("Usage: node run_mission.mjs --mission <id|all|starters> --exe <godot_exe> --project <path>");
  console.error("Flags: --reset  --no-reset  --list");
  process.exit(1);
}
if (!flags.exe || !flags.project) {
  console.error("Error: --exe and --project are required");
  process.exit(1);
}

// ── GRB Client ──

let grbPort = null;
let grbToken = null;
let grbProcess = null;
let reqCounter = 0;

function nextId() { return `mr_${++reqCounter}`; }

function sendCommand(cmd, cmdArgs = {}) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    const req = JSON.stringify({
      id: nextId(), proto: "grb/1", cmd, args: cmdArgs, token: grbToken
    }) + "\n";
    let buf = "";
    sock.setTimeout(15000);
    sock.on("timeout", () => { sock.destroy(); reject(new Error("timeout: " + cmd)); });
    sock.on("error", reject);
    sock.on("data", (d) => {
      buf += d.toString();
      const idx = buf.indexOf("\n");
      if (idx >= 0) { sock.destroy(); try { resolve(JSON.parse(buf.slice(0, idx))); } catch (e) { reject(e); } }
    });
    sock.connect(grbPort, "127.0.0.1", () => sock.write(req));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function launchGame(exe, project, tier = 1) {
  const token = crypto.randomBytes(16).toString("hex");
  const isWatch = (flags.mode === "watch");
  const godotArgs = ["--path", project, "--windowed", "--resolution", "1280x720", "--position", "50,50"];
  const envVars = {
    ...process.env,
    GDRB_TOKEN: token,
    GDRB_TIER: String(tier),
    GDRB_INPUT_MODE: "synthetic",
    GDRB_FORCE_WINDOWED: "1",
  };
  const child = spawn(exe, godotArgs, {
    cwd: project,
    env: envVars,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderrBuf = "";
  child.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });
  child.stderrBuffer = () => stderrBuf;
  grbProcess = child;

  return new Promise((resolve, reject) => {
    let stdoutBuf = "";
    const timeout = setTimeout(() => reject(new Error("GDRB_READY timeout")), 30000);
    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      for (const line of stdoutBuf.split("\n")) {
        if (line.startsWith("GDRB_READY:")) {
          clearTimeout(timeout);
          const data = JSON.parse(line.slice("GDRB_READY:".length));
          grbPort = data.port;
          grbToken = data.token;
          resolve(data);
          return;
        }
      }
      stdoutBuf = stdoutBuf.split("\n").pop();
    });
    child.on("exit", (code) => { clearTimeout(timeout); reject(new Error("Godot exited: " + code)); });
  });
}

function killGame() {
  try { if (grbProcess) grbProcess.kill("SIGTERM"); } catch (_) {}
  grbProcess = null;
  grbPort = null;
  grbToken = null;
}

// ── Screenshot management ──

function saveScreenshot(b64, label, outDir) {
  const filename = `${label}.png`;
  fs.writeFileSync(path.join(outDir, filename), Buffer.from(b64, "base64"));
  return filename;
}

// ── Scene tree helpers ──

const BTN_TYPES = ["Button", "TextureButton", "LinkButton", "MenuButton", "OptionButton", "CheckButton", "CheckBox"];

function findButtons(tree, results = []) {
  if (!tree) return results;
  if (BTN_TYPES.some(t => tree.type === t || tree.type?.endsWith(t))) {
    results.push(tree.name);
  }
  if (tree.children) for (const c of tree.children) findButtons(c, results);
  return results;
}

function countNodes(tree) {
  if (!tree) return 0;
  let n = 1;
  if (tree.children) for (const c of tree.children) n += countNodes(c);
  return n;
}

function flattenNodes(tree, results = []) {
  if (!tree) return results;
  results.push({ name: tree.name, type: tree.type });
  if (tree.children) for (const c of tree.children) flattenNodes(c, results);
  return results;
}

// ── reset_to_home — home/menu screen detection + navigation ──

const MENU_KEYWORDS = ["start", "play", "begin", "newgame", "new_game", "continue",
  "options", "settings", "quit", "exit", "credits", "load", "resume"];

function looksLikeHomeScreen(buttons) {
  if (buttons.length === 0) return false;
  const lower = buttons.map(b => b.toLowerCase().replace(/[^a-z]/g, ""));
  const matches = MENU_KEYWORDS.filter(kw => lower.some(bn => bn.includes(kw)));
  if (buttons.length >= 2 && matches.length >= 1) return true;
  if (buttons.length >= 4) return true;
  return false;
}

async function resetToHome(logPrefix = "  ") {
  const MAX_ATTEMPTS = 12;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const tree = await sendCommand("scene_tree", { max_depth: 12 });
    if (!tree.ok) continue;

    const buttons = findButtons(tree.scene);
    if (looksLikeHomeScreen(buttons)) {
      const method = attempt === 0 ? "home_detected" : `esc×${attempt}`;
      if (attempt > 0) process.stdout.write(` (${method})`);
      return { success: true, attempts: attempt, buttons, method };
    }

    const action = attempt % 2 === 0 ? "ui_cancel" : "pause";
    await sendCommand("key", { action });
    await sleep(400);
  }

  // Failed — capture diagnostics
  const screenshot = await sendCommand("screenshot");
  const tree = await sendCommand("scene_tree", { max_depth: 4 });
  const buttons = tree.ok ? findButtons(tree.scene) : [];

  return {
    success: false,
    attempts: MAX_ATTEMPTS,
    buttons,
    screenshot: screenshot.ok ? screenshot.png_base64 : null,
    method: "failed"
  };
}

// ── Step executor ──

async function executeStep(step, context) {
  const { screenshots, issues, actions, outDir } = context;

  switch (step.action) {
    case "screenshot": {
      const r = await sendCommand("screenshot");
      if (r.ok) {
        const file = saveScreenshot(r.png_base64, step.label, outDir);
        screenshots[step.label] = { file, b64: r.png_base64, w: r.width, h: r.height };
        actions.push(`Screenshot captured: ${step.label} (${r.width}x${r.height})`);
      } else {
        issues.push({ severity: "Major", title: "Screenshot failed", detail: JSON.stringify(r.error) });
      }
      break;
    }
    case "wait": {
      await sleep(step.ms || 1000);
      break;
    }
    case "scene_tree": {
      const r = await sendCommand("scene_tree", { max_depth: step.max_depth || 5 });
      if (r.ok) {
        context.trees[step.label || "default"] = r.scene;
        actions.push(`Scene tree captured: ${countNodes(r.scene)} nodes`);
      }
      break;
    }
    case "runtime_info": {
      const r = await sendCommand("runtime_info");
      if (r.ok) {
        context.runtimeInfo = r;
        actions.push(`Runtime info: ${r.engine_version}, ${r.fps} FPS, scene: ${r.current_scene_name || "unknown"}`);
      }
      break;
    }
    case "check_errors": {
      const sinceIdx = step.since_index ?? context._errorIndex ?? 0;
      const r = await sendCommand("get_errors", { since_index: sinceIdx });
      if (r.ok) {
        context._errorIndex = r.next_index;
        const errs = r.errors || [];
        const errCount = errs.filter(e => e.type !== "warning").length;
        const warnCount = errs.filter(e => e.type === "warning").length;
        actions.push(`Error check: ${errCount} errors, ${warnCount} warnings (since index ${sinceIdx})`);
        if (errCount > 0 && !step.allow_errors) {
          for (const e of errs.filter(e => e.type !== "warning")) {
            issues.push({
              severity: step.severity || "Major",
              title: `Engine ${e.type}: ${e.code || e.message || "unknown"}`,
              detail: `${e.file || ""}:${e.line || ""} ${e.rationale || e.message || ""}`
            });
          }
        }
        context.engineErrors = (context.engineErrors || []).concat(errs);
      }
      break;
    }
    case "click": {
      const r = await sendCommand("click", { x: step.x, y: step.y });
      if (r.ok) actions.push(`Clicked (${step.x}, ${step.y})`);
      else issues.push({ severity: "Minor", title: `Click failed at (${step.x}, ${step.y})`, detail: JSON.stringify(r.error) });
      break;
    }
    case "key": {
      const r = await sendCommand("key", step.args || {});
      if (r.ok) actions.push(`Key sent: ${step.args?.action || step.args?.keycode}`);
      else issues.push({ severity: "Minor", title: "Key input failed", detail: JSON.stringify(r.error) });
      break;
    }
    case "press_button": {
      const r = await sendCommand("press_button", { name: step.name });
      if (r.ok) actions.push(`Pressed button: ${step.name}`);
      else {
        if (step.optional) actions.push(`Button not found (optional): ${step.name}`);
        else issues.push({ severity: "Major", title: `Button not found: ${step.name}`, detail: JSON.stringify(r.error) });
      }
      break;
    }
    case "find_buttons": {
      const r = await sendCommand("scene_tree", { max_depth: 8 });
      if (r.ok) {
        const buttons = findButtons(r.scene);
        context.discoveredButtons = buttons;
        actions.push(`Discovered ${buttons.length} buttons: ${buttons.slice(0, 10).join(", ")}${buttons.length > 10 ? "..." : ""}`);
        if (buttons.length === 0) {
          issues.push({ severity: "Minor", title: "No buttons found in scene tree", detail: "Expected at least one interactive button" });
        }
      }
      break;
    }
    case "click_first_button": {
      const buttons = context.discoveredButtons || [];
      if (buttons.length > 0) {
        const r = await sendCommand("press_button", { name: buttons[0] });
        if (r.ok) actions.push(`Pressed first discovered button: ${buttons[0]}`);
        else issues.push({ severity: "Major", title: `First button unresponsive: ${buttons[0]}`, detail: JSON.stringify(r.error) });
      } else {
        actions.push("Skipped: no buttons discovered");
      }
      break;
    }
    case "screenshot_diff": {
      const a = screenshots[step.a];
      const b = screenshots[step.b];
      if (a && b) {
        const diffOpts = {};
        if (step.block_thresh != null) diffOpts.blockThresh = Number(step.block_thresh);
        else if (flags["diff-block-thresh"]) diffOpts.blockThresh = Number(flags["diff-block-thresh"]);
        if (step.change_thresh != null) diffOpts.changeThresh = Number(step.change_thresh);
        else if (flags["diff-change-thresh"]) diffOpts.changeThresh = Number(flags["diff-change-thresh"]);
        const result = compareScreenshots(a.b64, b.b64, diffOpts);
        if (result.changed) {
          actions.push(`Screenshots differ: ${step.a} vs ${step.b} (${result.detail})`);
        } else {
          if (!step.expect_same) {
            issues.push({
              severity: step.severity || "Major",
              title: step.issue_title || `Screens identical: ${step.a} vs ${step.b}`,
              detail: `Expected visual change but ${result.detail}`
            });
          } else {
            actions.push(`Screenshots match (expected): ${step.a} vs ${step.b} (${result.detail})`);
          }
        }
      }
      break;
    }
    case "scene_tree_diff": {
      const a = context.trees[step.a];
      const b = context.trees[step.b];
      if (a && b) {
        const nodesA = flattenNodes(a);
        const nodesB = flattenNodes(b);
        const namesA = new Set(nodesA.map(n => n.name));
        const namesB = new Set(nodesB.map(n => n.name));
        const added = [...namesB].filter(n => !namesA.has(n));
        const removed = [...namesA].filter(n => !namesB.has(n));
        context.treeDiff = { added, removed, countA: nodesA.length, countB: nodesB.length };
        actions.push(`Tree diff: ${nodesA.length} → ${nodesB.length} nodes (+${added.length}/-${removed.length})`);
        if (added.length > 0) actions.push(`  Added: ${added.slice(0, 15).join(", ")}`);
        if (removed.length > 0) actions.push(`  Removed: ${removed.slice(0, 15).join(", ")}`);
      }
      break;
    }
    case "rapid_input": {
      const inputs = step.inputs || [];
      for (const inp of inputs) {
        if (inp.type === "click") await sendCommand("click", { x: inp.x, y: inp.y });
        else if (inp.type === "key") await sendCommand("key", inp.args || {});
        await sleep(inp.delay || 50);
      }
      actions.push(`Rapid input: ${inputs.length} events in sequence`);
      break;
    }
    case "grid_click": {
      const cols = step.cols || 4;
      const rows = step.rows || 3;
      const w = 640; const h = 360;
      let clicked = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = Math.round((col + 0.5) * (w / cols));
          const y = Math.round((row + 0.5) * (h / rows));
          await sendCommand("click", { x, y });
          await sleep(step.delay || 100);
          clicked++;
        }
      }
      actions.push(`Grid click: ${clicked} points (${cols}x${rows})`);
      break;
    }
    case "check_runtime": {
      const r = await sendCommand("runtime_info");
      if (r.ok) {
        if (r.fps < (step.min_fps || 10)) {
          issues.push({ severity: "Major", title: "Low FPS detected", detail: `${r.fps} FPS (threshold: ${step.min_fps || 10})` });
        }
        context.runtimeInfo = r;
      }
      break;
    }
    case "get_property": {
      const r = await sendCommand("get_property", { node: step.node, property: step.property });
      if (r.ok) {
        context.properties = context.properties || {};
        context.properties[step.label || step.property] = r.value;
        actions.push(`Property ${step.node}.${step.property} = ${JSON.stringify(r.value)}`);
      } else {
        issues.push({ severity: "Minor", title: `get_property failed: ${step.node}.${step.property}`, detail: JSON.stringify(r.error) });
      }
      break;
    }
    case "assert_property": {
      const val = (context.properties || {})[step.label];
      if (val === step.expected) {
        actions.push(`Assert ${step.label} === ${JSON.stringify(step.expected)} ✓`);
      } else {
        issues.push({
          severity: step.severity || "Major",
          title: step.issue_title || `Assertion failed: ${step.label}`,
          detail: `Expected ${JSON.stringify(step.expected)}, got ${JSON.stringify(val)}`
        });
      }
      break;
    }
    case "assert_screen": {
      const r = await sendCommand("screenshot");
      if (!r.ok) {
        issues.push({ severity: "Major", title: "assert_screen: screenshot failed", detail: JSON.stringify(r.error) });
        break;
      }
      const refName = step.ref;
      const refPath = path.join(REFS_DIR, `${refName}.png`);
      const result = compareToReference(r.png_base64, refPath, {
        blockThresh: step.block_thresh,
        matchThresh: step.match_thresh,
      });
      const snapFile = saveScreenshot(r.png_base64, `assert_${refName}`, outDir);
      if (result.matches) {
        actions.push(`Screen matches reference "${refName}" (${result.detail})`);
      } else {
        issues.push({
          severity: step.severity || "Major",
          title: step.issue_title || `Screen does not match reference: ${refName}`,
          detail: `${result.detail}. Screenshot saved: ${snapFile}`
        });
      }
      break;
    }
    case "save_reference": {
      const r = await sendCommand("screenshot");
      if (!r.ok) {
        issues.push({ severity: "Major", title: "save_reference: screenshot failed", detail: JSON.stringify(r.error) });
        break;
      }
      if (!fs.existsSync(REFS_DIR)) fs.mkdirSync(REFS_DIR, { recursive: true });
      const refFile = path.join(REFS_DIR, `${step.ref}.png`);
      fs.writeFileSync(refFile, Buffer.from(r.png_base64, "base64"));
      saveScreenshot(r.png_base64, `ref_${step.ref}`, outDir);
      actions.push(`Saved reference: ${step.ref} (${r.width}x${r.height})`);
      break;
    }
    case "set_property": {
      const r = await sendCommand("set_property", { node: step.node, property: step.property, value: step.value });
      if (r.ok) actions.push(`Set ${step.node}.${step.property} = ${JSON.stringify(step.value)}`);
      else issues.push({ severity: "Minor", title: `set_property failed`, detail: JSON.stringify(r.error) });
      break;
    }
    case "call_method": {
      const r = await sendCommand("call_method", {
        node: step.node,
        method: step.method,
        args: step.args || []
      });
      if (r.ok) {
        actions.push(`Call ${step.node}.${step.method}(${JSON.stringify(step.args || [])})`);
        if (step.label && r.result !== undefined) {
          context.properties = context.properties || {};
          context.properties[step.label] = r.result;
        }
        if (step.expect_result === true && r.result === false) {
          issues.push({ severity: step.severity || "Major", title: `call_method returned false: ${step.node}.${step.method}`, detail: "Expected truthy result" });
        }
      } else {
        issues.push({ severity: step.severity || "Minor", title: `call_method failed: ${step.node}.${step.method}`, detail: JSON.stringify(r.error) });
      }
      break;
    }
    case "inject_voice": {
      const phrase = step.phrase || step.text;
      const r = await sendCommand("call_method", {
        node: "Main",
        method: "grb_inject_voice",
        args: [phrase]
      });
      if (r.ok) actions.push(`Inject voice: "${phrase}"`);
      else issues.push({ severity: "Minor", title: "Voice inject failed", detail: JSON.stringify(r.error) });
      await sleep(step.wait_after_ms || 800);
      break;
    }
    case "check_spirit_response": {
      const r = await sendCommand("call_method", {
        node: "Main",
        method: "grb_did_ghost_respond",
        args: []
      });
      if (r.ok) {
        const didRespond = r.result === true;
        const wordR = await sendCommand("call_method", {
          node: "Main",
          method: "grb_get_last_spirit_word",
          args: []
        });
        const word = wordR.ok ? wordR.result : "(unknown)";
        actions.push(`Spirit response check: ${didRespond ? "OK" : "MISSING"} (word: "${word}")`);
        if (!didRespond) {
          issues.push({
            severity: step.severity || "Major",
            title: step.issue_title || "Ghost did not respond with spirit word",
            detail: `Expected ghost to speak a spirit word after voice phrase. Last word: "${word}". Ghost may not have reacted.`
          });
        }
        if (step.label && wordR.ok) {
          context.properties = context.properties || {};
          context.properties[step.label] = word;
        }
      } else {
        issues.push({ severity: "Minor", title: "check_spirit_response failed", detail: JSON.stringify(r.error) });
      }
      break;
    }
    case "check_ghost_rendered": {
      const r = await sendCommand("call_method", {
        node: "Main",
        method: "grb_get_ghost_display_state",
        args: []
      });
      if (r.ok && r.result) {
        const s = r.result;
        const visible = (s.visible_ghost || "") !== "";
        const alpha = s.alpha || 0;
        actions.push(`Ghost render check: ${visible ? "visible" : "not visible"} (ghost: ${s.visible_ghost || "none"}, alpha: ${alpha.toFixed(2)}, phase: ${s.phase || "ABSENT"})`);
        if (!visible && (step.require_visible === true)) {
          issues.push({
            severity: step.severity || "Minor",
            title: step.issue_title || "Ghost did not render",
            detail: `Expected ghost to be visible in room. Phase: ${s.phase}, alpha: ${alpha}. Ghost visibility depends on composure and attachment.`
          });
        }
        if (step.label) {
          context.properties = context.properties || {};
          context.properties[step.label] = s;
        }
      }
      break;
    }
    case "reset_to_title": {
      const result = await resetToHome();
      if (result.success) {
        actions.push(`Reset to home: ${result.method} (${result.buttons.length} buttons found)`);
      } else {
        issues.push({
          severity: "Major",
          title: "Failed to reset to home screen",
          detail: `${result.attempts} attempts, ${result.buttons.length} buttons visible`
        });
        if (result.screenshot) {
          const file = saveScreenshot(result.screenshot, "reset_failed", outDir);
          screenshots["reset_failed"] = { file, b64: result.screenshot, w: 0, h: 0 };
        }
      }
      break;
    }
    default:
      actions.push(`Unknown action: ${step.action}`);
  }
}

// ── Report generator ──

function generateReport(mission, context) {
  const { screenshots, issues, actions, runtimeInfo, treeDiff, properties } = context;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  let md = `# Mission Report: ${mission.name}\n\n`;
  md += `| Field | Value |\n|-------|-------|\n`;
  md += `| Mission ID | \`${mission.id}\` |\n`;
  md += `| Date | ${new Date().toISOString()} |\n`;
  md += `| Duration | ${context.elapsedSec}s |\n`;
  md += `| Tier Used | ${mission.tier_required} |\n`;
  if (context.resetResult) {
    md += `| Reset | ${context.resetResult.method} (${context.resetResult.attempts} attempts) |\n`;
  }
  if (runtimeInfo) {
    md += `| Engine | ${runtimeInfo.engine_version || "unknown"} |\n`;
    md += `| FPS | ${runtimeInfo.fps || "N/A"} |\n`;
    md += `| Scene | ${runtimeInfo.current_scene_name || "unknown"} |\n`;
  }
  md += `\n`;

  if (issues.length > 0) {
    md += `## Issues Found (${issues.length})\n\n`;
    for (let i = 0; i < issues.length; i++) {
      const iss = issues[i];
      md += `### Issue ${i + 1}: ${iss.title}\n\n`;
      md += `| Field | Value |\n|-------|-------|\n`;
      md += `| Severity | **${iss.severity}** |\n`;
      md += `| Mission | ${mission.id} |\n`;
      md += `| Detail | ${iss.detail} |\n`;
      if (iss.screenshot) md += `| Screenshot | ![](${iss.screenshot}) |\n`;
      md += `\n`;
    }
  } else {
    md += `## No Issues Found\n\n`;
    md += `All checks passed. Recommend running additional missions for broader coverage.\n\n`;
  }

  md += `## Actions Taken (${actions.length})\n\n`;
  for (const a of actions) md += `- ${a}\n`;
  md += `\n`;

  if (properties && Object.keys(properties).length > 0) {
    md += `## Captured Properties\n\n`;
    for (const [k, v] of Object.entries(properties)) {
      md += `- **${k}**: ${JSON.stringify(v)}\n`;
    }
    md += `\n`;
  }

  if (Object.keys(screenshots).length > 0) {
    md += `## Screenshots (${Object.keys(screenshots).length})\n\n`;
    for (const [label, info] of Object.entries(screenshots)) {
      md += `- **${label}**: ${info.file} (${info.w}x${info.h})\n`;
    }
    md += `\n`;
  }

  // Engine errors section
  const engineErrors = context.engineErrors || [];
  if (engineErrors.length > 0) {
    const errs = engineErrors.filter(e => e.type !== "warning");
    const warns = engineErrors.filter(e => e.type === "warning");
    md += `## Engine Errors (${errs.length} errors, ${warns.length} warnings)\n\n`;
    if (errs.length > 0) {
      md += `### Errors\n\n`;
      for (const e of errs.slice(0, 25)) {
        md += `- **${e.type}** \`${e.file || ""}:${e.line || ""}\` ${e.code || ""} — ${e.rationale || e.message || ""}\n`;
      }
      if (errs.length > 25) md += `- ... and ${errs.length - 25} more\n`;
      md += `\n`;
    }
    if (warns.length > 0) {
      md += `### Warnings\n\n`;
      for (const w of warns.slice(0, 15)) {
        md += `- \`${w.file || ""}:${w.line || ""}\` ${w.code || ""} — ${w.rationale || w.message || ""}\n`;
      }
      if (warns.length > 15) md += `- ... and ${warns.length - 15} more\n`;
      md += `\n`;
    }
  }

  // Stderr section
  const stderr = (context.stderr || "").trim();
  if (stderr) {
    md += `## Godot Stderr\n\n`;
    md += "```\n" + stderr.slice(0, 3000) + "\n```\n\n";
    if (stderr.length > 3000) md += `(truncated, ${stderr.length} chars total)\n\n`;
  }

  md += `## Coverage Summary\n\n`;
  md += `- Actions executed: ${actions.length}\n`;
  md += `- Screenshots captured: ${Object.keys(screenshots).length}\n`;
  md += `- Issues found: ${issues.length}\n`;
  md += `- Engine errors: ${engineErrors.filter(e => e.type !== "warning").length}\n`;
  md += `- Engine warnings: ${engineErrors.filter(e => e.type === "warning").length}\n`;
  if (context.discoveredButtons) md += `- Buttons discovered: ${context.discoveredButtons.length}\n`;
  if (treeDiff) md += `- Node tree delta: ${treeDiff.countA} → ${treeDiff.countB} (+${treeDiff.added.length}/-${treeDiff.removed.length})\n`;
  md += `\n---\n*Generated by Godot Runtime Bridge Mission Runner v1.0.0*\n`;

  return { md, timestamp };
}

// ── Main ──

async function runMission(mission, shouldReset, errorIndex = 0) {
  const missionOutDir = path.join(OUTPUT_DIR, mission.id);
  fs.mkdirSync(missionOutDir, { recursive: true });

  const context = {
    screenshots: {},
    issues: [],
    actions: [],
    trees: {},
    properties: {},
    runtimeInfo: null,
    discoveredButtons: [],
    treeDiff: null,
    resetResult: null,
    outDir: missionOutDir,
    elapsedSec: 0,
    engineErrors: [],
    stderr: "",
    _errorIndex: errorIndex,
  };

  const startTime = Date.now();
  console.log(`\n▶ Running mission: ${mission.name}`);
  console.log(`  Goal: ${mission.goal}`);
  console.log(`  Tier: ${mission.tier_required} | Est: ${mission.estimated_time_sec}s\n`);

  // Pre-mission reset
  if (shouldReset) {
    process.stdout.write("  [reset] reset_to_home...");
    const resetResult = await resetToHome("  ");
    context.resetResult = resetResult;
    if (resetResult.success) {
      context.actions.push(`Reset to home: ${resetResult.method} (${resetResult.buttons.length} buttons)`);
      console.log(` done (${resetResult.method})`);
    } else {
      context.actions.push(`Reset to home FAILED after ${resetResult.attempts} attempts`);
      context.issues.push({
        severity: "Major",
        title: "Pre-mission reset failed",
        detail: `Could not reach home/menu screen after ${resetResult.attempts} Esc presses. ${resetResult.buttons.length} buttons visible.`
      });
      if (resetResult.screenshot) {
        saveScreenshot(resetResult.screenshot, "reset_failed", missionOutDir);
      }
      console.log(" FAILED");
    }
  }

  try {
    const totalSteps = mission.steps.length;
    for (let i = 0; i < totalSteps; i++) {
      const step = mission.steps[i];
      process.stdout.write(`  [${i + 1}/${totalSteps}] ${step.action}${step.label ? " (" + step.label + ")" : ""}...`);
      await executeStep(step, context);
      console.log(" done");
    }
  } catch (err) {
    context.issues.push({ severity: "Critical", title: "Mission step failed", detail: err.message });
    console.log(` FAILED: ${err.message}`);
  }

  // Post-mission: capture any engine errors that occurred during the mission
  try {
    const sinceIdx = context._errorIndex ?? 0;
    const postCheck = await sendCommand("get_errors", { since_index: sinceIdx });
    if (postCheck.ok) {
      context._errorIndex = postCheck.next_index;
      const errs = postCheck.errors || [];
      context.engineErrors = (context.engineErrors || []).concat(errs);
    }
  } catch (_) { /* get_errors not available */ }

  // Also capture stderr from the Godot process
  if (grbProcess && grbProcess.stderrBuffer) {
    context.stderr = grbProcess.stderrBuffer();
  }

  context.elapsedSec = Math.round((Date.now() - startTime) / 1000);

  const { md, timestamp } = generateReport(mission, context);
  const reportFile = path.join(missionOutDir, `report-${timestamp}.md`);
  fs.writeFileSync(reportFile, md);

  const eeCount = (context.engineErrors || []).filter(e => e.type !== "warning").length;
  const ewCount = (context.engineErrors || []).filter(e => e.type === "warning").length;
  const errStr = eeCount > 0 ? ` | Errors: ${eeCount}` : "";
  const warnStr = ewCount > 0 ? ` | Warnings: ${ewCount}` : "";
  console.log(`\n  Issues: ${context.issues.length}${errStr}${warnStr} | Screenshots: ${Object.keys(context.screenshots).length} | Time: ${context.elapsedSec}s`);
  console.log(`  Report: ${reportFile}`);

  return { ...context, reportFile };
}

async function main() {
  const missionId = flags.mission;
  const toRun = missionId === "all"
    ? missions
    : missionId === "starters"
      ? missions.filter(m => m.starter)
      : missions.filter(m => m.id === missionId);

  if (toRun.length === 0) {
    console.error(`Mission not found: ${missionId}`);
    console.error("Use --list to see available missions.");
    process.exit(1);
  }

  // Determine reset behavior:
  //   --reset forces it on, --no-reset forces it off
  //   default: on for multi-mission runs (all/starters), off for single
  const isMulti = toRun.length > 1;
  const shouldReset = flags.noReset ? false : (flags.reset || isMulti);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const isWatch = (flags.mode === "watch");
  console.log("=== Godot Runtime Bridge — Mission Runner ===");
  console.log(`Missions to run: ${toRun.length}`);
  console.log(`Mode: ${isWatch ? "WATCH (foreground, OS cursor)" : "BACKGROUND (windowed, synthetic input)"}`);
  if (shouldReset) console.log("Reset to home: ENABLED (before each mission)");

  const maxTier = Math.max(...toRun.map(m => m.tier_required));
  console.log(`Launching game (tier ${maxTier})...`);

  await launchGame(flags.exe, flags.project, maxTier);
  console.log(`Connected on port ${grbPort}`);
  await sleep(3000);

  // Auto health-check: query startup errors
  let startupErrors = [];
  let startupErrorIndex = 0;
  try {
    const errCheck = await sendCommand("get_errors", { since_index: 0 });
    if (errCheck.ok) {
      startupErrorIndex = errCheck.next_index;
      startupErrors = errCheck.errors || [];
      const ec = startupErrors.filter(e => e.type !== "warning").length;
      const wc = startupErrors.filter(e => e.type === "warning").length;
      if (ec > 0 || wc > 0) {
        console.log(`  Startup health: ${ec} errors, ${wc} warnings`);
        for (const e of startupErrors.filter(e => e.type !== "warning").slice(0, 10)) {
          console.log(`    ERROR: ${e.file || ""}:${e.line || ""} ${e.code || ""} — ${e.rationale || e.message || ""}`);
        }
        if (ec > 10) console.log(`    ... and ${ec - 10} more errors`);
      } else {
        console.log("  Startup health: OK (0 errors, 0 warnings)");
      }
      // Prioritize fixing boot errors: abort mission run if any errors so agent fixes them first
      if (ec > 0 && !flags["allow-boot-errors"]) {
        console.error("\n*** Boot errors detected. Fix engine errors before running missions. ***");
        console.error("(Use --allow-boot-errors to run anyway.)");
        killGame();
        process.exit(2);
      }
    }
  } catch (_) { /* get_errors not supported by older GRB */ }

  let totalIssues = 0;
  const summaries = [];

  for (const mission of toRun) {
    const result = await runMission(mission, shouldReset, startupErrorIndex);
    totalIssues += result.issues.length;
    summaries.push({
      id: mission.id,
      name: mission.name,
      issues: result.issues.length,
      time: result.elapsedSec,
      screenshots: Object.keys(result.screenshots || {}).length,
      resetMethod: result.resetResult?.method || "none",
      reportFile: result.reportFile,
      issuesList: result.issues || []
    });
  }

  killGame();

  // Write overall report
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const overallPath = path.join(OUTPUT_DIR, "OVERALL.md");
  const overallMd = [
    "# GRB Mission Run — Overall Report",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Run | ${runTimestamp} |`,
    `| Project | ${flags.project} |`,
    `| Missions | ${summaries.length} |`,
    `| Total issues | **${totalIssues}** |`,
    `| Result | ${totalIssues === 0 ? "PASS" : "FAIL"} |`,
    "",
    "## Missions",
    "",
    "| Status | Mission | Issues | Time | Screenshots | Report |",
    "|--------|---------|--------|------|-------------|--------|"
  ];
  for (const s of summaries) {
    const status = s.issues > 0 ? "FAIL" : "PASS";
    const relReport = path.relative(OUTPUT_DIR, s.reportFile || "").replace(/\\/g, "/");
    overallMd.push(`| ${status} | \`${s.id}\` | ${s.issues} | ${s.time}s | ${s.screenshots} | [report](${relReport}) |`);
  }
  overallMd.push("");
  if (totalIssues > 0) {
    overallMd.push("## Issues by Mission", "");
    for (const s of summaries) {
      if (s.issuesList.length > 0) {
        overallMd.push(`### ${s.name} (${s.id})`, "");
        for (const iss of s.issuesList) {
          overallMd.push(`- **${iss.severity}**: ${iss.title}`);
          overallMd.push(`  - ${iss.detail}`, "");
        }
      }
    }
  }
  overallMd.push("---", "*Generated by Godot Runtime Bridge Mission Runner*");
  fs.writeFileSync(overallPath, overallMd.join("\n"));

  console.log("\n=== Mission Pack Summary ===\n");
  for (const s of summaries) {
    const icon = s.issues > 0 ? "⚠" : "✓";
    const reset = s.resetMethod !== "none" ? ` [${s.resetMethod}]` : "";
    console.log(`  ${icon} ${s.id.padEnd(35)} ${s.issues} issues  (${s.time}s)${reset}`);
  }
  console.log(`\n  Total issues: ${totalIssues}`);
  console.log(`  Reports: ${OUTPUT_DIR}`);
  console.log(`  Overall: ${overallPath}\n`);

  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch(err => { console.error("Fatal:", err.message); killGame(); process.exit(1); });
