#!/usr/bin/env node
/**
 * GRB 1.0.0 regression test — uses grb-test-project for proper verification.
 * Requires grb-test-project with GRB addon, GRBCommands autoload, and gesture test scene.
 *
 * Usage: node test_new_commands.mjs [--exe <godot>] [--project <path>]
 *   --exe     Godot executable (default: env GODOT_PATH or "godot")
 *   --project Path to grb-test-project (default: ../grb-test-project from mcp/)
 *
 * Exits 0 if all pass, 1 on failure.
 */

import net from "net";
import crypto from "crypto";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
let exe = process.env.GODOT_PATH || "godot";
let project = path.resolve(__dirname, "../../grb-test-project");
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--exe" && i + 1 < args.length) { exe = args[++i]; }
  else if (args[i] === "--project" && i + 1 < args.length) { project = path.resolve(args[++i]); }
}

let grbPort = null;
let grbToken = null;
let grbProcess = null;
let reqId = 0;

function nextId() { return `t_${++reqId}`; }

function sendCommand(cmd, cmdArgs = {}) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    const req = JSON.stringify({
      id: nextId(), proto: "grb/1", cmd, args: cmdArgs, token: grbToken
    }) + "\n";
    let buf = "";
    sock.setTimeout(10000);
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

async function launchGame() {
  const token = crypto.randomBytes(16).toString("hex");
  const child = spawn(exe, ["--path", project, "--windowed", "--resolution", "960x540"], {
    cwd: project,
    env: { ...process.env, GDRB_TOKEN: token, GDRB_TIER: "2", GDRB_FORCE_WINDOWED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  grbProcess = child;
  child.stderr.on("data", () => {});

  return new Promise((resolve, reject) => {
    let stdoutBuf = "";
    const timeout = setTimeout(() => reject(new Error("GDRB_READY timeout")), 25000);
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

async function main() {
  const results = [];
  const ok = (name) => { results.push({ name, pass: true }); console.log(`  ✓ ${name}`); };
  const fail = (name, err) => { results.push({ name, pass: false, err: String(err) }); console.log(`  ✗ ${name}: ${err}`); };

  console.log("\n=== GRB 1.0.0 Regression Test (grb-test-project) ===\n");
  console.log("Project:", project);
  console.log("Launching game...");
  await launchGame();
  console.log(`Connected on port ${grbPort}\n`);
  await sleep(1500);

  // 1. grb_performance — verify FPS in sane range
  try {
    const r = await sendCommand("grb_performance");
    if (!r.ok) { fail("grb_performance", "Not ok: " + JSON.stringify(r.error)); }
    else if (typeof r.fps !== "number" || typeof r.render_draw_calls !== "number") {
      fail("grb_performance", "Missing fps or render_draw_calls");
    } else if (r.fps < 10 || r.fps > 500) {
      fail("grb_performance", "FPS out of sane range: " + r.fps);
    } else {
      ok("grb_performance (fps=" + r.fps + ")");
    }
  } catch (e) { fail("grb_performance", e.message); }

  // 2. audio_state — verify buses and mix_rate
  try {
    const r = await sendCommand("audio_state");
    if (!r.ok) { fail("audio_state", "Not ok: " + JSON.stringify(r.error)); }
    else if (!Array.isArray(r.buses) || typeof r.mix_rate !== "number") {
      fail("audio_state", "Missing buses or mix_rate");
    } else if (r.buses.length < 1) {
      fail("audio_state", "No buses");
    } else {
      ok("audio_state (" + r.buses.length + " bus(es), mix_rate=" + r.mix_rate + ")");
    }
  } catch (e) { fail("audio_state", e.message); }

  // 3. network_state
  try {
    const r = await sendCommand("network_state");
    if (!r.ok) { fail("network_state", "Not ok"); }
    else if (typeof r.multiplayer !== "boolean") {
      fail("network_state", "Missing multiplayer");
    } else {
      ok("network_state");
    }
  } catch (e) { fail("network_state", e.message); }

  // 4. gesture (pinch) — verify zoom changes via get_property
  try {
    const before = await sendCommand("get_property", { node: "Main/GestureTest", property: "zoom" });
    if (!before.ok) { fail("gesture (pinch)", "get_property before failed: " + before.error?.message); }
    else {
      await sendCommand("gesture", { type: "pinch", params: { center: [480, 270], scale: 1.2 } });
      await sleep(200);
      const after = await sendCommand("get_property", { node: "Main/GestureTest", property: "zoom" });
      if (!after.ok) { fail("gesture (pinch)", "get_property after failed"); }
      else {
        const z0 = before.value;
        const z1 = after.value;
        if (typeof z0 !== "number" || typeof z1 !== "number") {
          fail("gesture (pinch)", "zoom not numeric: " + z0 + " -> " + z1);
        } else if (z1 <= z0) {
          fail("gesture (pinch)", "zoom did not increase: " + z0 + " -> " + z1);
        } else {
          ok("gesture (pinch) zoom " + z0.toFixed(2) + " -> " + z1.toFixed(2));
        }
      }
    }
  } catch (e) { fail("gesture (pinch)", e.message); }

  // 5. gesture (swipe) — verify pan_offset changes (Godot serializes Vector2 as string e.g. "(20, 10)")
  try {
    const before = await sendCommand("get_property", { node: "Main/GestureTest", property: "pan_offset" });
    if (!before.ok) { fail("gesture (swipe)", "get_property before failed"); }
    else {
      await sendCommand("gesture", { type: "swipe", params: { center: [480, 270], delta: [20, 10] } });
      await sleep(200);
      const after = await sendCommand("get_property", { node: "Main/GestureTest", property: "pan_offset" });
      if (!after.ok) { fail("gesture (swipe)", "get_property after failed"); }
      else {
        const s0 = String(before.value ?? "");
        const s1 = String(after.value ?? "");
        if (s1 === s0) {
          fail("gesture (swipe)", "pan_offset did not change: " + s0 + " -> " + s1);
        } else {
          ok("gesture (swipe) pan_offset " + s0 + " -> " + s1);
        }
      }
    }
  } catch (e) { fail("gesture (swipe)", e.message); }

  // 6. run_custom_command (success) — test_ping returns {pong: true}
  try {
    const r = await sendCommand("run_custom_command", { name: "test_ping" });
    if (!r.ok) { fail("run_custom_command test_ping", r.error?.message || "Not ok"); }
    else if (!r.result || r.result.pong !== true) {
      fail("run_custom_command test_ping", "Expected result.pong=true, got: " + JSON.stringify(r.result));
    } else {
      ok("run_custom_command test_ping");
    }
  } catch (e) { fail("run_custom_command test_ping", e.message); }

  // 7. run_custom_command (not_found)
  try {
    const r = await sendCommand("run_custom_command", { name: "nonexistent_cmd_xyz" });
    if (r.ok) { fail("run_custom_command not_found", "Expected error"); }
    else if (r.error?.code !== "not_found") {
      fail("run_custom_command not_found", "Expected not_found, got: " + r.error?.code);
    } else {
      ok("run_custom_command not_found");
    }
  } catch (e) { fail("run_custom_command not_found", e.message); }

  // 8. capabilities — new commands listed
  try {
    const r = await sendCommand("capabilities");
    if (!r.ok) { fail("capabilities", "Not ok"); }
    else {
      const required = ["gesture", "audio_state", "network_state", "grb_performance"];
      const missing = required.filter(c => !r.commands.includes(c));
      if (missing.length) {
        fail("capabilities", "Missing: " + missing.join(", "));
      } else {
        ok("capabilities");
      }
    }
  } catch (e) { fail("capabilities", e.message); }

  killGame();

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Results: ${passed}/${results.length} passed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("Fatal:", e.message); killGame(); process.exit(1); });
