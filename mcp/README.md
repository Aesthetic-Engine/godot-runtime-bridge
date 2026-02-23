# Godot Runtime Bridge — MCP Server

MCP server that lets AI assistants (Cursor, Claude Code) launch, observe, and control a running Godot game through the [Godot Runtime Bridge](https://github.com/Aesthetic-Engine/godot-runtime-bridge).

## Install

### Option A: Clone and install (recommended)

```bash
git clone https://github.com/Aesthetic-Engine/godot-runtime-bridge.git
cd godot-runtime-bridge/mcp
npm install
```

### Option B: Install from GitHub Packages

```bash
npm install -g @aesthetic-engine/godot-runtime-bridge-mcp --registry=https://npm.pkg.github.com
```

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

Replace `/absolute/path/to/` with the actual path where you cloned the repo.

Restart your AI client after adding the config.

## Prerequisites

1. **Godot Runtime Bridge addon** installed in your Godot project (copy `addons/godot-runtime-bridge/` into your project)
2. **Node.js 18+**
3. **Godot 4.x** executable accessible (set `GODOT_PATH` env var or pass the path when launching)

## Usage

Once configured, your AI assistant can use these tools:

### Launch and Connect

| Tool | Description |
|------|-------------|
| `grb_launch` | Launch a Godot game with GRB enabled (auto-discovers port and token) |
| `grb_connect` | Connect to an already-running game (provide port and token) |
| `grb_ping` | Check if the bridge is reachable |

### Observe (Tier 0)

| Tool | Description |
|------|-------------|
| `grb_screenshot` | Capture a screenshot from the game viewport |
| `grb_scene_tree` | Get the scene tree (node names and types) |
| `grb_get_property` | Read a property from a node |
| `grb_runtime_info` | Get engine version, FPS, current scene, node count |
| `grb_wait_for` | Wait until a property matches a value (or timeout) |
| `grb_capabilities` | List commands available at the current tier |

### Input (Tier 1)

| Tool | Description |
|------|-------------|
| `grb_click` | Click at viewport coordinates |
| `grb_key` | Send a key press (action name or raw keycode) |
| `grb_press_button` | Find a button by name and trigger it |
| `grb_drag` | Drag from one point to another |
| `grb_scroll` | Scroll at a position |

### Control (Tier 2)

| Tool | Description |
|------|-------------|
| `grb_set_property` | Set a property on a node |
| `grb_call_method` | Call a method on a node |

### Danger (Tier 3)

| Tool | Description |
|------|-------------|
| `grb_eval` | Execute a GDScript expression (requires `enable_danger: true` on launch) |

## Example Conversation

> **You:** Launch my game at C:\MyGame and take a screenshot of the title screen
>
> **AI:** *calls grb_launch, then grb_screenshot* — Here's your title screen. I can see a Start button and an Options button.
>
> **You:** Click Start and tell me what happens
>
> **AI:** *calls grb_click, waits, calls grb_screenshot* — The game transitioned to gameplay. I can see the player character in a room.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GODOT_PATH` | Default Godot executable path (used if `godot_exe` not passed to `grb_launch`) |

## License

MIT
