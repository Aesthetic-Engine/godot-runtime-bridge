# Godot Runtime Bridge

**Runtime automation and AI-driven testing for Godot 4.x**

A lightweight TCP debug server that lets AI assistants (Cursor, Claude Code) and automation scripts launch, control, observe, and test your running Godot game — no editor required.

## Quick Start: Connect Cursor to Your Game in 5 Steps

This setup lets Cursor's AI agent launch your exported game, watch it run, click buttons, take screenshots, and report bugs — all on its own.

---

### Step 1 — Install the Addon in Godot

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

### Step 4 — Tell Cursor Where the Helper Lives

Create a file called **`mcp.json`** inside the `.cursor` folder in your project (create the folder if it doesn't exist). Paste this in, replacing the path with the actual location where you cloned the repo:

```json
{
  "mcpServers": {
    "godot-runtime-bridge": {
      "command": "node",
      "args": ["C:/path/to/godot-runtime-bridge/mcp/index.js"],
      "env": {
        "GDRB_EXE": "C:/path/to/your/exported/game.exe"
      }
    }
  }
}
```

**`GDRB_EXE`** is the path to your exported game executable — the `.exe` (Windows), `.app` (Mac), or binary (Linux) that you export from Godot. GRB tests the exported build, not the editor.

>If you're having trouble with this step, try copy/paste into Cursor and ask your Cursor agent it to do it for you.

---

### Step 5 — Enable the Server in Cursor ⚠️

**This step is easy to miss — nothing will work without it.**

1. Open Cursor
2. Go to **Settings → Tools & MCP**
3. Under **Installed MCP Servers**, find **godot-runtime-bridge**
4. Click the toggle to turn it **ON**

Once the toggle is on, Cursor will show a green indicator next to the server name. You're connected.

---

### Step 6 — Direct Cursor to Playtest Your Game

You're ready. In Cursor's chat, you can now say things like:

- *"Launch my game and take a screenshot of the title screen."*
- *"Click the Start button and verify the game enters gameplay."*
- *"Run a smoke test and report any issues you find."*
- *"Play through the first room and tell me if anything looks broken."*

Cursor will launch your game, interact with it, capture screenshots, and report back — no manual playtesting required.

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
