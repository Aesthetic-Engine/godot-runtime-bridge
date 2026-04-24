# Changelog

## 2.0.0 — 2026-04-24

First GRB 2.0 release. Version surfaces across `mcp/package.json`,
`mcp/package-lock.json`, `addons/godot-runtime-bridge/plugin.cfg`,
`addons/godot-runtime-bridge/runtime_bridge/EditorDock.gd`, and the MCP server
name/startup banner in `mcp/index.js` now agree on `2.0.0`. The previously
staged `2.0.0-rc.0` identity was not published; this entry replaces it and
covers the same repaired surfaces verified by the final release-gate smoke.

This release covers the full-repo GRB 2.0 proof workflow. Addon/archive/export
packaging remains addon-oriented; the GRB 2.0 CLI, templates, proving ground,
and product-shape verification still require a full repo clone.

### Added

- **GRB 2.0 proof CLI** — Full-repo GRB 2.0 proof flows for `init`, `doctor`,
  `mission scaffold`, `mission run <mission_id>`, and `compare`.
- **Project contract scaffolds** — GRB 2.0 templates for `AGENTS.md`,
  `grb.project.yaml`, proof policy, missions, recipes, gotchas, mission
  authoring guidance, runtime proof hooks, and regression workflow guidance.
- **Mission scaffold patterns** — `default`, `transition`, `toggle`, and
  `state_check` starter patterns with honest TODOs and references to runnable
  proving-ground examples.
- **Proof bundles** — Project-local proof bundles under `grb_reports/<run-id>/`
  with `summary.md`, `run.json`, evidence references, W/R/E proof reporting,
  blocked-proof reporting, primary review artifacts, and human handoff fields.
- **Compare and baseline review** — Bundle-to-bundle compare and
  `--compare-to latest` flows with same-mission baseline selection,
  rejected-baseline explanations, comparison summaries, and trust-boundary
  guidance.
- **GRB 2.0 proving ground** — `examples/grb2-proving-ground/`, a tiny
  deterministic Godot project with `smoke_boot`, `scene_transition`,
  `toggle_panel`, and `hud_state_check` missions.
- **Product-shape verification** — `tools/verify_grb2_product_shape.mjs` checks
  high-value GRB 2.0 proof/onboarding summary surfaces without launching Godot.
- **Opt-in Cursor rules install/refresh** — the Runtime Bridge dock exposes
  an explicit "Install Cursor rules" / "Refresh Cursor rules" action so
  Cursor users can still write `res://.cursor/rules/grb.mdc` on demand. The
  status label distinguishes `absent`, `up to date`, and `differs from the
  shipped rules` without ever overwriting silently.
- **Honest Cursor-rules staleness detection** — staleness is now determined
  by exact comparison against the GRB-shipped rules content instead of the
  prior single-keyword (`grb_stop`) heuristic.

### Changed

- **Agent-agnostic addon default behavior** — enabling the GRB plugin no
  longer silently writes `res://.cursor/rules/grb.mdc` into the user's
  project. `runtime_bridge_plugin.gd` only wires the `GRBServer` autoload
  and the Runtime Bridge dock now.
- **Archive/channel truth** — `.gitattributes` now states explicitly that
  archive exports ship the addon plus the legacy built-in mission pack and
  deliberately omit the GRB 2.0 CLI, MCP helper, templates, proving ground,
  and product-shape tooling. The README channel section and
  `docs/grb2-release-candidate-readiness.md` were updated to match.
- **Release identity** — All authoritative GRB version surfaces bumped from
  `1.0.6` to `2.0.0`. The product-shape check's startup-banner regex in
  `mcp/check_versions.mjs` now accepts pre-release suffixes as well as the
  final release identity.
- **`verify:release` aggregate** — The `mcp/` npm script now runs
  `verify:grb2:shape` in addition to the existing versions+live-smoke chain.
  The legacy versions+live-smoke-only behavior is preserved under a new
  `verify:release:live` script.
- **README / mcp README / release-candidate readiness doc** — Release
  verification section updated to reflect the new aggregate.
- **Placeholder vocabulary** — README and `cli/grb.mjs` help text replaced the
  internal `grb-main` token with the neutral `<grb-repo>` placeholder.
- **Mission runner output directory** — `missions/run_mission.mjs` accepts
  `--output-dir` while preserving the existing `missions/reports` default.
- **Mission tier defaults** — Missing `tier_required` values default to `1`
  before mission launch and reporting.
- **Release-surface docs** — Protocol, security, MCP, and version-check docs
  synced with the current shipped command/tool surface.
