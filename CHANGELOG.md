# Changelog

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
