# Agent Operating Contract

This project uses Godot Runtime Bridge 2.0 proof workflows.

## Read First

- `grb.project.yaml`
- `grb/proof_policy.yaml`
- `grb/missions/smoke_boot.yaml`
- `grb/gotchas.md`

## Working Rules

- Keep implementation slices small enough to prove with one mission when possible.
- Before claiming a change works, say which proof tier was reached.
- Do not claim experiential proof unless a human has reviewed or played the slice.
- Put proof bundles under `grb_reports/`.
- Record recurring project-specific traps in `grb/gotchas.md`.

## Proof Language

- W: wiring proof, launch/connect/runtime inspection/errors.
- R: runtime visual evidence, screenshots or state that support visual review.
- E: experiential proof, human-confirmed feel or design intent.
