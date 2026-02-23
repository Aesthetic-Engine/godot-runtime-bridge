# Agent Mission Pack

**20 automated QA missions for any Godot game.** Run one command, get a markdown report with screenshots and ticketable issue cards.

## 60-Second Quickstart

```bash
# Run all 3 starter missions (takes ~50 seconds)
node missions/run_mission.mjs --mission starters --exe "C:\Godot\godot_console.exe" --project "C:\MyGame"

# Run a single mission
node missions/run_mission.mjs --mission smoke_test --exe "..." --project "..."

# Run ALL 20 missions
node missions/run_mission.mjs --mission all --exe "..." --project "..."

# List available missions
node missions/run_mission.mjs --list
```

Reports are saved to `missions/reports/<mission_id>/` with markdown + screenshots. **`reports/OVERALL.md`** is the high-level summary (missions, pass/fail, links to detail reports).

## Starter Missions (1-minute wins)

These three missions almost always produce something useful immediately:

| # | Mission | What it does | Time |
|---|---------|-------------|------|
| 1 | `smoke_test` | Launches game, screenshots title, clicks first button, verifies screen changed | ~15s |
| 2 | `ui_legibility` | Captures 3 screenshots at key screens for text/contrast/clipping review | ~20s |
| 3 | `input_sanity` | Presses Accept, Pause, clicks center — verifies inputs respond | ~15s |

## All 20 Missions

### Flow + Softlock Detectors
| # | ID | Name | Tier | Time |
|---|-----|------|------|------|
| 4 | `menu_loop` | Menu Loop Integrity | 1 | 20s |
| 5 | `back_button_torture` | Back Button Torture Test | 1 | 15s |
| 6 | `restart_cycle` | Repeated Start/Stop (3 cycles) | 1 | 30s |
| 7 | `pause_resume` | Pause/Resume Stability | 1 | 15s |

### Visual + Rendering Checks
| # | ID | Name | Tier | Time |
|---|-----|------|------|------|
| 8 | `flicker_stability` | Flicker/CRT Stability Watch | 0 | 10s |
| 9 | `stuck_frame` | Stuck Frame Detector | 0 | 10s |
| 19 | `resolution_check` | Resolution/Viewport Info | 0 | 10s |

### Interaction Discovery
| # | ID | Name | Tier | Time |
|---|-----|------|------|------|
| 10 | `interactable_hunt` | Grid click to find interactive regions | 1 | 20s |
| 11 | `traversal_loop` | 5 navigation clicks to test flow | 1 | 25s |
| 12 | `inventory_stress` | Open/close UI panel 10x rapidly | 1 | 15s |

### Error Handling + Edge Cases
| # | ID | Name | Tier | Time |
|---|-----|------|------|------|
| 13 | `input_spam` | Mash keys and clicks for 5 seconds | 1 | 15s |
| 14 | `long_idle` | Idle 30s, check for CPU spikes/loops | 0 | 40s |

### Ticket Factory Missions
| # | ID | Name | Tier | Time |
|---|-----|------|------|------|
| 15 | `node_tree_snapshot` | Scene tree diff: menu vs in-game | 1 | 15s |
| 16 | `keyboard_nav` | Keyboard-only navigation (Tab/Enter) | 1 | 15s |
| 17 | `wait_for_validation` | Verify state transitions fire correctly | 1 | 15s |
| 18 | `crash_sentinel` | Edge inputs + crash detection | 1 | 15s |

### Comprehensive
| # | ID | Name | Tier | Time |
|---|-----|------|------|------|
| 20 | `full_sweep` | All core checks in one pass | 1 | 60s |

## Flags

| Flag | Description |
|------|-------------|
| `--mission <id\|all\|starters>` | Mission to run |
| `--exe <path>` | Path to Godot executable |
| `--project <path>` | Path to project folder |
| `--mode background` | Windowed, synthetic input (default) |
| `--mode watch` | Foreground, OS cursor, visible |
| `--reset` | Reset to home screen before each mission |
| `--no-reset` | Disable auto-reset |
| `--list` | List available missions |

## Report Format

Every mission produces a markdown report with:

- **Run metadata** (engine version, FPS, scene, duration)
- **Issue cards** (severity, title, detail — paste directly into Jira/GitHub Issues)
- **Actions taken** (every step logged)
- **Screenshots** (saved as PNGs alongside the report)
- **Coverage summary** (actions, screenshots, buttons discovered, tree deltas)

## Writing Custom Missions

Add entries to `missions.json` following the existing format. Available step actions:

| Action | Description | Tier |
|--------|-------------|------|
| `screenshot` | Capture viewport | 0 |
| `scene_tree` | Capture node tree | 0 |
| `runtime_info` | Engine/FPS/scene info | 0 |
| `wait` | Sleep N ms | - |
| `click` | Click at x,y | 1 |
| `key` | Send action or keycode | 1 |
| `press_button` | Find and press a button by name | 1 |
| `find_buttons` | Discover all buttons in scene | 0 |
| `click_first_button` | Press first discovered button | 1 |
| `grid_click` | Click a grid of screen points | 1 |
| `rapid_input` | Sequence of fast inputs | 1 |
| `screenshot_diff` | Compare two screenshots | - |
| `scene_tree_diff` | Compare two scene trees | - |
| `check_runtime` | Assert minimum FPS | 0 |
| `get_property` | Read a node property | 0 |
| `set_property` | Write a node property | 2 |
| `call_method` | Call a node method | 2 |

## Requirements

- **Godot Runtime Bridge addon** installed in your project
- **Node.js** 18+
- The game must be launchable via console Godot exe
- Missions use Tier 0-1 by default (no state manipulation)