- **Release smoke workflow** — GRB 2.0 product-shape verification is wired into
  release smoke so launch-critical CLI/template/tooling surfaces do not drift.
- **Readiness handoff** — Compact GRB 2.0 readiness doc states what checks
  support release-candidate confidence and what they do not prove.

### Removed

- **Stale top-level zip** — `godot-runtime-bridge-v0.1.5.zip` deleted from the
  repo root; it was two major releases stale and unrelated to the 2.0 story.
- **Stale ship-readiness doc** — `missions/SHIP_READINESS_0.1.6.md` removed;
  its filename and body disagreed on the covered version and neither matched
  the current release.

## 1.0.6 - 2026-03-28

### Changed

- **Windows console executable preference** - `grb_launch` and `grb_reset` now prefer a companion `*_console.exe` when you pass a Windows Godot editor executable or set `GODOT_PATH`, improving launch diagnostics without changing project setup.
- **Launcher env support** - Added documented support for `GODOT_CONSOLE_PATH` as an explicit MCP-side override for Windows console builds.
- **Launch messaging/docs refresh** - Launch results now report which executable source was used, and the README / MCP README now explain the Windows console-exe behavior.

## 1.0.5 — 2026-03-24

### Added

- **Release verification scripts** — Added `mcp/check_versions.mjs`, `mcp/verify_grb_release.mjs`, and `mcp/verify_release.mjs` plus matching npm scripts for release hardening.
- **Smoke CI workflow** — Added `.github/workflows/grb-release-smoke.yml` to verify version sync and run a minimal live GRB smoke test on GitHub Actions.
- **Editor dock opt-in GRBCommands setup** — The dock now shows GRBCommands status, offers one-click enablement, and includes a copyable custom-command snippet.
- **Screenshot cleanup control** — The dock now includes a `Clear Screenshots` action alongside the screenshot folder opener.

### Changed

- **Version bumped** to `1.0.5` across `plugin.cfg`, `mcp/package.json`, `mcp/index.js`, and the editor dock banner.
- **MCP launcher hardening** — Clearer stale-session errors, shared shutdown handling for `grb_launch` / `grb_quit` / `grb_reset`, and launch-failure artifact capture.
- **Quiet force-windowed behavior** — Removed routine warning spam for normal `GDRB_FORCE_WINDOWED` launches.
- **Rules/docs refresh** — Runtime bridge rules now describe the current MCP tool surface and recommend `grb_reset` for stale sessions.

### Fixed

- **Single-client reconnect bug** — `DebugServer.gd` now polls the active TCP stream before deciding whether a new connection should be rejected, preventing false connection resets during fast sequential GRB commands.

## 1.0.4 — 2026-03-01

### Security

- **call_method denylist** — Block dangerous method names (execute, load, save, shell, create_process, etc.) to prevent arbitrary code execution via node proxies. Returns `forbidden` for blocked methods.
- **set_property denylist** — Block dangerous properties (`script`) to prevent script injection.
- **eval pattern filter** — Reject expressions containing `OS.`, `Engine.`, `FileAccess.`, `load(`, `save(`, etc. Returns `forbidden` for disallowed patterns.
- **Read buffer limits** — Cap total read buffer at 1 MB and max line length at 64 KB to prevent memory exhaustion. Disconnects client on violation.
- **Connection hijacking prevention** — Reject new connections when a client is already connected; no longer drop the existing client.
- **Screenshot rate limit** — Max 10 screenshots per second to prevent DoS.
- **Token required for ping/auth_info** — All commands now require valid token; removed token exemption for ping and auth_info.

### Changed

- Version bumped to 1.0.4 across plugin.cfg, package.json, and MCP banner.
- PROTOCOL.md, SECURITY.md updated to document new protections and error codes.

## 1.0.3 — 2026-03-01

### Fixed
- **stderr buffer overflow crash** — `stderrBuf` grew unboundedly during long Godot sessions, eventually hitting Node.js's max string length (~512MB) and crashing with `RangeError: Invalid string length`. Buffer is now capped at 10KB.

### Changed
- **Version banner** updated from v1.0.1 to match actual version.
- **Version bumped** to 1.0.3 across `plugin.cfg`, `package.json`, banner, and CHANGELOG.

## 1.0.2 — 2026-03-01

### Fixed
- **stderr capture in `grb_launch`** — Godot's stderr was silently discarded (`child.stderr.on("data", () => {})`), hiding GDScript parse errors that caused blank screens with zero diagnostics. stderr is now buffered and included in the error message when Godot exits before the bridge is ready.

