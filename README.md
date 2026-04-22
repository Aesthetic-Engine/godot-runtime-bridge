# Godot Runtime Bridge

**Agentic game development and runtime automation for Godot 4.5+**

GRB lets you **build, test, and debug your Godot game through prompting after a short one-time setup in Godot and Cursor.** A TCP debug server and MCP bridge connect Cursor (and Claude Code) to your running game: you describe what you want, the agent launches the game, observes it, edits code, and verifies. Full **develop -> observe -> verify** loops.

## What GRB Enables

Your AI agent can **build, test, and debug your game under your direction**:

- **Launch** the game, **observe** what’s on screen (screenshots, scene tree, properties), **control** it (click, type, navigate), and **edit source files** based on what it sees
- **Give feedback** — report visual bugs, UI clipping, missing elements, logic issues
- **Run QA missions** — automated test loops that navigate rooms, capture screenshots, perform perceptual diffs, and produce ticket-ready reports
- **Profile performance** — FPS, draw calls, memory usage for balancing and optimization
- **Inspect state** — audio buses, network status, custom game commands (when registered)
- **Editor dock with click-to-copy prompts** — every mission is a button; click to copy a ready-to-paste prompt for Cursor Agent chat. Toggle between auto-fix and report-only modes

You direct; the agent executes. *"Add a pause menu"*, *"Fix the button that’s cut off on the right"*, *"Run a smoke test and fix each bug you find"* — the agent launches the game, sees the result, edits code, and verifies. After setup, most iteration can happen from chat instead of bouncing back and forth between tools.

## GRB 2.0 First Trustworthy Proof Run

GRB 2.0 adds a proof workflow for humans and coding agents who need to move from "it changed" to "here is what was honestly proven." The first useful vertical path is:

1. Install and enable the GRB addon in a Godot project.
2. Run `grb init` to create the project contract scaffold.
3. Review and customize the generated contract files.
4. Run `grb mission run smoke_boot`.
5. Inspect `grb_reports/<run-id>/summary.md`.
6. State what was proven, what was not proven, and what still needs human review.

For now, run the CLI with Node directly. No global `grb` install is required.

### Run from the GRB repo

Initialize a Godot project:

```bash
node cli/grb.mjs init --project C:\path\to\YourGodotProject
```

Review these generated files first:

```text
AGENTS.md
grb.project.yaml
grb/proof_policy.yaml
grb/missions/smoke_boot.yaml
grb/gotchas.md
```

Run the starter proof mission:

```bash
node cli/grb.mjs mission run smoke_boot --project C:\path\to\YourGodotProject --exe C:\path\to\Godot_v4.5_or_later_console.exe
```

### Run from inside a Godot project

Initialize the current project:

```bash
node C:\path\to\grb-main\cli\grb.mjs init
```

Review the generated files, then run the starter proof mission:

```bash
node C:\path\to\grb-main\cli\grb.mjs mission run smoke_boot --exe C:\path\to\Godot_v4.5_or_later_console.exe
```

You may also set `GODOT_EXE` instead of passing `--exe`.

### Proof Bundle Output

`smoke_boot` reuses `missions/run_mission.mjs` and writes into the target Godot project:

```text
grb_reports/<run-id>/
  summary.md
  run.json
  mission_runner/
    OVERALL.md
    smoke_boot/
      boot_screen.png
      after_wait.png
      report-*.md
```

Start with `summary.md`. It now includes a First-Run Verdict:

- proven by automation
- not proven by automation
- needs human review
- blocked reason, when applicable
- next recommended step

Use `run.json` when another tool needs the same information in machine-readable form.

### What W / R / E Mean Here

- **W**: wiring proof. The project launched, GRB connected, runtime info/errors were checked, scene tree was captured, and screenshots were saved.
- **R**: runtime visual evidence. Screenshots were captured for inspection, but the CLI does not automatically know whether the visuals are correct.
- **E**: experiential proof. A human must confirm feel, timing, UX, and design intent.

### Current Limits

- R-tier screenshots are evidence, not automatic visual validation.
- E-tier is never claimed by automation.
- Some copied projects need to be opened once in Godot before `smoke_boot` can reach `GDRB_READY`.
- The CLI is still invoked as `node cli/grb.mjs`; packaging and PATH polish are intentionally out of scope for this slice.
- The generated scaffold is a starter contract. Customize project-specific expectations before asking agents to claim higher proof.

