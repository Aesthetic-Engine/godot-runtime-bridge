# GRB 2.0 Proving Ground Agent Notes

Read this first when working in this example project.

This project exists to validate GRB proof workflows. Keep it small, deterministic, and easy to judge.

Authority order:

1. The mission files in `grb/missions/`
2. `grb/proof_policy.yaml`
3. This file
4. General repo docs

Rules:

- Do not turn this into a sample game.
- Do not add art/content unless it creates a clearer proof surface.
- Do not duplicate GRB Core logic here.
- Do not commit a copied addon; use `tools/sync_grb_addon.mjs`.
- Use existing GRB runtime commands and the mission runner.
- Keep screenshots stable enough for comparison and human review.
- Be explicit when proof is evidence-only and still needs a human check.
- Prefer clarifying existing surfaces over adding new missions or UI.
