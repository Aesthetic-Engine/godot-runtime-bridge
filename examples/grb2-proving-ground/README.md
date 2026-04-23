# GRB 2.0 Proving Ground

This is a tiny deterministic Godot project for validating and demoing GRB proof workflows without needing a real game project.

It exists so GRB development has a concrete reference target that is easier to judge than a blank or grey-screen project.

It is not a sample game, showcase, tutorial project, or replacement for testing a real game. It has one scene and one script with stable proof surfaces:

- boot/title screen
- title-to-lab state transition
- visible HUD state labels
- toggleable proof panel
- deterministic screenshots for comparison and human review

The missions use GRB capability tier 2 because they capture runtime-readable state through safe project methods.

## Setup

The canonical GRB addon remains at the repo root under `addons/godot-runtime-bridge`. This example does not commit a duplicate addon copy.

From the GRB repo root, sync the addon into this project:

```bash
node examples/grb2-proving-ground/tools/sync_grb_addon.mjs
```

Then open the project once in Godot so `.godot/` metadata is created:

```bash
Godot_v4.6-stable_win64_console.exe --headless --editor --quit --path examples/grb2-proving-ground
```

The synced `addons/`, `.godot/`, and `grb_reports/` folders are local validation artifacts and are ignored by git.

## Run Missions

From the GRB repo root:

```bash
node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run toggle_panel --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run hud_state_check --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
```

From inside this project:

```bash
node ..\..\cli\grb.mjs mission run smoke_boot --exe C:\path\to\Godot_console.exe
```

Proof bundles land under `grb_reports/<run-id>/`.

## Missions

| Mission | What it proves | Primary artifacts |
|---------|----------------|-------------------|
| `smoke_boot` | GRB can launch the project, connect, capture runtime info, scene tree, title screenshot, and runtime state. | `boot_screen.png`, `boot_state`, `summary.md`, `run.json` |
| `scene_transition` | GRB can trigger a deterministic interaction and capture matching visual/runtime state change. | `title_before.png`, `lab_after.png`, `state_before`, `state_after` |
| `toggle_panel` | GRB can trigger and capture a deterministic before/after UI panel surface. | `panel_closed.png`, `panel_open.png`, `panel_state` |
| `hud_state_check` | GRB can assert one runtime-readable HUD value changed and pair it with before/after screenshots. | `hud_before.png`, `hud_after.png`, `counter_before`, `counter_after`, `state_before`, `state_after` |

## What To Inspect

- `smoke_boot` should show the stable title and HUD labels.
- `scene_transition` should show `STATE: lab`, an incremented counter, and the visible compare banner.
- `toggle_panel` should show `PANEL: open` plus the proof panel text.
- `hud_state_check` should show `COUNTER: 0` before, `COUNTER: 1` after, and runtime values that agree with the HUD.

Screenshots are evidence surfaces, not automatic visual correctness claims. E-tier still requires a human to confirm that the visible behavior is meaningful and acceptable.

## Comparison Example

After one passing `scene_transition` run exists, rerun it with comparison:

```bash
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe --compare-to latest
```

This should select the latest passing `scene_transition` bundle as the baseline, pair `title_before` and `lab_after` screenshots by capture slot, and write comparison output under the candidate bundle's `comparison/` folder.

Comparison can say the deterministic artifacts matched. It still does not claim that the UI is good, fun, or product-correct.

## How To Use This For GRB Work

Use this project when changing GRB proof or comparison behavior and you need a small target with known surfaces. A good quick validation pass is:

1. Run `smoke_boot`.
2. Run `scene_transition`.
3. Run `toggle_panel`.
4. Run `hud_state_check`.
5. If comparison behavior is relevant, rerun `scene_transition --compare-to latest`.

For real game claims, use the target game project. This proving ground is a reference surface, not evidence that another project works.