### Natural Second Step: Compare Runs

After a first proof run passes and its `summary.md` looks trustworthy, that run becomes a **baseline candidate**. A baseline is not magic truth; it is a prior passing proof bundle that you intentionally use as the reference for the next run.

Use comparison when you want to answer: "Did this new run change versus the baseline, and does that change look like a possible regression?"

There are two compare flows.

**Run-and-compare** creates a fresh candidate run and compares it to the latest previous passing run of the same mission:

```bash
node cli/grb.mjs mission run smoke_boot --project C:\path\to\YourGodotProject --exe C:\path\to\Godot_v4.5_or_later_console.exe --compare-to latest
```

Use this after you already have at least one passing run for that mission.

**Bundle-to-bundle compare** compares two known proof bundles directly:

```bash
node cli/grb.mjs compare C:\path\to\baseline-run C:\path\to\candidate-run
```

Use this when you want to choose the baseline explicitly.

If no trustworthy baseline exists, comparison is blocked rather than guessed. Create a passing baseline run first, or pass an explicit baseline bundle.

Common outcomes:

- `matched`: compared artifacts matched; still inspect the summary before claiming user-facing correctness.
- `difference_detected`: something changed; decide whether it was intended.
- `regression_suspected`: the change conflicts with the mission expectation and should be treated as a suspected regression until reviewed.
- `blocked`: comparison did not run because baseline selection or bundle loading was not trustworthy.
- `human_review_required`: automation found evidence that needs judgment.

Comparison output is written into the candidate bundle under `comparison/`, and the candidate `summary.md` gets a comparison section.

With the proving ground, a simple compare practice run is:

```bash
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe --compare-to latest
```

`--compare-to latest` resolves to the newest previous passing run with the same `mission_id`. The candidate run is never eligible as its own baseline, and blocked/corrupt/mismatched automatic candidates are rejected with reasons in `comparison/comparison.md`.

### GRB 2.0 Proving Ground

Sprint 3 adds a tiny deterministic Godot project at `examples/grb2-proving-ground/` for validating and demoing proof workflows without a real game project. It has stable boot, transition, HUD/state, and toggle-panel surfaces.

```bash
node examples/grb2-proving-ground/tools/sync_grb_addon.mjs
Godot_v4.6-stable_win64_console.exe --headless --editor --quit --path examples/grb2-proving-ground
node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run toggle_panel --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
```

The example keeps the canonical addon source under `addons/godot-runtime-bridge`; its local synced addon copy, `.godot/`, and `grb_reports/` are ignored.

## Initial Setup (Critical)

1. **Install Godot 4.5 or later.** GRB relies on Godot's `Logger` API, which was added in Godot 4.5.
2. **Create a Godot project** (or open one you already have) and save it somewhere easy to find.
3. **Open that project folder in Cursor.** It should be the folder that contains `project.godot`.
4. **Know where your Godot executable is.** GRB needs that path later as `GODOT_PATH` so Cursor can launch your game.

## Quick Start: Connect Cursor to Your Game

**Option 1 — Manual steps**

---

### Step 1 — Install the Addon in Godot

This addon supports **Godot 4.5 and later**.

**From the Asset Library (recommended):**
Open your project in the Godot editor, click the **AssetLib** tab at the top, search for **"Godot Runtime Bridge"**, and install it.

**Manual:**
Download this repo and copy the `addons/godot-runtime-bridge/` folder into your project's `addons/` folder.

Then go to **Project -> Project Settings -> Plugins** and enable **Godot Runtime Bridge**.

When the plugin is enabled, GRB adds its runtime server automatically. You do **not** need to wire `GRBServer` by hand for a normal setup.

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

On Windows, forward slashes are the easiest option in JSON paths, like `C:/Tools/Godot/Godot_v4.6-stable_win64.exe`.

If you are on Windows and have both `Godot_v4.x-stable_win64.exe` and `Godot_v4.x-stable_win64_console.exe`, GRB now prefers the companion console executable automatically when it can find it. This keeps stdout and stderr visible for launch diagnostics without changing your normal project setup.

For exported builds only: add `GDRB_EXE` to `env` with the path to your exported game (`.exe`, `.app`, or binary). When present, missions and some flows use the export instead of the editor run.

