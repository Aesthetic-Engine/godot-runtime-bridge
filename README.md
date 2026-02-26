# Godot Runtime Bridge

**Agentic game development and runtime automation for Godot 4.5+**

GRB lets you **build, test, and debug your Godot game entirely via prompting — no need to work in the editor.** A TCP debug server and MCP bridge connects Cursor (and Claude Code) to your running game: you describe what you want, the agent launches the game, observes it, edits code, and verifies. Full **develop → observe → verify** loops.

## What GRB Enables

Your AI agent can **build, test, and debug your game under your direction**:

- **Launch** the game, **observe** what’s on screen (screenshots, scene tree, properties), **control** it (click, type, navigate), and **edit source files** based on what it sees
- **Give feedback** — report visual bugs, UI clipping, missing elements, logic issues
- **Run QA missions** — automated test loops that navigate rooms, capture screenshots, perform perceptual diffs, and produce ticket-ready reports
- **Profile performance** — FPS, draw calls, memory usage for balancing and optimization
- **Inspect state** — audio buses, network status, custom game commands (when registered)
- **Editor dock with click-to-copy prompts** — every mission is a button; click to copy a ready-to-paste prompt for Cursor Agent chat. Toggle between auto-fix and report-only modes

You direct; the agent executes. *"Add a pause menu"*, *"Fix the button that’s cut off on the right"*, *"Run a smoke test and fix each bug you find"* — the agent launches the game, sees the result, edits code, and verifies. No context switching, no editor required.

## Initial Setup (Critical)

1. **Create a new project in Godot** (or use an existing one). Save it in a folder you can open in Cursor.
2. **Open Cursor** → **File → Open Folder** and select the folder containing your Godot project (the one with `project.godot`).
3. **Tell Cursor where Godot is.** Cursor needs your Godot executable path to launch your game and project. Set `GODOT_PATH` in your MCP config (see Step 4), or provide it when the agent asks. Without this, GRB cannot launch Godot.

## Quick Start: Connect Cursor to Your Game

**Option 1 — Manual steps**

---

### Step 1 — Install the Addon in Godot

**Requires Godot 4.5 or later.** GRB uses the `Logger` API (`OS.add_logger`) introduced in 4.5 for engine error capture. Earlier versions of Godot 4 are not supported.

**From the Asset Library (recommended):**
Open your project in the Godot editor, click the **AssetLib** tab at the top, search for **"Godot Runtime Bridge"**, and install it.

**Manual:**
Download this repo and copy the `addons/godot-runtime-bridge/` folder into your project's `addons/` folder.

Then go to **Project → Project Settings → Plugins** and enable **Godot Runtime Bridge**.

---

### Step 2 — Install Node.js (one-time)

The bridge talks to Cursor through a small helper program that requires Node.js.

1. Go to **https://nodejs.org** and download the LTS version
2. Run the installer — defaults are fine
3. Restart your computer if prompted

---

### Step 3 — Set Up the MCP Helper

Open a terminal (Command Prompt on Windows, Terminal on Mac) and run:

```bash
git clone https://github.com/Aesthetic-Engine/godot-runtime-bridge.git
cd godot-runtime-bridge/mcp
npm install
```

This downloads the helper and installs its dependencies. You only need to do this once.

---

### Step 4 — Tell Cursor Where the Helper and Godot Live

Create a file called **`mcp.json`** inside the `.cursor` folder in your project (create the folder if it doesn't exist). Paste this in, replacing paths with your actual locations:

```json
{
  "mcpServers": {
    "godot-runtime-bridge": {
      "command": "node",
      "args": ["C:/path/to/godot-runtime-bridge/mcp/index.js"],
      "env": {
        "GODOT_PATH": "C:/path/to/Godot_v4.x-stable_win64.exe"
      }
    }
  }
}
```

**`GODOT_PATH`** is the path to your Godot executable. Cursor uses this to launch Godot and your project. Required for `grb_launch` to work.

For exported builds only: add `GDRB_EXE` to `env` with the path to your exported game (`.exe`, `.app`, or binary). When present, missions and some flows use the export instead of the editor run.

> If you're having trouble, copy this block into Cursor and ask the agent to create `.cursor/mcp.json` for you, or use Option 2 below.

---

### Step 5 — Enable the Server in Cursor ⚠️

**This step is easy to miss — nothing will work without it.**

1. Open Cursor
2. Go to **Settings → Tools & MCP**
3. Under **Installed MCP Servers**, find **godot-runtime-bridge**
4. Click the toggle to turn it **ON**

Once the toggle is on, Cursor will show a green indicator next to the server name. You're connected.

---

**Option 2 — Let Cursor set it up**

1. Drop this prompt into **Cursor Agent mode**:

   > Set up the Godot Runtime Bridge (GRB) for this project. Install the addon if missing, create .cursor/mcp.json with the GRB MCP server (args: path to godot-runtime-bridge/mcp/index.js), add GODOT_PATH to env with the path to my Godot executable — search common locations or ask me. Run npm install in the mcp folder if needed. Tell me when done.

2. Go to **Cursor Settings → Tools & MCP** and verify **godot-runtime-bridge** is enabled under Installed MCP Servers.
3. Ask Cursor: *"Connect to Godot via the GRB bridge and confirm once connected."*

---

### Step 6 — Direct Your Agent

You're ready. In Cursor's chat, you can now say things like:

- *"Launch my game and take a screenshot of the title screen."*
- *"Click the Start button and verify the game enters gameplay."*
- *"Run a smoke test and fix each bug you find."*
- *"The composure bar is missing — add it to the HUD."*
- *"Play through the first room and tell me what’s broken; then fix the issues."*

Cursor will launch your game, interact with it, capture screenshots, edit your code, and verify fixes — no manual playtesting or editor switching required.

---

**Having trouble?** If the GRB tools aren't showing up in Cursor, check **Settings → Tools & MCP → godot-runtime-bridge → Logs** for a startup message with troubleshooting hints.
**Still having trouble?** Feed this entire readme into Cursor and it'll likely help you troubleshoot until you're set.

See [`mcp/README.md`](mcp/README.md) for Claude Code setup, advanced configuration, and the full list of available AI tools.

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

See [PROTOCOL.md](PROTOCOL.md) for the complete command reference. To use `run_custom_command`, add the `GRBCommands` autoload in Project Settings (path: `res://addons/godot-runtime-bridge/runtime_bridge/GRBCommands.gd`) and register callables in your game.

| Tier | Commands |
|------|----------|
| 0 (observe) | ping, auth_info, capabilities, screenshot, scene_tree, get_property, runtime_info, get_errors, wait_for, audio_state, network_state, grb_performance, find_nodes |
| 1 (input) | click, key, press_button, drag, scroll, gesture, gamepad |
| 2 (control) | set_property, call_method, quit, run_custom_command |
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
