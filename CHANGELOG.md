# Changelog

## 0.1.5 — 2026-02-24

### Added
- **`quit` command (Tier 2)** — cleanly exits the running game via `get_tree().quit()` (deferred). Enables the mission runner to close the game without killing the OS process.
- **Mission runner: `check_errors` step** — polls `get_errors` at a specific point in a mission and files issues for any engine errors found since the last check.
- **Mission runner: `assert_property` step** — asserts that a previously fetched property (`get_property` with a `label`) equals an expected value; files an issue on mismatch.
- **Mission runner: `assert_screen` / `save_reference` steps** — compare a live screenshot against a saved reference PNG on disk. `save_reference` captures and saves to `missions/references/` for future assertions.
- **Mission runner: startup health check** — after connecting, auto-queries `get_errors` for boot-time errors and aborts with exit code 2 if any are found. Use `--allow-boot-errors` to run missions anyway.
- **Mission runner: post-mission error sweep** — after each mission, automatically queries `get_errors` for errors that fired during the run. Results appear in the report's Engine Errors section.
- **Mission runner: Godot stderr capture** — stderr from the Godot process is buffered and included in reports under a "Godot Stderr" section.
- **`perceptual_diff.mjs`: `compareToReference` export** — compares a base64 PNG against a reference file on disk; returns `{ matches, ratio, detail }`.
- **Per-step diff thresholds** — `screenshot_diff` steps now accept `block_thresh` and `change_thresh` fields that override CLI-level defaults for that specific comparison.
- **`--capture-refs` and `--allow-boot-errors` CLI flags.**
- **MCP startup notice** — on launch, the MCP server logs a message to stderr reminding users to enable the server in Cursor → Settings → Tools & MCP if tools are not appearing.

### Changed
- **Perceptual diff defaults tightened** — `blockThresh` 8 → 3, `changeThresh` 0.03 → 0.01. Catches more subtle visual regressions by default.
- **Home screen detection thresholds lowered** — recognizes a home screen with ≥2 buttons + ≥1 keyword match (was ≥3 + ≥2), and ≥4 total buttons (was ≥5).
- **`resetToHome` scene tree depth** — `max_depth` increased from 6 to 12.
- **Starter missions updated** — `smoke_test`, `ui_legibility`, `input_sanity`, `menu_loop` now use `press_button` with `StartGameBtn` + `assert_property` on `GameState.game_started`; require Tier 2.
- **Report Coverage Summary** extended with engine error and warning counts.
- **README: Cursor enable step** — setup instructions now explicitly call out the required Settings → Tools & MCP → enable toggle.

## 0.1.4 — 2026-02-24

- **Windowed launch via `override.cfg`** — MCP server writes a temporary `override.cfg` before spawning Godot, forcing `window/size/mode=0` at engine level; file is auto-deleted on exit
- **Configurable test window size** — `grb_launch` accepts `window_size` param (default `"960x540"`, or any `"WxH"`, or `"minimized"`); viewport resolution is unaffected
- **`get_errors` MCP tool** — wired up in the MCP server for error/warning log polling via `since_index`
- **DebugServer windowed enforcement** — reads `GDRB_WINDOW_WIDTH`/`GDRB_WINDOW_HEIGHT` env vars for size-aware safety-net enforcement

## 0.1.3 — 2026-02-24

- **Agent Settings** section in EditorDock: screenshot verification toggle, loop prevention toggle, and clear screenshots button
- Screenshot verification writes a marker file (`debug/screenshots/.verify_enabled`) that AI agent rules can check to know when to capture and verify screenshots after visual changes
- Loop prevention toggle (`debug/screenshots/.loop_prevention`) caps failed retry attempts at 3 before the agent asks for guidance
- Clear Screenshots button deletes all `.png` files from the screenshots directory

## 0.1.2 — 2026-02-24

- **Repo restructured** for Godot Asset Library conventions: addon content now lives under `addons/godot-runtime-bridge/`; `.gitattributes` ensures AssetLib downloads only include the addon folder
- **Error/warning capture** via new `GRBLogger` — engine errors, warnings, and script errors are captured into a thread-safe ring buffer (capped at 500 entries)
- **New `get_errors` command** (tier 0) — retrieve captured errors/warnings with incremental polling via `since_index`
- **`runtime_info` now reports** `error_count` and `warning_count`
- **`press_button` fix** — supports `toggle_mode` buttons; calls connected callables directly instead of `emit_signal("pressed")` to work around SubViewport signal dispatch quirks
- **Input isolation refinement** — synthetic mode now scans for new input-processing nodes every frame for the first 60 frames, then every 30th frame, to catch dynamically added nodes

## 0.1.1 — 2026-02-23

- Synthetic input isolation: GRB-injected events are tagged with `_grb` meta; real device input is blocked in synthetic mode so the game only responds to bridge commands
- Simplified windowed mode enforcement to a single frame check
- Read buffer size limit (10 MB) to prevent unbounded memory growth from malformed clients
- Drag command bounds-checks array length before accessing indices
- EditorDock launch command uses `GODOT_DEBUG_SERVER=1` instead of `GDRB_TOKEN=auto` for secure auto-generation

## 0.1.0 — 2026-02-20

Initial public release.

- TCP debug server with grb/1 wire protocol
- 16 commands across 4 capability tiers (Observe, Input, Control, Danger)
- Bearer token authentication on every command
- Localhost-only, random port by default
- Synthetic input mode (background testing without OS cursor movement)
- Thread-safe producer-consumer architecture
- Editor bottom panel with launch configuration and command reference
- Zero overhead when inactive — safe to ship in production
- 20 game-agnostic QA missions with CLI runner and perceptual screenshot diff
