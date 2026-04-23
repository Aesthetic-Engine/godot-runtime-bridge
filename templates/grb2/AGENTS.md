# Agent Operating Contract

This project uses Godot Runtime Bridge 2.0 proof workflows. Treat this file as the first read for coding agents and as the starting point for project-specific operating truth.

Customize the TODOs before relying on this contract for larger work.

## Stage Routing

Read in this order:

1. `grb.project.yaml` for project name, default recipe, report path, and expected first run truth.
2. `grb/proof_policy.yaml` for W/R/E claim rules and review expectations.
3. `grb/missions/smoke_boot.yaml` before the first proof run.
4. `grb/gotchas.md` for project-specific traps before changing code.

Use later, only when the stage calls for it:

- `grb/mission_authoring.md` after `smoke_boot` passes and you are creating the next small mission.
- `grb/runtime_proof_hooks.md` only when a `state_check` or runtime-readable proof needs a stable project state read.
- `grb/regression_workflow.md` only after a small mission passes and you are deciding whether the run is a baseline candidate.

## Working Rules

- Keep implementation slices small enough to prove with one mission when possible.
- Before claiming a change works, say which proof tier was reached and link the proof bundle.
- Say what was not proven and what still needs human review.
- Do not claim experiential proof unless a human has reviewed or played the slice.
- Put proof bundles under `grb_reports/`.
- Record recurring project-specific traps in `grb/gotchas.md`.

## Customize First

- Replace `TODO Project Name` in `grb.project.yaml`.
- Add the real startup scene/state under `expected_first_run`.
- Add project-specific visual or UX expectations to `grb/proof_policy.yaml`.
- Add known launch/import/plugin traps to `grb/gotchas.md`.

## First Proof Run

Run `grb/missions/smoke_boot.yaml` before making larger changes. A passing smoke boot targets W-tier wiring proof. It can provide R-tier screenshot evidence, but it does not prove visual correctness by itself. E-tier still needs human review.

After the run, inspect:

- `grb_reports/<run-id>/summary.md`
- the primary screenshot listed in the summary
- `grb_reports/<run-id>/run.json` when another tool needs machine-readable proof

## Second Mission Stage

After `smoke_boot` passes, create one small project-specific mission for the next feature surface:

```bash
node <path-to-grb-main>/cli/grb.mjs mission scaffold todo_mission_id --project <project> --pattern transition
```

Choose a small pattern:

- `transition`: title to gameplay, menu to panel, screen/state change.
- `toggle`: open/close or hidden/visible UI such as pause, inventory, map, settings.
- `state_check`: HUD label, counter, selected mode/item, or runtime-readable property change.
- `default`: use when the surface does not clearly fit one of the named patterns.

Repo examples: `transition` -> `examples/grb2-proving-ground/grb/missions/scene_transition.yaml`, `toggle` -> `examples/grb2-proving-ground/grb/missions/toggle_panel.yaml`, `state_check` -> `examples/grb2-proving-ground/grb/missions/hud_state_check.yaml`.

Customize the goal, one interaction step, and human handoff before claiming proof. For `state_check`, also replace the TODO runtime state reads with one `call_method` or `get_property` source. Prefer one clear before/after surface over broad exploratory automation.

When replacing scaffold TODOs, use `grb/mission_authoring.md` as the local cookbook. It owns second-mission authoring guidance.

When a `state_check` mission needs project-specific runtime state, use `grb/runtime_proof_hooks.md` before adding helper methods. Skip it for missions that only need screenshots or simple interaction.

## Regression Stage

After a small mission passes, read `grb/regression_workflow.md` before using compare. A passing run is only a baseline candidate after `summary.md`, the named artifact, the mission report, and any runtime state have been inspected.

## Proof Language

- W: wiring proof, launch/connect/runtime inspection/errors.
- R: runtime visual evidence, screenshots or state that support visual review.
- E: experiential proof, human-confirmed feel or design intent.
