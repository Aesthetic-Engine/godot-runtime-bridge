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
];

// ── Handlers ──

async function handleTool(name, args) {
  switch (name) {
    case "grb_launch": {
      const projectPath = args.project_path;
      const godotExe = args.godot_exe || process.env.GODOT_PATH || "godot";
      const tier = args.tier != null ? String(args.tier) : "1";
      const token = crypto.randomBytes(24).toString("hex");

      const env = {
        ...process.env,
        GDRB_TOKEN: token,
        GDRB_TIER: tier,
      };
      if (args.enable_danger) env.GDRB_ENABLE_DANGER = "1";

      const child = spawn(godotExe, ["--path", projectPath], {
        cwd: projectPath,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      grbProcess = child;
      child.stderr.on("data", () => {});

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
  { name: "godot-runtime-bridge", version: "0.1.0" },
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
