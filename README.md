# Godot Runtime Bridge

**AI-assisted development, testing, and honest proof for Godot 4.5+**

GRB is a Godot addon that lets an AI coding agent — Cursor, Claude Code, Codex, Antigravity, or similar — build, test, and debug your game by chatting with it. Tell the agent what you want — *"add a pause menu"*, *"the start button is cut off"* — and it launches your game, looks at the screen, edits your code, and checks the result. You stay in chat; the agent does the clicking.

GRB 2.0 also supports an optional **proof workflow** for when you want more than *"it seems fixed"*: a reproducible way to run your game, capture evidence, and get a report that honestly states what was verified vs. what still needs a human to look at.

## Things to Say to Your Coding Agent

Once GRB is set up (see below), you can direct your coding agent in plain English:

- *"Launch my game and take a screenshot of the title screen."*
- *"Click the Start button and verify the game enters gameplay."*
- *"The composure bar is missing — add it to the HUD."*
- *"Run a smoke test and fix each bug you find."*
- *"Play through the first room and tell me what's broken, then fix the issues."*

Your coding agent will launch your game, interact with it, capture screenshots, edit your code, and verify fixes.

## What GRB Does

Your coding agent can:

- **Launch** your game, **observe** it (screenshots, scene tree, properties), **control** it (click, type, navigate), and **edit your code** based on what it sees
- **Report visual bugs** — UI clipping, missing elements, layout problems, logic issues
- **Run missions** — short predefined scripts like *"launch the game, wait 2 seconds, take two screenshots, compare them"* (good for automated QA passes)
- **Profile performance** — FPS, draw calls, memory usage
- **Inspect game state** — audio buses, network status, custom commands you register
- **Use the editor dock** — every mission is a button; click to copy a ready-to-paste prompt for your coding agent's chat. Toggle between auto-fix and report-only modes

There are two independent ways to use GRB:

1. **Agent path** (everyday vibe-coding): chat with your coding agent; GRB runs in the background driven by the agent.
2. **Proof path** (optional, reproducible): a small CLI runs a mission and writes a bundle of evidence with explicit *"here's what was verified / here's what still needs you"* notes.

You don't have to use the proof path to get value from GRB. It's there for when you want something more trustworthy than *"seems fixed."*

## Before You Start

1. **Install Godot 4.5 or later.** GRB relies on Godot's `Logger` API, which was added in Godot 4.5.
2. **Create a Godot project** (or open one you already have) and save it somewhere easy to find.
3. **Open that project folder in your coding agent's editor** (e.g. Cursor, or the editor your Claude Code / Codex / Antigravity setup uses). It should be the folder that contains `project.godot`.
4. **Know where your Godot executable is.** GRB needs that path later as `GODOT_PATH` so your coding agent can launch your game.

## Quick Start: Connect Cursor to Your Game

> The setup below is for **Cursor**. If you're using **Claude Code**, **Codex**, **Antigravity**, or another agent client, see [`mcp/README.md`](mcp/README.md) for client-specific instructions. The Godot-side addon install (Step 1) is the same for every client.

### Option A — Let Cursor set it up for you (easiest)

1. In **Cursor Agent mode**, paste this prompt:

   > Set up the Godot Runtime Bridge (GRB) for this project. Install the addon if missing, create .cursor/mcp.json with the GRB MCP server (args: path to godot-runtime-bridge/mcp/index.js), add GODOT_PATH to env with the path to my Godot executable — search common locations or ask me. Run npm install in the mcp folder if needed. Tell me when done.

