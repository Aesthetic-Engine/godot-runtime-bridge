# Legacy Built-In Mission Pack

This folder contains the older built-in GRB mission pack:

- `missions/missions.json`
- `missions/run_mission.mjs`

It still has value for generic runtime QA passes, but it is **not** the same
thing as the newer GRB 2.0 project-local proof workflow.

If you want the GRB 2.0 path with `grb init`, project contracts, project-local
missions, proof bundles under `grb_reports/`, and compare/baseline guidance, use
the root `README.md` and `node cli/grb.mjs ...`.

## What This Layer Is

The legacy mission pack is a repo-shipped set of generic runtime missions stored
in `missions/missions.json` and executed by `missions/run_mission.mjs`.

On current `main`, the built-in pack ships **15** generic missions. They cover
things like:

- smoke boot / first interaction
- UI legibility and button discovery
- input sanity and keyboard navigation
- screenshot and scene-tree comparisons
- runtime error sweeps
- performance and audio snapshots

These missions write markdown reports and artifacts under `missions/reports/` by
default, or another folder if you pass `--output-dir`.

## What This Layer Is Not

This legacy mission pack is **not** the GRB 2.0 proof/product path.

It does not create project contracts, project-local mission YAML, or GRB 2.0
proof bundles. Its screenshot/reference helpers are runner-level utilities, not
the same thing as GRB 2.0 baseline-candidate guidance or `grb compare`.

Use this legacy layer when you want a generic built-in runtime pass. Use the
GRB 2.0 CLI when you want project-specific proof work.

## Quick Start

```bash
# List the built-in missions on this branch
node missions/run_mission.mjs --list

# Run one built-in mission
node missions/run_mission.mjs --mission smoke_test --exe "C:\\Godot\\godot_console.exe" --project "C:\\MyGame"

# Run the full built-in pack
node missions/run_mission.mjs --mission all --exe "C:\\Godot\\godot_console.exe" --project "C:\\MyGame"
```

Reports land in:

```text
missions/reports/
  OVERALL.md
  <mission_id>/
    report-*.md
    *.png
```

`OVERALL.md` is the high-level rollup for multi-mission runs.

## Current Built-In Mission IDs

Current `missions/missions.json` mission ids on `main`:

- `smoke_test`
- `ui_legibility`
- `input_sanity`
- `button_inventory`
- `resolution_check`
- `node_tree_snapshot`
- `stuck_frame`
- `flicker_stability`
- `keyboard_nav`
- `input_spam`
- `crash_sentinel`
- `long_idle`
- `perf_profile`
- `audio_check`
- `error_sweep`

Use `--list` for the current branch truth instead of assuming this list stays
static forever.

## Important Current Truths

- `--mission starters` is still supported by the runner, but the built-in pack
  on current `main` does **not** mark any missions with `starter: true`. Use an
  explicit mission id or `--mission all`.
- `--missions-file` lets you run a different mission pack while keeping the same
  runner behavior.
- `--output-dir` lets you move reports/artifacts out of `missions/reports/`
  when another tool needs a different destination.

## Useful Flags

| Flag | Description |
|------|-------------|
| `--mission <id\|all\|starters>` | Mission selection |
| `--exe <path>` | Path to Godot executable |
| `--project <path>` | Path to the Godot project |
| `--list` | Show available missions |
| `--output-dir <path>` | Write reports/artifacts somewhere other than `missions/reports/` |
| `--missions-file <path>` | Run an alternate mission pack JSON file |
| `--mode background` | Background-friendly synthetic input (default) |
| `--mode watch` | Visible foreground run |
| `--reset` / `--no-reset` | Control reset behavior between missions |
| `--capture-refs` | Populate legacy screenshot references for `save_reference` / `assert_screen` flows |
| `--allow-boot-errors` | Continue past boot errors instead of exiting early |

## Writing or Adapting Legacy Missions

Legacy missions are JSON entries consumed by `run_mission.mjs`. The runner
supports generic actions such as:

- evidence capture: `screenshot`, `scene_tree`, `runtime_info`, `check_errors`
- input and interaction: `click`, `key`, `press_button`, `rapid_input`,
  `grid_click`
- comparison helpers: `screenshot_diff`, `scene_tree_diff`, `save_reference`,
  `assert_screen`
- runtime checks: `check_runtime`, `get_property`, `assert_property`
- control-tier steps: `set_property`, `call_method`

There are also older mission-pack-specific helper actions still present in the
runner. If you need to adapt this layer, inspect the current step handlers in
`missions/run_mission.mjs` instead of assuming every action is generic.

## CI Positioning

The legacy mission pack can still be used in CI for broad runtime smoke passes,
especially on projects that want a generic runner without adopting the GRB 2.0
project contract flow.

That is separate from:

- repo-level GRB release smoke under `mcp/`
- project-local GRB 2.0 proof runs via `node cli/grb.mjs mission run ...`

See `docs/ci.md` for the current CI framing.
