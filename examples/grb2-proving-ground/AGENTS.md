# GRB 2.0 Proving Ground Agent Notes

Read this first when working in this example project.

This project exists to validate GRB proof workflows. Keep it small, deterministic, and easy to judge.

Fixture context:

- Type: deterministic validation fixture.
- Purpose: validate and demo GRB 2.0 proof workflows without requiring a real game project.
- Primary surfaces: boot/title, title-to-lab transition, visible HUD state, toggleable proof panel.
- Setup helper: `tools/sync_grb_addon.mjs`.
- Reports, synced addon copy, and Godot metadata are local artifacts and should stay ignored.

Stage routing:

1. Read this file and `grb.project.yaml` to understand the fixture purpose.
2. Use `grb/proof_policy.yaml` for proof language and claim limits.
3. Use `grb/missions/` as the source of truth for each runnable proof surface.
4. Use `grb/regression_workflow.md` only after a mission has a passing run you have inspected.
5. Use the root README for general GRB setup and CLI context.

Rules:

- Do not turn this into a sample game.
- Do not add art/content unless it creates a clearer proof surface.
- Do not duplicate GRB Core logic here.
- Do not commit a copied addon; use `tools/sync_grb_addon.mjs`.
- Use existing GRB runtime commands and the mission runner.
- Keep screenshots stable enough for comparison and human review.
- Be explicit when proof is evidence-only and still needs a human check.
- Before using compare, inspect the passing run and read `grb/regression_workflow.md`.
- Prefer clarifying existing surfaces over adding new missions or UI.
