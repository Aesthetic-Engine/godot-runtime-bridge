#!/usr/bin/env node
/**
 * Godot Runtime Bridge — MCP Server
 *
 * Launches a Godot game with the GRB debug server enabled, parses the
 * GDRB_READY line for port/token, and exposes all bridge commands as MCP tools.
 *
 * Protocol: grb/1 (see PROTOCOL.md)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import net from "net";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const HOST = "127.0.0.1";
const LAUNCH_TIMEOUT_MS = 30000;
const COMMAND_TIMEOUT_MS = 15000;

let grbPort = null;
let grbToken = null;
let grbProcess = null;
let requestCounter = 0;

function nextId() {
  return `mcp_${++requestCounter}`;
}

function sendCommand(cmd, args = {}) {
  return new Promise((resolve, reject) => {
    if (!grbPort || !grbToken) {
      reject(new Error("Bridge not connected. Launch the game first."));
      return;
    }

    const sock = new net.Socket();
    const req =
      JSON.stringify({
        id: nextId(),
        proto: "grb/1",
        cmd,
        args,
        token: grbToken,
      }) + "\n";
    let buffer = "";

    sock.setTimeout(COMMAND_TIMEOUT_MS);
    sock.on("timeout", () => {
      sock.destroy();
      reject(new Error("Command timeout: " + cmd));
    });
    sock.on("error", reject);
    sock.on("data", (data) => {
      buffer += data.toString();
      const idx = buffer.indexOf("\n");
      if (idx >= 0) {
        sock.destroy();
        try {
          resolve(JSON.parse(buffer.slice(0, idx)));
        } catch (e) {
          reject(e);
        }
      }
    });
    sock.on("close", () => {
      if (buffer.length > 0 && buffer.indexOf("\n") < 0)
        reject(new Error("Connection closed before full response"));
    });
    sock.connect(grbPort, HOST, () => sock.write(req));
  });
}

function sendPing() {
  return new Promise((resolve, reject) => {
    if (!grbPort) {
      reject(new Error("No port"));
      return;
    }
    const sock = new net.Socket();
    const req =
      JSON.stringify({ id: nextId(), proto: "grb/1", cmd: "ping" }) + "\n";
    let buffer = "";
    sock.setTimeout(3000);
    sock.on("timeout", () => {
      sock.destroy();
      reject(new Error("Ping timeout"));
    });
    sock.on("error", reject);
    sock.on("data", (data) => {
      buffer += data.toString();
      const idx = buffer.indexOf("\n");
      if (idx >= 0) {
        sock.destroy();
        try {
          const r = JSON.parse(buffer.slice(0, idx));
          r.ok && r.pong ? resolve() : reject(new Error("Bad ping response"));
        } catch (e) {
          reject(e);
        }
      }
    });
    sock.connect(grbPort, HOST, () => sock.write(req));
  });
}

function waitForReady(proc) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + LAUNCH_TIMEOUT_MS;
    let stdoutBuf = "";

    proc.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split("\n");
      for (const line of lines) {
        if (line.startsWith("GDRB_READY:")) {
          try {
            const data = JSON.parse(line.slice("GDRB_READY:".length));
            grbPort = data.port;
            grbToken = data.token;
            resolve(data);
            return;
          } catch (e) {
            reject(new Error("Failed to parse GDRB_READY: " + e.message));
            return;
          }
        }
      }
      stdoutBuf = lines[lines.length - 1];
    });

    proc.on("exit", (code) => {
      if (!grbPort) reject(new Error("Godot exited (code " + code + ") before GDRB_READY"));
    });

    setTimeout(() => {
      if (!grbPort) reject(new Error("Timeout waiting for GDRB_READY"));
    }, LAUNCH_TIMEOUT_MS);
  });
}

// ── Tool definitions ──

const TOOLS = [
  {
    name: "grb_launch",
    description:
      "Launch a Godot game with the Runtime Bridge enabled. Parses the GDRB_READY line to auto-discover port and token.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to project folder (contains project.godot)",
        },
        godot_exe: {
          type: "string",
          description: "Path to Godot executable",
        },
        tier: {
          type: "number",
          description: "Max session tier 0-3 (default: 1)",
        },
        enable_danger: {
          type: "boolean",
          description: "Enable tier-3 eval command (default: false)",
        },
        window_size: {
          type: "string",
          description:
            'Test window size as "WxH" (default: "960x540"). Use "minimized" to hide the window entirely. Viewport resolution is unaffected.',
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "grb_connect",
    description:
      "Connect to an already-running Godot game with GRB enabled (provide port and token).",
    inputSchema: {
      type: "object",
      properties: {
        port: { type: "number", description: "TCP port" },
        token: { type: "string", description: "Auth token" },
      },
      required: ["port", "token"],
    },
  },
  {
    name: "grb_ping",
    description: "Check if the bridge is reachable.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_screenshot",
    description: "Capture a screenshot from the game viewport.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_scene_tree",
    description: "Get the scene tree (node names and types).",
    inputSchema: {
      type: "object",
      properties: {
        max_depth: { type: "number", description: "Max depth (default: 10)" },
      },
    },
  },
  {
    name: "grb_click",
    description: "Inject a left-click at viewport coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Viewport X" },
        y: { type: "number", description: "Viewport Y" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "grb_key",
    description:
      "Inject a key press. Use 'action' for Godot input actions or 'keycode' for raw keycodes.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Godot input action name" },
        keycode: { type: "number", description: "Raw keycode value" },
      },
    },
  },
  {
    name: "grb_press_button",
    description: "Find a BaseButton by name in the scene tree and trigger its pressed signal.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Button node name" },
      },
      required: ["name"],
    },
  },
  {
    name: "grb_drag",
    description: "Inject a drag gesture from one point to another.",
    inputSchema: {
      type: "object",
      properties: {
        from: {
          type: "array",
          items: { type: "number" },
          description: "[x, y] start",
        },
        to: {
          type: "array",
          items: { type: "number" },
          description: "[x, y] end",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "grb_scroll",
    description: "Inject a scroll wheel event at a position.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number", description: "Position X" },
        y: { type: "number", description: "Position Y" },
        delta: {
          type: "number",
          description: "Scroll amount (negative=down, positive=up, default: -3)",
        },
      },
    },
  },
  {
    name: "grb_get_property",
    description: "Read a property from a node by NodePath.",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "NodePath (e.g. 'Main/RoomView')" },
        property: { type: "string", description: "Property name" },
      },
      required: ["node", "property"],
    },
  },
  {
    name: "grb_set_property",
    description: "Set a property on a node by NodePath. Requires tier 2.",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "NodePath" },
        property: { type: "string", description: "Property name" },
        value: { description: "New value" },
      },
      required: ["node", "property", "value"],
    },
  },
  {
    name: "grb_call_method",
    description: "Call a method on a node by NodePath. Requires tier 2.",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "NodePath" },
        method: { type: "string", description: "Method name" },
        args: {
          type: "array",
          description: "Method arguments (default: [])",
        },
      },
      required: ["node", "method"],
    },
  },
  {
    name: "grb_runtime_info",
    description: "Get engine runtime info: version, FPS, current scene, node count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_get_errors",
    description: "Get captured engine errors, warnings, and log messages. Call after launch and before other commands; fix any reported errors before proceeding. Returns entries since a given index for incremental polling.",
    inputSchema: {
      type: "object",
      properties: {
        since_index: {
          type: "number",
          description: "Return entries starting from this index (default: 0)",
        },
      },
    },
  },
  {
    name: "grb_wait_for",
    description: "Wait until a node property matches a value (or timeout).",
    inputSchema: {
      type: "object",
      properties: {
        node: { type: "string", description: "NodePath" },
        property: { type: "string", description: "Property to watch" },
        value: { description: "Expected value" },
        timeout_ms: {
          type: "number",
          description: "Max wait in ms (default: 5000)",
        },
      },
      required: ["node", "property", "value"],
    },
  },
  {
    name: "grb_capabilities",
    description: "List commands available at the current session tier.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_quit",
    description: "Gracefully quit the running game. Requires tier 2.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_reset",
    description:
      "Quit the running game and relaunch a fresh instance. Use instead of quit+launch when Godot doesn't exit cleanly. Same args as grb_launch.",
    inputSchema: {
      type: "object",
      properties: {
        project_path: {
          type: "string",
          description: "Path to project folder (required)",
        },
        godot_exe: { type: "string" },
        tier: { type: "number" },
        enable_danger: { type: "boolean" },
        window_size: { type: "string" },
      },
      required: ["project_path"],
    },
  },
  {
    name: "grb_gesture",
    description: "Inject pinch or swipe gesture. Uses InputEventMagnifyGesture and InputEventPanGesture.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "'pinch' or 'swipe'" },
        params: {
          type: "object",
          properties: {
            center: { type: "array", items: { type: "number" }, description: "[x, y]" },
            scale: { type: "number", description: "Pinch factor (default 1.1)" },
            delta: { type: "array", items: { type: "number" }, description: "Swipe [dx, dy]" },
          },
        },
      },
      required: ["type"],
    },
  },
  {
    name: "grb_audio_state",
    description: "Get audio bus volumes (dB), mute state, and mix rate. Tier 0.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_network_state",
    description: "Get multiplayer/network state. Tier 0.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_run_custom_command",
    description: "Run a game-registered custom command via GRBCommands. Requires GRBCommands autoload.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Command name" },
        args: { type: "array", description: "Command arguments (default [])" },
      },
      required: ["name"],
    },
  },
  {
    name: "grb_performance",
    description: "Get FPS, process times, draw calls, node count, video memory. Tier 0.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "grb_eval",
    description:
      "Execute arbitrary GDScript expression. Requires tier 3 + GDRB_ENABLE_DANGER=1.",
    inputSchema: {
      type: "object",
      properties: {
        expr: { type: "string", description: "GDScript expression" },
      },
      required: ["expr"],
    },
  },
  {
    name: "grb_find_nodes",
    description: "Search the live scene tree for nodes by name substring, type/class, and/or group. Returns matching node paths, types, and groups. Tier 0.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name substring to match (case-insensitive). Use '*' for all." },
        type: { type: "string", description: "Godot class name (e.g. 'Button', 'Label', 'Camera3D')" },
        group: { type: "string", description: "Group name the node must belong to" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
  },
  {
    name: "grb_gamepad",
    description: "Inject gamepad/controller input: button press, axis motion, or vibration. Tier 1.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "'button', 'axis', or 'vibrate'" },
        button: { type: "number", description: "Joypad button index (for 'button' action)" },
        pressed: { type: "boolean", description: "Whether button is pressed (default true)" },
        axis: { type: "number", description: "Axis index (for 'axis' action)" },
        value: { type: "number", description: "Axis value -1.0 to 1.0 (for 'axis' action)" },
        device: { type: "number", description: "Device ID (default 0)" },
        weak: { type: "number", description: "Weak vibration 0.0-1.0 (for 'vibrate')" },
        strong: { type: "number", description: "Strong vibration 0.0-1.0 (for 'vibrate')" },
        duration: { type: "number", description: "Vibration duration in seconds (for 'vibrate')" },
      },
      required: ["action"],
    },
  },
];

// ── Handlers ──

async function handleTool(name, args) {
  switch (name) {
    case "grb_launch": {
      if (grbProcess) {
        try { grbProcess.kill(); } catch {}
        grbProcess = null;
        grbPort = null;
        grbToken = null;
      }

      const projectPath = args.project_path;
      const godotExe = args.godot_exe || process.env.GODOT_PATH || "godot";
      const tier = args.tier != null ? String(args.tier) : "1";
      const token = crypto.randomBytes(24).toString("hex");

      // Parse window_size: "WxH", "minimized", or default 960x540
      const winSizeArg = args.window_size || "960x540";
      const minimized = winSizeArg.toLowerCase() === "minimized";
      let winW = 960, winH = 540;
      if (!minimized) {
        const m = winSizeArg.match(/^(\d+)x(\d+)$/i);
        if (m) { winW = parseInt(m[1]); winH = parseInt(m[2]); }
      }

      const env = {
        ...process.env,
        GDRB_TOKEN: token,
        GDRB_TIER: tier,
        GDRB_FORCE_WINDOWED: "1",
        GDRB_WINDOW_WIDTH: String(winW),
        GDRB_WINDOW_HEIGHT: String(winH),
      };
      if (args.enable_danger) env.GDRB_ENABLE_DANGER = "1";

      // Write override.cfg to force windowed mode at engine level.
      // Godot reads this after project.godot and it takes priority.
      const overridePath = path.join(projectPath, "override.cfg");
      let prevOverride = null;
      try {
        prevOverride = fs.readFileSync(overridePath, "utf8");
      } catch {}
      const overrideLines = [
        "[display]",
        "",
        "window/size/mode=0",
        `window/size/window_width_override=${winW}`,
        `window/size/window_height_override=${winH}`,
        "",
      ];
      fs.writeFileSync(overridePath, overrideLines.join("\n"), "utf8");

      let child;
      try {
        child = spawn(godotExe, ["--path", projectPath, "--windowed"], {
          cwd: projectPath,
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (e) {
        // Restore override.cfg on failure
        if (prevOverride != null) {
          fs.writeFileSync(overridePath, prevOverride, "utf8");
        } else {
          try { fs.unlinkSync(overridePath); } catch {}
        }
        return errResult({
          ok: false,
          error_code: "launch_failed",
          error_msg: `Failed to spawn Godot: ${e.message}`,
        });
      }

      const spawnError = await new Promise((resolve) => {
        child.on("error", (err) => resolve(err));
        setTimeout(() => resolve(null), 1000);
      });
      if (spawnError) {
        if (prevOverride != null) {
          fs.writeFileSync(overridePath, prevOverride, "utf8");
        } else {
          try { fs.unlinkSync(overridePath); } catch {}
        }
        return errResult({
          ok: false,
          error_code: "launch_failed",
          error_msg: `Godot executable not found: "${godotExe}". Pass godot_exe or set GODOT_PATH env var.`,
        });
      }

      grbProcess = child;
      child.stderr.on("data", () => {});

      // Clean up override.cfg when Godot exits
      child.on("exit", () => {
        if (prevOverride != null) {
          try { fs.writeFileSync(overridePath, prevOverride, "utf8"); } catch {}
        } else {
          try { fs.unlinkSync(overridePath); } catch {}
        }
      });

      const ready = await waitForReady(child);

      return {
        content: [
          {
            type: "text",
            text: `Launched Godot. Bridge ready on port ${ready.port}, tier ${ready.tier_default}. ${
              args.enable_danger ? "DANGER MODE ENABLED." : ""
            }`,
          },
        ],
      };
    }

    case "grb_connect": {
      grbPort = args.port;
      grbToken = args.token;
      await sendPing();
      return {
        content: [
          { type: "text", text: `Connected to bridge on port ${grbPort}.` },
        ],
      };
    }

    case "grb_ping": {
      const r = await sendCommand("ping");
      return {
        content: [
          { type: "text", text: r.ok && r.pong ? "OK" : JSON.stringify(r) },
        ],
      };
    }

    case "grb_screenshot": {
      const r = await sendCommand("screenshot");
      if (!r.ok) return errResult(r);
      return {
        content: [
          { type: "text", text: `Viewport ${r.width}x${r.height}` },
          { type: "image", data: r.png_base64, mimeType: "image/png" },
        ],
      };
    }

    case "grb_scene_tree": {
      const r = await sendCommand("scene_tree", {
        max_depth: args.max_depth ?? 10,
      });
      if (!r.ok) return errResult(r);
      return {
        content: [{ type: "text", text: JSON.stringify(r.scene, null, 2) }],
      };
    }

    case "grb_click": {
      const r = await sendCommand("click", { x: args.x, y: args.y });
      if (!r.ok) return errResult(r);
      return {
        content: [{ type: "text", text: `Clicked (${args.x}, ${args.y})` }],
      };
    }

    case "grb_key": {
      const r = await sendCommand("key", {
        action: args.action || "",
        keycode: args.keycode ?? -1,
      });
      if (!r.ok) return errResult(r);
      return { content: [{ type: "text", text: "Key sent" }] };
    }

    case "grb_press_button": {
      const r = await sendCommand("press_button", { name: args.name });
      if (!r.ok) return errResult(r);
      return {
        content: [
          { type: "text", text: `Pressed button: ${r.node || args.name}` },
        ],
      };
    }

    case "grb_drag": {
      const r = await sendCommand("drag", {
        from: args.from,
        to: args.to,
      });
      if (!r.ok) return errResult(r);
      return { content: [{ type: "text", text: "Drag complete" }] };
    }

    case "grb_scroll": {
      const r = await sendCommand("scroll", {
        x: args.x ?? 0,
        y: args.y ?? 0,
        delta: args.delta ?? -3,
      });
      if (!r.ok) return errResult(r);
      return { content: [{ type: "text", text: "Scroll sent" }] };
    }

    case "grb_gesture": {
      const r = await sendCommand("gesture", {
        type: args.type || "",
        params: args.params || {},
      });
      if (!r.ok) return errResult(r);
      return { content: [{ type: "text", text: "Gesture sent" }] };
    }

    case "grb_audio_state": {
      const r = await sendCommand("audio_state");
      if (!r.ok) return errResult(r);
      const { id: _id, ok: _ok, ...info } = r;
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    case "grb_network_state": {
      const r = await sendCommand("network_state");
      if (!r.ok) return errResult(r);
      const { id: _id2, ok: _ok2, ...info } = r;
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    case "grb_run_custom_command": {
      const r = await sendCommand("run_custom_command", {
        name: args.name || "",
        args: args.args ?? [],
      });
      if (!r.ok) return errResult(r);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ result: r.result }, null, 2),
          },
        ],
      };
    }

    case "grb_performance": {
      const r = await sendCommand("grb_performance");
      if (!r.ok) return errResult(r);
      const { id: _id3, ok: _ok3, ...info } = r;
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    case "grb_get_property": {
      const r = await sendCommand("get_property", {
        node: args.node,
        property: args.property,
      });
      if (!r.ok) return errResult(r);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ value: r.value }, null, 2),
          },
        ],
      };
    }

    case "grb_set_property": {
      const r = await sendCommand("set_property", {
        node: args.node,
        property: args.property,
        value: args.value,
      });
      if (!r.ok) return errResult(r);
      return { content: [{ type: "text", text: "Property set" }] };
    }

    case "grb_call_method": {
      const r = await sendCommand("call_method", {
        node: args.node,
        method: args.method,
        args: args.args ?? [],
      });
      if (!r.ok) return errResult(r);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ result: r.result }, null, 2),
          },
        ],
      };
    }

    case "grb_runtime_info": {
      const r = await sendCommand("runtime_info");
      if (!r.ok) return errResult(r);
      const { id: _id, ok: _ok, ...info } = r;
      return {
        content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      };
    }

    case "grb_get_errors": {
      const r = await sendCommand("get_errors", {
        since_index: args.since_index ?? 0,
      });
      if (!r.ok) return errResult(r);
      return {
        content: [{ type: "text", text: JSON.stringify(r, null, 2) }],
      };
    }

    case "grb_wait_for": {
      const r = await sendCommand("wait_for", {
        node: args.node,
        property: args.property,
        value: args.value,
        timeout_ms: args.timeout_ms ?? 5000,
      });
      if (!r.ok) return errResult(r);
      return {
        content: [
          {
            type: "text",
            text: r.matched
              ? `Matched in ${r.elapsed_ms}ms`
              : `Timeout after ${r.elapsed_ms}ms (last: ${JSON.stringify(r.last_value)})`,
          },
        ],
      };
    }

    case "grb_capabilities": {
      const r = await sendCommand("capabilities");
      if (!r.ok) return errResult(r);
      return {
        content: [
          {
            type: "text",
            text: `Tier ${r.tier}: ${r.commands.join(", ")}`,
          },
        ],
      };
    }

    case "grb_quit": {
      try {
        await sendCommand("quit");
      } catch {}
      if (grbProcess) {
        try { grbProcess.kill(); } catch {}
        grbProcess = null;
      }
      grbPort = null;
      grbToken = null;
      return {
        content: [{ type: "text", text: "Game quit successfully." }],
      };
    }

    case "grb_reset": {
      try {
        await sendCommand("quit");
      } catch {}
      if (grbProcess) {
        try { grbProcess.kill(); } catch {}
        grbProcess = null;
      }
      grbPort = null;
      grbToken = null;
      await new Promise((r) => setTimeout(r, 800));
      return await handleTool("grb_launch", args);
    }

    case "grb_find_nodes": {
      const r = await sendCommand("find_nodes", {
        name: args.name || "",
        type: args.type || "",
        group: args.group || "",
        limit: args.limit ?? 50,
      });
      if (!r.ok) return errResult(r);
      return {
        content: [{ type: "text", text: JSON.stringify({ matches: r.matches, count: r.count }, null, 2) }],
      };
    }

    case "grb_gamepad": {
      const r = await sendCommand("gamepad", {
        action: args.action || "",
        button: args.button ?? 0,
        pressed: args.pressed ?? true,
        axis: args.axis ?? 0,
        value: args.value ?? 0.0,
        device: args.device ?? 0,
        weak: args.weak ?? 0.0,
        strong: args.strong ?? 0.5,
        duration: args.duration ?? 0.5,
      });
      if (!r.ok) return errResult(r);
      return { content: [{ type: "text", text: "Gamepad input sent" }] };
    }

    case "grb_eval": {
      const r = await sendCommand("eval", { expr: args.expr });
      if (!r.ok) return errResult(r);
      return {
        content: [{ type: "text", text: String(r.result) }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: "Unknown tool: " + name }],
        isError: true,
      };
  }
}

function errResult(r) {
  const msg = r.error
    ? `${r.error.code}: ${r.error.message}`
    : JSON.stringify(r);
  return { content: [{ type: "text", text: "Error: " + msg }], isError: true };
}

// ── MCP server setup ──

const mcpServer = new Server(
  { name: "godot-runtime-bridge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    return await handleTool(name, args);
  } catch (err) {
    return {
      content: [{ type: "text", text: String(err.message || err) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);

// Startup notice — visible in Cursor's MCP output panel (Settings → Tools & MCP → godot-runtime-bridge → Logs)
// If GRB tools are not appearing in Cursor, the most common cause is the server not being enabled.
process.stderr.write(
  "[GRB] MCP server started (godot-runtime-bridge v1.0.0)\n" +
  "[GRB] If tools are not appearing in Cursor:\n" +
  "[GRB]   1. Open Cursor → Settings → Tools & MCP\n" +
  "[GRB]   2. Find 'godot-runtime-bridge' under Installed MCP Servers\n" +
  "[GRB]   3. Toggle it ON — this step is required\n" +
  "[GRB] Docs: https://github.com/your-repo/godot-runtime-bridge\n"
);
