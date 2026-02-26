#!/usr/bin/env node
/**
 * GRB Feature Verification — Tests find_nodes, gamepad, and other 1.0.0 commands.
 * Connects to an already-running GRB instance.
 */

import net from "net";

const PORT = parseInt(process.argv[2] || "63046");
const TOKEN = process.argv[3] || "test123";

let reqId = 0;
let responseCallbacks = {};

function connect() {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ port: PORT, host: "127.0.0.1" }, () => {
      resolve(sock);
    });
    sock.on("error", reject);

    let buf = "";
    sock.on("data", (data) => {
      buf += data.toString();
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && responseCallbacks[msg.id]) {
            responseCallbacks[msg.id](msg);
            delete responseCallbacks[msg.id];
          }
        } catch (_) {}
      }
    });
  });
}

function send(sock, cmd, args = {}) {
  return new Promise((resolve) => {
    const id = `test_${++reqId}`;
    responseCallbacks[id] = resolve;
    const payload = JSON.stringify({ id, token: TOKEN, cmd, args }) + "\n";
    sock.write(payload);
  });
}

function test(name, pass, detail = "") {
  const icon = pass ? "PASS" : "FAIL";
  console.log(`  [${icon}] ${name}${detail ? " — " + detail : ""}`);
  return pass;
}

async function main() {
  console.log(`\nConnecting to GRB on port ${PORT}...\n`);
  const sock = await connect();

  // Auth
  const ping = await send(sock, "ping");
  test("ping", ping.ok, JSON.stringify(ping));

  let allPass = true;

  // ── find_nodes tests ──
  console.log("\n=== find_nodes ===");

  // Test 1: Find by type
  const r1 = await send(sock, "find_nodes", { type: "Control" });
  const p1 = test("find_nodes by type (Control)", r1.ok && r1.count > 0, `count=${r1.count}`);
  allPass = allPass && p1;

  // Test 2: Find by name
  const r2 = await send(sock, "find_nodes", { name: "GestureTest" });
  const p2 = test("find_nodes by name (GestureTest)", r2.ok && r2.count === 1, `count=${r2.count}, path=${r2.matches?.[0]?.path}`);
  allPass = allPass && p2;

  // Test 3: Find wildcard
  const r3 = await send(sock, "find_nodes", { name: "*" });
  const p3 = test("find_nodes wildcard (*)", r3.ok && r3.count > 0, `count=${r3.count}`);
  allPass = allPass && p3;

  // Test 4: No args should fail
  const r4 = await send(sock, "find_nodes", {});
  const p4 = test("find_nodes no args → error", !r4.ok && r4.error?.code === "bad_args");
  allPass = allPass && p4;

  // Test 5: Find by type with limit
  const r5 = await send(sock, "find_nodes", { name: "*", limit: 3 });
  const p5 = test("find_nodes with limit=3", r5.ok && r5.count <= 3, `count=${r5.count}`);
  allPass = allPass && p5;

  // Test 6: Find non-existent type
  const r6 = await send(sock, "find_nodes", { type: "Camera3D" });
  const p6 = test("find_nodes type not present → empty", r6.ok && r6.count === 0, `count=${r6.count}`);
  allPass = allPass && p6;

  // ── gamepad tests ──
  console.log("\n=== gamepad ===");

  // Test 1: Button press
  const g1 = await send(sock, "gamepad", { action: "button", button: 0, pressed: true });
  const gp1 = test("gamepad button press", g1.ok);
  allPass = allPass && gp1;

  // Test 2: Axis motion
  const g2 = await send(sock, "gamepad", { action: "axis", axis: 0, value: 0.75 });
  const gp2 = test("gamepad axis motion", g2.ok);
  allPass = allPass && gp2;

  // Test 3: Vibrate
  const g3 = await send(sock, "gamepad", { action: "vibrate", weak: 0.2, strong: 0.5, duration: 0.1 });
  const gp3 = test("gamepad vibrate", g3.ok);
  allPass = allPass && gp3;

  // Test 4: Invalid action
  const g4 = await send(sock, "gamepad", { action: "invalid" });
  const gp4 = test("gamepad invalid action → error", !g4.ok && g4.error?.code === "bad_args");
  allPass = allPass && gp4;

  // Test 5: No action
  const g5 = await send(sock, "gamepad", {});
  const gp5 = test("gamepad no action → error", !g5.ok);
  allPass = allPass && gp5;

  // ── existing commands still work ──
  console.log("\n=== regression: existing commands ===");

  const s1 = await send(sock, "screenshot");
  const sp1 = test("screenshot", s1.ok && s1.png_base64?.length > 100, `size=${s1.png_base64?.length}`);
  allPass = allPass && sp1;

  const s2 = await send(sock, "scene_tree", { max_depth: 3 });
  const sp2 = test("scene_tree", s2.ok && s2.scene?.name, `root=${s2.scene?.name}`);
  allPass = allPass && sp2;

  const s3 = await send(sock, "grb_performance");
  const sp3 = test("grb_performance", s3.ok && s3.fps > 0, `fps=${s3.fps}`);
  allPass = allPass && sp3;

  const s4 = await send(sock, "audio_state");
  const sp4 = test("audio_state", s4.ok, `buses=${s4.bus_count}`);
  allPass = allPass && sp4;

  const s5 = await send(sock, "run_custom_command", { name: "test_ping" });
  const sp5 = test("run_custom_command (test_ping)", s5.ok && s5.result?.pong === true);
  allPass = allPass && sp5;

  const s6 = await send(sock, "get_property", { node: "Main/GestureTest", property: "zoom" });
  const sp6 = test("get_property (GestureTest.zoom)", s6.ok, `value=${s6.value}`);
  allPass = allPass && sp6;

  // ── summary ──
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Result: ${allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
  console.log(`${"=".repeat(50)}\n`);

  sock.destroy();
  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(2);
});