2. Go to **Cursor Settings → Tools & MCP** and toggle **godot-runtime-bridge** on. *(This toggle is easy to miss — nothing works until it's on.)*
3. In chat: *"Connect to Godot via the GRB bridge and confirm once connected."*

That's it. Skip ahead to **[Things to Say to Your Coding Agent](#things-to-say-to-your-coding-agent)**.

### Option B — Do it manually (6 steps)

---

#### Step 1 — Install the Addon in Godot

This addon supports **Godot 4.5 and later**.

**From the Asset Library (recommended):**
Open your project in the Godot editor, click the **AssetLib** tab at the top, search for **"Godot Runtime Bridge"**, and install it.

**Manual:**
Download this repo and copy the `addons/godot-runtime-bridge/` folder into your project's `addons/` folder.

Then go to **Project → Project Settings → Plugins** and enable **Godot Runtime Bridge**. When enabled, GRB adds its runtime server automatically — you do **not** need to wire anything by hand.

---

#### Step 2 — Install Node.js (one-time)

Your coding agent talks to your game through a small helper program that needs Node.js.

1. Go to **https://nodejs.org** and download the LTS version
2. Run the installer — defaults are fine
3. Restart your computer if prompted

---

#### Step 3 — Set Up the MCP Helper

Open a terminal (Command Prompt on Windows, Terminal on Mac) and run:

```bash
git clone https://github.com/Aesthetic-Engine/godot-runtime-bridge.git
cd godot-runtime-bridge/mcp
npm install
```

This downloads the helper and installs its dependencies. You only need to do this once.

---

#### Step 4 — Tell Cursor Where Godot Lives

Create a file called **`mcp.json`** inside the `.cursor` folder in your project (create the folder if it doesn't exist). Paste this in, replacing the paths with your actual locations:

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

- **`args`** — where you cloned GRB
- **`GODOT_PATH`** — path to your Godot executable (required for `grb_launch`)

On Windows, forward slashes are the easiest in JSON paths (e.g. `C:/Tools/Godot/Godot_v4.6-stable_win64.exe`).

> **On Windows:** if you have both `Godot_v4.x-stable_win64.exe` and `Godot_v4.x-stable_win64_console.exe`, GRB automatically prefers the `_console` one so launch logs stay visible. You don't have to do anything.
>
> *(Testing an exported game instead of editor runs? Advanced: set `GDRB_EXE` in `env` to your exported binary. Otherwise ignore this.)*

If you'd rather not hand-edit this file, paste the JSON block above into Cursor Agent chat and ask it to create `.cursor/mcp.json` for you.

---

#### Step 5 — Enable the Server in Cursor ⚠️

**Easy to miss — nothing will work until you do it.**

1. Open Cursor
2. Go to **Settings → Tools & MCP**
3. Under **Installed MCP Servers**, find **godot-runtime-bridge**
4. Click the toggle to turn it **ON**

---

#### Step 6 — Direct Your Agent

You're ready. See **[Things to Say to Your Coding Agent](#things-to-say-to-your-coding-agent)** above for example prompts.

See [`mcp/README.md`](mcp/README.md) for Claude Code setup (and other agent clients), advanced configuration, and the full list of available AI tools.

## If Something Doesn't Work

- **GRB tools don't appear in Cursor** → Check Step 5 (toggle in **Settings → Tools & MCP**). Also check **godot-runtime-bridge → Logs** there for a startup message with hints.
- **Cursor can't launch Godot** → Re-check `GODOT_PATH` in `.cursor/mcp.json`. Use forward slashes on Windows.
- **Game launches but nothing seems to happen** → Is the window minimized? Godot throttles hard when minimized. See [Background Testing](#background-testing) below.
- **Still stuck** → Paste the setup steps into Cursor Agent chat and ask it to help troubleshoot your config.

## Optional: Prove Your Game Actually Works (GRB 2.0)

GRB 2.0 adds a **proof workflow**: a reproducible way to run your game, collect evidence, and get a report that distinguishes what was verified by automation from what still needs you to look at it.

A few plain-English terms first:

- **Mission** — a short predefined script GRB runs against your game. For example, `smoke_boot` launches the game, waits, takes screenshots, and checks for errors. Missions don't require changes to your game code.
- **Proof run** — GRB executing a mission and writing a bundle of evidence (screenshots, logs, a summary) into `grb_reports/` in your project.
- **W / R / E** — three honest levels of what was actually shown:
  - **W** — *did the game launch and connect cleanly?* (automation can answer this)
  - **R** — *do we have runtime evidence like screenshots and state?* (automation can collect, but can't judge correctness)
  - **E** — *does it actually feel right?* (only a human can answer this)

GRB reports never claim **E** on your behalf.

### How to Run a Proof Mission

**The easy way:** in your coding agent's chat, say *"Run the GRB smoke_boot proof mission on my project and show me the summary."* Your agent already knows how.

**The manual way (CLI):**

> **First time seeing these paths?** Replace `C:\path\to\grb-main` with wherever you cloned this repo, and `C:\path\to\YourGodotProject` with your game's folder. You can also set the `GODOT_EXE` environment variable instead of passing `--exe` every time.

One-time: initialize your project. This creates a starter contract of config files.

```bash
node C:\path\to\grb-main\cli\grb.mjs init --project C:\path\to\YourGodotProject
```

Review and customize the generated files:

```text
AGENTS.md
grb.project.yaml
grb/proof_policy.yaml
grb/mission_authoring.md
grb/runtime_proof_hooks.md
grb/regression_workflow.md
grb/missions/smoke_boot.yaml
grb/gotchas.md
```

Then run the starter proof mission:

```bash
node C:\path\to\grb-main\cli\grb.mjs mission run smoke_boot --project C:\path\to\YourGodotProject --exe C:\path\to\Godot_v4.5_or_later_console.exe
```

### What You'll Get Back

A proof bundle under your project:

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

**Start with `summary.md`.** It includes a first-run verdict:

- what was proven by automation
- what was not proven by automation
- what needs human review
- any blocked reason
- the next recommended step

Use `run.json` when another tool needs the same information in machine-readable form.

### Create Your Second Mission

After `smoke_boot` passes, the next normal step is to create one small project-specific mission for a real surface: a pause menu, inventory panel, title-to-gameplay transition, HUD state, or another feature you care about.

Scaffold a starter mission:

```bash
node C:\path\to\grb-main\cli\grb.mjs mission scaffold pause_menu --project C:\path\to\YourGodotProject
```

This creates:

```text
grb/missions/pause_menu.yaml
```

The scaffold command does not overwrite an existing mission file.

You can choose a small starter pattern:

- `--pattern transition`: use for title -> gameplay, menu -> panel, screen/state change, or any bounded before/after transition.
- `--pattern toggle`: use for open/close or hidden/visible UI surfaces like pause menu, inventory, map, or settings.
- `--pattern state_check`: use when a HUD label, score/counter, selected mode, weapon, or runtime-readable property should change and visible UI should match it.
- omit `--pattern` or use `--pattern default`: use when your mission does not clearly fit one of the named patterns yet.

Runnable examples in this repo: `transition` -> `examples/grb2-proving-ground/grb/missions/scene_transition.yaml`, `toggle` -> `examples/grb2-proving-ground/grb/missions/toggle_panel.yaml`, `state_check` -> `examples/grb2-proving-ground/grb/missions/hud_state_check.yaml`.

Examples:

```bash
node C:\path\to\grb-main\cli\grb.mjs mission scaffold title_to_gameplay --project C:\path\to\YourGodotProject --pattern transition
node C:\path\to\grb-main\cli\grb.mjs mission scaffold inventory_panel --project C:\path\to\YourGodotProject --pattern toggle
node C:\path\to\grb-main\cli\grb.mjs mission scaffold hud_counter --project C:\path\to\YourGodotProject --pattern state_check
```

Customize these first:

- `goal`: the exact behavior or surface the mission is meant to prove
- the placeholder interaction step: for example `press_button`, `click`, or `key`
- for `state_check`, the TODO runtime state reads: use one `call_method` or `get_property` source
- `human_handoff`: what screenshot/report a reviewer should inspect next

Use `grb/mission_authoring.md` in your project for short examples of panel toggles, transitions, and HUD/runtime state checks. It is created by `grb init`.

If the mission needs a stable runtime value, use `grb/runtime_proof_hooks.md` for guidance on adding small, safe project helper methods for `call_method` or choosing a clear `get_property` read.

Then run it:

```bash
node C:\path\to\grb-main\cli\grb.mjs mission run pause_menu --project C:\path\to\YourGodotProject --exe C:\path\to\Godot_v4.5_or_later_console.exe
```

The scaffold gives you a bounded proof surface. It does not magically know whether your UI is correct; it captures before/after evidence and asks for the remaining human judgment explicitly.

After a small mission passes, read `grb/regression_workflow.md` before treating the run as a baseline candidate. It explains the minimum honesty bar and how to use compare without pretending the baseline is magical truth.

### Current Limits (Honest)

- R-tier screenshots are evidence, not automatic visual validation.
- E-tier is never claimed by automation.
- Some copied projects need to be opened once in the Godot editor before `smoke_boot` can reach the ready state.
- The CLI is still invoked as `node cli/grb.mjs`; packaging and PATH polish are intentionally out of scope for this slice.
- The generated scaffold is a starter contract. Customize project-specific expectations before asking agents to claim higher proof.

## Optional: Compare Runs Over Time

For project-local guidance, start with `grb/regression_workflow.md` after your first small mission passes.

After a proof run passes and its `summary.md` looks trustworthy, that run becomes a **baseline candidate** — a prior passing bundle you intentionally use as the reference for the next run. A baseline is not magic truth; it's a known-good snapshot.

Comparison is useful when you want to answer: *"Did this new run change versus the baseline, and does that change look like a possible regression?"*

There are two compare flows.

**Run-and-compare** — run a fresh mission and compare it to the latest previous passing run of the same mission:

```bash
node cli/grb.mjs mission run smoke_boot --project C:\path\to\YourGodotProject --exe C:\path\to\Godot_v4.5_or_later_console.exe --compare-to latest
```

Use this once you already have at least one passing run for that mission.

**Bundle-to-bundle compare** — compare two known proof bundles directly:

```bash
node cli/grb.mjs compare C:\path\to\baseline-run C:\path\to\candidate-run
```

Use this when you want to choose the baseline explicitly.

If no trustworthy baseline exists, comparison is blocked rather than guessed. Create a passing baseline run first, or pass an explicit baseline bundle.

Possible outcomes:

- `matched` — compared artifacts matched; still inspect the summary before claiming user-facing correctness.
- `difference_detected` — something changed; decide whether it was intended.
- `regression_suspected` — the change conflicts with the mission expectation and should be treated as a suspected regression until reviewed.
- `blocked` — comparison did not run because baseline selection or bundle loading was not trustworthy.
- `human_review_required` — automation found evidence that needs judgment.

Comparison output is written into the candidate bundle under `comparison/`, and the candidate `summary.md` gets a comparison section. Use `comparison/comparison.md` as the decision aid: it explains what the result supports, what it does not prove, and what human review remains.

`--compare-to latest` resolves to the newest previous passing run with the same `mission_id`. The candidate run is never eligible as its own baseline, and blocked/corrupt/mismatched automatic candidates are rejected with reasons in `comparison/comparison.md`.

## Background Testing

By default (`GDRB_INPUT_MODE=synthetic`), input commands inject Godot `InputEvent` objects without touching the OS cursor. In this mode, real mouse and keyboard events from your hardware are **blocked from reaching game nodes entirely** — the bridge intercepts them at the viewport level so only GRB-injected events get through. Your mouse and keyboard remain yours.

If you need OS-level input (rare edge cases), set `GDRB_INPUT_MODE=os`.

For projects configured with fullscreen display settings, set `GDRB_FORCE_WINDOWED=1` to override the project's window mode at startup.

**Important: do not minimize the game window.** Godot drastically throttles processing when its window is minimized to the taskbar, which will slow or break tests. Covering the game window with other applications is perfectly fine — only minimizing causes throttling. For best results, leave the game window open somewhere on screen (behind other windows is OK) while you work.

## Security

The bridge is designed with security-first defaults:

- **Off by default** — does nothing without activation env vars
- **Localhost only** — binds to `127.0.0.1`, never exposed to network
- **Random port** — OS-assigned by default, prevents predictable port attacks
- **Token auth** — every command requires a valid token
- **Capability tiers** — commands grouped by risk (observe/input/control/danger)
- **eval disabled by default** — requires two explicit opt-ins

See [SECURITY.md](SECURITY.md) for the full threat model and recommendations.

## Reference

> You generally don't need to read this section unless you're customizing GRB or writing your own missions.

### Commands

See [PROTOCOL.md](PROTOCOL.md) for the complete command reference.

| Tier | Commands |
|------|----------|
| 0 (observe) | ping, auth_info, capabilities, screenshot, scene_tree, get_property, runtime_info, get_errors, wait_for, audio_state, network_state, grb_performance, find_nodes |
| 1 (input) | click, key, press_button, drag, scroll, gesture, gamepad |
| 2 (control) | set_property, call_method, quit, run_custom_command |
| 3 (danger) | eval |

`run_custom_command` is optional. If you want project-specific helper commands, open the GRB dock in the Godot editor and use the **Enable GRBCommands** button. Then register callables in your game and invoke them through `grb_run_custom_command`.

### Environment Variables

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

### Production Builds

The server is completely inert without activation environment variables. No TCP server, no port, no overhead. Safe to ship in production builds without removing the addon.

## For Contributors

### Release Verification

From the `mcp/` folder:

```bash
npm run verify:versions
npm run verify:grb -- --godot-exe "/path/to/godot" --project "/path/to/project"
npm run verify:release -- --godot-exe "/path/to/godot" --project "/path/to/project"
```

`verify:grb` performs a release-grade smoke run: launch, `ping`, `auth_info`, `capabilities`, `runtime_info`, `get_errors`, `screenshot`, and clean `quit`. Artifacts are written to `mcp/reports/release-smoke/`.

### GRB 2.0 Proving Ground

A small deterministic Godot project at `examples/grb2-proving-ground/` lets you validate and demo proof workflows without a real game project. It has stable boot, transition, HUD/state, and toggle-panel surfaces.

```bash
node examples/grb2-proving-ground/tools/sync_grb_addon.mjs
Godot_v4.6-stable_win64_console.exe --headless --editor --quit --path examples/grb2-proving-ground
node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run toggle_panel --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run hud_state_check --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
```

A simple compare practice run once a baseline exists:

```bash
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe --compare-to latest
```

The example keeps the canonical addon source under `addons/godot-runtime-bridge`; its local synced addon copy, `.godot/`, and `grb_reports/` are ignored.

## License

MIT — see [LICENSE](LICENSE).
