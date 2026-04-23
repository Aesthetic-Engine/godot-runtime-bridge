# Godot Runtime Bridge - MCP Server

MCP server that lets AI assistants launch, observe, and control a running Godot
game through the Godot Runtime Bridge addon.

## Install

Clone the repo and install from `mcp/`:

```bash
git clone https://github.com/Aesthetic-Engine/godot-runtime-bridge.git
cd godot-runtime-bridge/mcp
npm install
```

The package in this repo is named `godot-runtime-bridge-mcp`.

## Setup

### Cursor

Add to your project's `.cursor/mcp.json` (or global MCP config):

```json
{
  "mcpServers": {
    "godot-runtime-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/godot-runtime-bridge/mcp/index.js"]
    }
  }
}
```

### Claude Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "godot-runtime-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/godot-runtime-bridge/mcp/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned the repo,
then restart your AI client.

## Prerequisites

1. The Godot Runtime Bridge addon installed in your Godot project
2. Node.js 18+
3. A Godot 4.x executable available through `GODOT_PATH` or passed to
   `grb_launch`

On Windows, the launcher prefers a companion `*_console.exe` when it exists so
launch diagnostics and parse errors stay visible in stdout/stderr. You can also
set `GODOT_CONSOLE_PATH` explicitly.

## Tool Surface

Once configured, your AI assistant can use these tools.

### Launch and Session

| Tool | Description |
|------|-------------|
| `grb_launch` | Launch a Godot game with GRB enabled and auto-discover the port/token |
| `grb_connect` | Connect to an already-running game with a known port/token |
| `grb_ping` | Check whether the bridge is reachable |
| `grb_capabilities` | List commands available at the current session tier |
| `grb_quit` | Ask the running game to quit cleanly |
| `grb_reset` | Quit, then relaunch using the last launch settings |

### Observe (Tier 0)

| Tool | Description |
|------|-------------|
| `grb_screenshot` | Capture a screenshot from the game viewport |
| `grb_scene_tree` | Get the scene tree (node names and types) |
| `grb_get_property` | Read a property from a node |
| `grb_runtime_info` | Get engine/runtime summary such as FPS, current scene, and node count |
| `grb_get_errors` | Read captured Godot errors and warnings |
| `grb_wait_for` | Wait until a property matches a value (or timeout) |
| `grb_audio_state` | Inspect audio bus names, levels, mute state, and mix rate |
| `grb_network_state` | Read the bridge's current multiplayer/network placeholder state |
| `grb_performance` | Capture available Godot performance counters |
| `grb_find_nodes` | Search the scene tree by name, type, or group |

### Input (Tier 1)

| Tool | Description |
|------|-------------|
| `grb_click` | Click at viewport coordinates |
| `grb_key` | Send an action name or raw keycode |
| `grb_press_button` | Find a button by name and trigger it |
| `grb_drag` | Drag from one point to another |
| `grb_scroll` | Scroll at a position |
| `grb_gesture` | Send pinch or swipe gestures |
| `grb_gamepad` | Send gamepad button, axis, or vibration actions |

### Control (Tier 2)

| Tool | Description |
|------|-------------|
| `grb_set_property` | Set a property on a node |
| `grb_call_method` | Call a method on a node |
| `grb_run_custom_command` | Call project-registered hooks via `GRBCommands` |

### Danger (Tier 3)

| Tool | Description |
|------|-------------|
| `grb_eval` | Execute a GDScript expression (requires `enable_danger: true` on launch) |

Danger-tier access is deliberately separate. It is not needed for normal proof
or gameplay automation flows.

## Release Verification

From `mcp/`:

```bash
npm run verify:versions
npm run verify:grb2:shape
npm run verify:grb -- --godot-exe "/path/to/godot" --project "/path/to/project"
npm run verify:release -- --godot-exe "/path/to/godot" --project "/path/to/project"
```

- `verify:grb2:shape` runs the repo's full-clone GRB 2.0 product-shape check
  from `../tools/verify_grb2_product_shape.mjs`. It does not launch Godot.
- `verify:versions` checks version parity across:
  - `mcp/package.json`
  - `mcp/package-lock.json`
  - `addons/godot-runtime-bridge/plugin.cfg`
  - `addons/godot-runtime-bridge/runtime_bridge/EditorDock.gd`
  - `mcp/index.js` server version and startup banner
- `verify:grb` runs the live release smoke sequence
- `verify:release` is the honest aggregate release gate: it runs
  `verify:grb2:shape`, then version parity, then the live release smoke
  sequence. Use this when you want one command to cover the full release-facing
  checks.
- `verify:release:live` runs version parity plus the live release smoke
  sequence only (no product-shape check). Use this when you have already run
  `verify:grb2:shape` separately and just want to re-exercise the live smoke.

This MCP package lives inside the full repo. Release verification that covers
GRB 2.0 proof/onboarding truth still depends on a full clone; addon-only export
or AssetLib installs do not include that repo-level tooling surface.

For the compact GRB 2.0 release-candidate readiness summary, see
`../docs/grb2-release-candidate-readiness.md`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GODOT_PATH` | Default Godot executable path when `godot_exe` is not passed to `grb_launch` |
| `GODOT_CONSOLE_PATH` | Optional Windows console executable path. Preferred over `GODOT_PATH` when present |

## License

MIT
