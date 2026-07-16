import assert from "node:assert/strict";
import { formatBridgeError, formatQuitResult } from "./tool_result_messages.mjs";

assert.equal(
  formatBridgeError({ error: { code: "not_connected", message: "Launch first." } }),
  "not_connected: Launch first."
);
assert.equal(
  formatBridgeError({ error_code: "launch_failed", error_msg: "Godot was not found." }),
  "launch_failed: Godot was not found."
);
assert.equal(
  formatBridgeError({ error_msg: "Launch failed." }),
  "Launch failed."
);
assert.equal(
  formatBridgeError({ ok: false }),
  '{"ok":false}'
);

assert.equal(
  formatQuitResult({ hadSession: false, quitAcknowledged: false }),
  "No active GRB session to quit."
);
assert.equal(
  formatQuitResult({ hadSession: true, quitAcknowledged: true }),
  "Game quit successfully."
);
assert.equal(
  formatQuitResult({ hadSession: true, quitAcknowledged: false }),
  "GRB session closed locally; the runtime did not acknowledge quit."
);

console.log("MCP tool-result messaging tests passed.");
