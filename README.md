# Godot Runtime Bridge

**Runtime automation and AI-driven testing for Godot 4.x**

A lightweight TCP debug server that lets AI assistants (Cursor, Claude Code) and automation scripts launch, control, observe, and test your running Godot game — no editor required.

## Quick Start

### 1. Install the Addon

**From the Asset Library:** Search "Godot Runtime Bridge" in **AssetLib** within the Godot editor and install.

**Manual:** Copy `addons/godot-runtime-bridge/` into your project's `addons/` folder.

Enable the plugin in **Project → Project Settings → Plugins**.

### 2. Run Your Game with the Bridge Enabled

```bash
# Auto-generated token, random port, tier 1 (observe + input)
GODOT_DEBUG_SERVER=1 godot --path /your/project

# Or with explicit token and tier
GDRB_TOKEN=my_secret_token GDRB_PORT=9999 GDRB_TIER=2 godot --path /your/project
```

On startup, the server prints:

```
GDRB_READY:{"proto":"grb/1","port":54321,"token":"xK9m...","tier_default":1}
```

### 3. Send Commands

Connect via TCP to `127.0.0.1:<port>` and send newline-delimited JSON:

```json
{"id":"1","cmd":"ping"}
{"id":"2","cmd":"screenshot","token":"xK9m..."}
{"id":"3","cmd":"click","args":{"x":100,"y":200},"token":"xK9m..."}
{"id":"4","cmd":"scene_tree","args":{"max_depth":3},"token":"xK9m..."}
```

### 4. Use with an MCP Client (Cursor, Claude Code)

A companion MCP server lets AI assistants launch, observe, and control your game directly. Setup:

```bash
git clone https://github.com/Aesthetic-Engine/godot-runtime-bridge.git
cd godot-runtime-bridge/mcp
npm install
```

Then add to your `.cursor/mcp.json` (replace the path with where you cloned):

```json
{
  "mcpServers": {
    "godot-runtime-bridge": {
      "command": "node",
      "args": ["C:/path/to/godot-runtime-bridge/mcp/index.js"]
    }
  }
}
```

See [`mcp/README.md`](mcp/README.md) for Claude Code setup and the full list of 17 AI tools.

## Security

The bridge is designed with security-first defaults:

- **Off by default** — does nothing without activation env vars
- **Localhost only** — binds to `127.0.0.1`, never exposed to network
- **Random port** — OS-assigned by default, prevents predictable port attacks
- **Token auth** — every command requires a valid token
- **Capability tiers** — commands grouped by risk (observe/input/control/danger)
- **eval disabled by default** — requires two explicit opt-ins

See [SECURITY.md](SECURITY.md) for the full threat model and recommendations.

## Commands

See [PROTOCOL.md](PROTOCOL.md) for the complete command reference.

| Tier | Commands |
|------|----------|
| 0 (observe) | ping, auth_info, capabilities, screenshot, scene_tree, get_property, runtime_info, get_errors, wait_for |
| 1 (input) | click, key, press_button, drag, scroll |
| 2 (control) | set_property, call_method |
| 3 (danger) | eval |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GDRB_TOKEN` | (none) | Auth token. Enables the server. Auto-generates if `GODOT_DEBUG_SERVER=1` |
| `GDRB_PORT` | 0 (random) | TCP port. Set for deterministic setups |
| `GDRB_TIER` | 1 | Max session tier (0-3) |
| `GDRB_INPUT_MODE` | `synthetic` | `synthetic` (no OS cursor movement) or `os` (moves real cursor) |
| `GDRB_FORCE_WINDOWED` | (none) | Set to `1` to enforce windowed mode at startup (overrides project fullscreen settings) |
| `GDRB_ENABLE_DANGER` | (none) | Set to `1` to allow eval. Also requires tier 3 |
| `GODOT_DEBUG_SERVER` | (none) | Legacy activation. Set to `1` to enable |

## Background Testing

By default (`GDRB_INPUT_MODE=synthetic`), all input commands inject Godot `InputEvent` objects without touching the OS cursor. In this mode, real mouse and keyboard events from your hardware are **blocked from reaching game nodes entirely** — the bridge intercepts them at the viewport level so only GRB-injected events get through. Your mouse and keyboard remain yours.

If you need OS-level input (rare edge cases), set `GDRB_INPUT_MODE=os`.

For projects configured with fullscreen display settings, set `GDRB_FORCE_WINDOWED=1` to override the project's window mode at startup.

**Important: do not minimize the game window.** Godot drastically throttles processing when its window is minimized to the taskbar, which will slow or break tests. Covering the game window with other applications is perfectly fine — only minimizing causes throttling. For best results, leave the game window open somewhere on screen (behind other windows is OK) while you work.

## Production Builds

The server is completely inert without activation environment variables. No TCP server, no port, no overhead. Safe to ship in production builds without removing the addon.

## License

MIT — see [LICENSE](LICENSE).
