#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf-8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, needle, label) {
  assert(String(text).includes(needle), `${label} missing expected text: ${needle}`);
}

function assertNotIncludes(text, needle, label) {
  assert(!String(text).toLowerCase().includes(String(needle).toLowerCase()), `${label} contains forbidden claim: ${needle}`);
}

function main() {
  const security = read("SECURITY.md");
  const readme = read("README.md");
  const mcpReadme = read("mcp/README.md");
  const protocol = read("PROTOCOL.md");
  const debugServer = read("addons/godot-runtime-bridge/runtime_bridge/DebugServer.gd");
  const commands = read("addons/godot-runtime-bridge/runtime_bridge/Commands.gd");
  const mcpIndex = read("mcp/index.js");

  assert(fs.existsSync(path.join(repoRoot, "SECURITY.md")), "SECURITY.md missing");

  assertIncludes(debugServer, "TCPServer.new()", "DebugServer transport");
  assertIncludes(debugServer, 'server.listen(_bind_port, "127.0.0.1")', "DebugServer bind address");
  assertIncludes(debugServer, "var _bind_port: int = 0", "DebugServer default port");
  assertIncludes(debugServer, 'if token_env == "" and legacy_env != "1":', "DebugServer activation gate");
  assertIncludes(debugServer, 'var _session_tier: int = _Commands.Tier.INPUT', "DebugServer default tier");
  assertIncludes(debugServer, '_danger_enabled = OS.get_environment("GDRB_ENABLE_DANGER") == "1"', "DebugServer danger env gate");
  assertIncludes(debugServer, 'if cmd == "eval" and not _danger_enabled:', "DebugServer eval gate");

  assertIncludes(commands, '"eval":          Tier.DANGER', "Commands danger tier");
  assertIncludes(commands, 'const TOKEN_EXEMPT: Array[String] = []', "Commands token exemption policy");

  assertIncludes(protocol, "Newline-delimited JSON over TCP.", "Protocol transport doc");
  assertIncludes(protocol, "The server only starts when the runtime has the `grb`, `debug`, or `editor`", "Protocol startup doc");
  assertIncludes(protocol, "bearer token once the server is running", "Protocol auth doc");

  assertIncludes(mcpIndex, "StdioServerTransport", "MCP stdio transport");
  assertIncludes(mcpIndex, 'import net from "net";', "MCP raw TCP transport");
  assertNotIncludes(mcpIndex, "WebSocketServer", "MCP transport surface");
  assertNotIncludes(mcpIndex, "createServer(", "MCP HTTP transport surface");
  assertNotIncludes(mcpIndex, 'from "http"', "MCP HTTP transport surface");
  assertNotIncludes(mcpIndex, 'from "https"', "MCP HTTPS transport surface");
  assertNotIncludes(mcpIndex, 'from "ws"', "MCP WebSocket transport surface");

  assertIncludes(security, "local development bridge", "SECURITY framing");
  assertIncludes(security, "not independently audited", "SECURITY honesty");
  assertIncludes(security, "stdio", "SECURITY architecture");
  assertIncludes(security, "raw localhost TCP", "SECURITY architecture");
  assertIncludes(security, "newline-delimited", "SECURITY architecture");
  assertIncludes(security, "no HTTP or WebSocket runtime server surface", "SECURITY architecture");
  assertIncludes(security, "Off by default", "SECURITY defaults");
  assertIncludes(security, "`127.0.0.1` only", "SECURITY defaults");
  assertIncludes(security, "Random by default (`0` / OS-assigned)", "SECURITY defaults");
  assertIncludes(security, "Bearer token required on every command", "SECURITY defaults");
  assertIncludes(security, "eval", "SECURITY dangerous modes");
  assertIncludes(security, "run_custom_command", "SECURITY dangerous modes");
  assertIncludes(security, "malicious same-user local processes", "SECURITY non-goals");
  assertIncludes(security, "compromised MCP client", "SECURITY non-goals");
  assertIncludes(security, "leaked local bearer token", "SECURITY non-goals");
  assertIncludes(security, "prompt-injected agents", "SECURITY non-goals");
  assertIncludes(security, "public-network exposure", "SECURITY non-goals");

  assertIncludes(readme, "[SECURITY.md](SECURITY.md)", "README security link");
  assertIncludes(mcpReadme, "../SECURITY.md", "MCP README security link");

  const forbiddenClaims = [
    "enterprise-grade security",
    "safe for enterprise deployment",
    "production-safe automation",
  ];
  for (const phrase of forbiddenClaims) {
    assertNotIncludes(readme, phrase, "README security claims");
    assertNotIncludes(mcpReadme, phrase, "MCP README security claims");
  }
}

try {
  main();
  console.log("ok GRB security shape");
} catch (err) {
  console.error(`GRB security-shape verification failed: ${err.message}`);
  process.exit(1);
}
