# GRB Pro — Production Add-On Features

Production-ready features for the Godot Runtime Bridge. These extend the core open-source GRB into a full QA-in-a-box platform.

---

## 1. QA Teammate Markdown Report Generator

**Usage:** `node run_mission.mjs --mission <id> --exe <path> --project <path> --format qa-teammate`

Produces ticket-ready markdown with:
- **Top 5 Issues by Severity** (Critical → Major → Minor)
- **Reproduction steps** for each issue
- **Annotated screenshots** (paths + base64 when available)
- **Performance section** (FPS, draw calls, node count per step)

Reports are saved to `reports/<mission_id>/report-<timestamp>.md`. Paste directly into Jira or GitHub.

---

## 2. Visual Mission Dashboard (Editor Dock)

**Location:** Godot Editor → Bottom panel → "Runtime Bridge" → Mission Dashboard

- Checkboxes to select missions
- **Run Selected** runs missions via subprocess
- Progress bar during execution
- Screenshot thumbnails from last run

**Requires:** Node.js in PATH, `GODOT_PATH` or `godot4` in PATH. Missions run with `--format qa-teammate` by default.

---

## 3. Recording & Replay System

**Record keys:**
```bash
node recorder.mjs -o recording.json
# Press keys; Ctrl+C to save
```

**Replay** (game must be running with GRB):
```bash
node replay.mjs --port <GRB_PORT> --token <GDRB_TOKEN> recording.json
```

Format: `[{ "t": 0, "action": "key", "key": "ui_accept" }, ...]`  
Mouse clicks require manual JSON or external capture (Node.js cannot capture OS mouse events).

---

## 4. One-Click GitHub Issue Exporter

Every mission report generates a `.github-issue.md` file with:
- Issues formatted for GitHub
- **Base64-embedded screenshots** for true one-click paste
- Copy entire file → paste into new GitHub issue

---

## 5. Historical Regression Tracking

**Storage:** `reports/history.json`

Each run stores: `mission_id`, `issues_count`, `elapsed_sec`, `node_count`, `tree_diff`.

**Deltas** printed after each mission:
- "Last run: 0 issues. This run: 2 issues."
- "Scene tree: +5 nodes (possible leak)."

---

## 6. Headless CI/CD Cloud Runners

**Workflow:** `.github/workflows/grb-ci.yml`

- Runs on push/PR to `main` or `master`
- Uses `xvfb` for headless display (Linux)
- Runs `--mission starters` by default
- Exit 0 = pass, 1 = fail

---

## 7. Custom Command API

**GDScript:**
```gdscript
# In your game
GRBCommands.register("spawn_boss_phase_2", func(): spawn_boss(2))
GRBCommands.register("give_gold", func(amount): player.gold += int(amount))
```

**Bridge command:** `run_custom_command` with `{ "name": "spawn_boss_phase_2", "args": [] }`

---

## 8. Performance & Telemetry Profiling

**Command:** `grb_performance` (Tier 0)

Returns: `fps`, `time_process`, `time_physics_process`, `object_count`, `object_node_count`, `render_draw_calls`, `render_total_objects`, `render_video_mem_used`.

**Mission integration:** Performance captured at mission start/end and in report "Performance" section.

---

## 9. Multi-Touch & Gesture Simulation

**Command:** `gesture` (Tier 1)

```json
{ "type": "pinch", "params": { "center": [160, 100], "scale": 1.5 } }
{ "type": "swipe", "params": { "center": [160, 100], "delta": [50, 0] } }
```

Uses `InputEventMagnifyGesture` and `InputEventPanGesture`.

---

## 10. Audio & Network State Inspection

**Commands:**
- `audio_state` — bus volumes (dB), mute, mix rate
- `network_state` — `{ multiplayer: false }` or server sync state

Both Tier 0 (Observe).