### Changed
- **EditorDock layout fix** — "Fix bugs automatically" toggle moved from inside the mission list section to the heading row, preventing it from rendering below the mission grid where it could be missed.
- **Version bumped** to 1.0.2 across `plugin.cfg`, `package.json`, and CHANGELOG.

## 1.0.1 — 2026-02-28

### Added
- **Screenshot saving to disk** — `grb_screenshot` now saves each captured PNG to `<project>/debug/screenshots/` with an ISO timestamp filename. The directory is created automatically with a `.gdignore` file to prevent Godot from importing screenshot PNGs. This completes the "Clear Screenshots" button in the EditorDock, which already pointed at this directory but had nothing to clear.
- **Auto-generated Cursor rules** — the editor plugin writes `.cursor/rules/grb.mdc` on first load, giving AI agents the GRB verification loop, tool inventory, and anti-drift directives out of the box.

### Changed
- **Mission prompt wording** — EditorDock prompts now reference "Run the GRB verification loop" instead of verbose launch/screenshot instructions, matching the auto-generated rule.
- **EditorDock screenshots** — shows `debug/screenshots/` path with "Open Screenshot Folder" button; removed Clear Screenshots button.
- **Version bumped** to 1.0.1 across `plugin.cfg`, `package.json`, and MCP server banner.

## 1.0.0 — 2026-02-25

**First stable release.** GRB is production-ready for agentic game development and runtime automation. AI agents can launch your game, observe it, control it, run QA missions, and iterate on fixes — all without opening the editor.

### Highlights

- **Full command set** — 25+ commands across 4 tiers (Observe, Input, Control, Danger). Screenshot capture, scene tree inspection, property get/set, synthetic input (mouse, keyboard, gamepad, gestures), custom commands, eval.
- **MCP bridge** — Cursor and Claude Code connect via `godot-runtime-bridge` MCP server. `grb_launch` auto-discovers port and token. All commands exposed as tools.
- **QA mission pack** — 25+ game-agnostic missions (smoke test, UI bounds, menu navigation, perf profiling, audio check, error sweep). Perceptual screenshot diff, baseline+compare workflow, ticket-ready markdown reports.
- **Editor dock — click-to-copy prompts** — Missions and rules are presented as buttons; click one to copy a ready-to-paste prompt for Cursor Agent chat. "Fix bugs automatically" toggle switches between auto-fix and report-only modes. Testing guidance rule copyable to `.cursor/rules`.
- **Security-first** — Localhost only, random port, bearer token auth, capability tiers, eval off by default.
- **Zero overhead when inactive** — Safe to ship in production builds.

### Added (1.0.0)

- **`gesture` command (Tier 1)** — inject pinch or swipe gestures.
- **`audio_state` command (Tier 0)** — bus volumes, mute, mix rate.
- **`network_state` command (Tier 0)** — multiplayer/network state placeholder.
- **`grb_performance` command (Tier 0)** — FPS, draw calls, memory, profiling.
- **`run_custom_command` command (Tier 2)** — invoke game-registered commands via `GRBCommands` autoload.
- **`GRBCommands.gd`** — optional autoload for custom command registration.
- **`find_nodes` command (Tier 0)** — search scene tree by name, type, group.
- **`gamepad` command (Tier 1)** — button, axis, vibration.
- **Expanded mission library** — 5 new missions: `perf_profile`, `button_inventory`, `audio_check`, `rapid_screenshot_burst`, `error_sweep`.
- **Visual regression workflow** — formalized in `missions/README.md`.
- **GUT integration docs** — unit test runner integration documented.
- **CI/CD documentation** — `docs/ci.md` with xvfb GitHub Actions examples.

### Changed (1.0.0)

- **Editor dock redesigned for vibe coders** — removed old checkbox mission list, run button, progress bar, thread runner, report finder, thumbnail gallery, and "Show technical command names" toggle. Replaced with a streamlined prompt-copy UI.
- **Mission buttons** — each mission is a clickable button in a 3-column grid. Click copies a ready-to-paste prompt for Cursor Agent chat.
- **"Fix bugs automatically" toggle** — defaults to OFF (report-only). When ON, prompts tell Cursor to fix bugs on the fly. When OFF, prompts tell Cursor to produce a `.md` bug report without fixing anything.
- **"Run ALL missions" button** — copies a single prompt to run every mission sequentially.
- **Quickstart simplified** — replaced complex power-level / port / input-mode UI with a single copy-paste setup prompt for Cursor Agent mode.
- **Testing guidance** — replaced screenshot verification and loop prevention toggles with a copyable Cursor rule that agents can use for proper testing behavior.

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