> If you're having trouble, copy this block into Cursor and ask the agent to create `.cursor/mcp.json` for you, or use Option 2 below.

---

### Step 5 — Enable the Server in Cursor ⚠️

**This step is easy to miss — nothing will work until you do it.**

1. Open Cursor
2. Go to **Settings → Tools & MCP**
3. Under **Installed MCP Servers**, find **godot-runtime-bridge**
4. Click the toggle to turn it **ON**

Once the toggle is on, Cursor can see the GRB MCP server and use its tools.

---

**Option 2 — Let Cursor set it up**

1. Drop this prompt into **Cursor Agent mode**:

   > Set up the Godot Runtime Bridge (GRB) for this project. Install the addon if missing, create .cursor/mcp.json with the GRB MCP server (args: path to godot-runtime-bridge/mcp/index.js), add GODOT_PATH to env with the path to my Godot executable — search common locations or ask me. Run npm install in the mcp folder if needed. Tell me when done.

2. Go to **Cursor Settings -> Tools & MCP** and verify **godot-runtime-bridge** is enabled under Installed MCP Servers.
3. Ask Cursor: *"Connect to Godot via the GRB bridge and confirm once connected."*

---

### Step 6 — Direct Your Agent

You're ready. In Cursor's chat, you can now say things like:

- *"Launch my game and take a screenshot of the title screen."*
- *"Click the Start button and verify the game enters gameplay."*
- *"Run a smoke test and fix each bug you find."*
- *"The composure bar is missing — add it to the HUD."*
- *"Play through the first room and tell me what’s broken; then fix the issues."*

Cursor will launch your game, interact with it, capture screenshots, edit your code, and verify fixes.

---

**Having trouble?** If the GRB tools are not showing up in Cursor, check **Settings -> Tools & MCP -> godot-runtime-bridge -> Logs** for a startup message with troubleshooting hints.
**Still having trouble?** Paste the setup steps above into Cursor Agent mode and ask it to help you troubleshoot your config.

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
| 0 (observe) | ping, auth_info, capabilities, screenshot, scene_tree, get_property, runtime_info, get_errors, wait_for, audio_state, network_state, grb_performance, find_nodes |
| 1 (input) | click, key, press_button, drag, scroll, gesture, gamepad |
| 2 (control) | set_property, call_method, quit, run_custom_command |
| 3 (danger) | eval |

`run_custom_command` is optional. If you want project-specific helper commands, open the GRB dock in the Godot editor and use the **Enable GRBCommands** button. Then register callables in your game and invoke them through `grb_run_custom_command`.

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
| `GODOT_PATH` | (none) | Preferred Godot executable path for the MCP launcher |
| `GODOT_CONSOLE_PATH` | (none) | Optional Windows console executable path. If set, the MCP launcher prefers it for richer launch logs |

## Background Testing

By default (`GDRB_INPUT_MODE=synthetic`), all input commands inject Godot `InputEvent` objects without touching the OS cursor. In this mode, real mouse and keyboard events from your hardware are **blocked from reaching game nodes entirely** — the bridge intercepts them at the viewport level so only GRB-injected events get through. Your mouse and keyboard remain yours.

If you need OS-level input (rare edge cases), set `GDRB_INPUT_MODE=os`.

For projects configured with fullscreen display settings, set `GDRB_FORCE_WINDOWED=1` to override the project's window mode at startup.

**Important: do not minimize the game window.** Godot drastically throttles processing when its window is minimized to the taskbar, which will slow or break tests. Covering the game window with other applications is perfectly fine — only minimizing causes throttling. For best results, leave the game window open somewhere on screen (behind other windows is OK) while you work.

## Production Builds

The server is completely inert without activation environment variables. No TCP server, no port, no overhead. Safe to ship in production builds without removing the addon.

## Release Verification

From the `mcp/` folder:

```bash
npm run verify:versions
npm run verify:grb -- --godot-exe "/path/to/godot" --project "/path/to/project"
npm run verify:release -- --godot-exe "/path/to/godot" --project "/path/to/project"
```

`verify:grb` performs a release-grade smoke run: launch, `ping`, `auth_info`, `capabilities`, `runtime_info`, `get_errors`, `screenshot`, and clean `quit`. Artifacts are written to `mcp/reports/release-smoke/`.

## License

MIT — see [LICENSE](LICENSE).
