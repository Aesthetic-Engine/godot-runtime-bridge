# GRB 2.0 Proving Ground

This is a tiny deterministic Godot project for validating and demoing GRB proof workflows without needing a real game project.

It is intentionally not a sample game. It has one scene and one script with stable proof surfaces: boot/title, scene-like state transition, visible HUD state, and a toggleable proof panel.

The missions use GRB capability tier 2 because they capture runtime-readable state through safe project methods.

## Setup

The canonical GRB addon remains at the repo root under `addons/godot-runtime-bridge`. This example does not commit a duplicate addon copy.

From the GRB repo root:

```bash
node examples/grb2-proving-ground/tools/sync_grb_addon.mjs
```

Then open the project once in Godot so `.godot/` metadata is created:

```bash
Godot_v4.6-stable_win64_console.exe --headless --editor --quit --path examples/grb2-proving-ground
```

## Run Missions

From the GRB repo root:

```bash
node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run scene_transition --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run toggle_panel --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
```

From inside this project:

```bash
node ..\..\cli\grb.mjs mission run smoke_boot --exe C:\path\to\Godot_console.exe
```

Proof bundles land under `grb_reports/<run-id>/`.

## What To Inspect

- `smoke_boot` should show the stable title and HUD labels.
- `scene_transition` should show `STATE: lab`, an incremented counter, and the visible compare banner.
- `toggle_panel` should show `PANEL: open` plus the proof panel text.

Screenshots are evidence surfaces, not automatic visual correctness claims. E-tier still requires a human to confirm that the visible behavior is meaningful and acceptable.
