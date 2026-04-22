# Agent Operating Contract

This project uses Godot Runtime Bridge 2.0 proof workflows. Treat this file as the first draft of the project's agent operating contract; customize it as the project becomes more specific.

## Read First

- `grb.project.yaml`
- `grb/proof_policy.yaml`
- `grb/missions/smoke_boot.yaml`
- `grb/gotchas.md`

## Working Rules

- Keep implementation slices small enough to prove with one mission when possible.
- Before claiming a change works, say which proof tier was reached and link the proof bundle.
- Do not claim experiential proof unless a human has reviewed or played the slice.
- Put proof bundles under `grb_reports/`.
- Record recurring project-specific traps in `grb/gotchas.md`.

## First Proof Run

Run `grb/missions/smoke_boot.yaml` before making larger changes. A passing smoke boot targets W-tier wiring proof. It can provide R-tier screenshot evidence, but it does not prove visual correctness by itself. E-tier still needs human review.

## Proof Language

- W: wiring proof, launch/connect/runtime inspection/errors.
- R: runtime visual evidence, screenshots or state that support visual review.
- E: experiential proof, human-confirmed feel or design intent.
