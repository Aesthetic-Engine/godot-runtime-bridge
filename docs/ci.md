# GRB in CI/CD

This repo now has two different automation layers, and CI docs should keep them
separate:

1. **Repo-level release smoke** - verifies the shipped addon + MCP release
   surface in this repo
2. **Project-level proof workflows** - run in an actual Godot project using
   `node cli/grb.mjs ...`

There is also an older **legacy mission runner** in `missions/`. It can still
be used in CI for broad runtime passes, but it is not the primary GRB 2.0 proof
product story.

## Repo-Level Release Smoke

The repo's main CI truth today is the release smoke path under `mcp/`.

It checks:

- version parity (`npm run verify:versions`)
- live bridge launch/connect on a temporary Godot project
- core release-smoke commands such as `ping`, `auth_info`, `capabilities`,
  `runtime_info`, `get_errors`, `screenshot`, and `quit`
- release-smoke artifacts under `mcp/reports/release-smoke/`

This is what the repo's GitHub Actions smoke workflow is built around.

### Local command

From `mcp/`:

```bash
npm run verify:release -- --godot-exe "/path/to/godot" --project "/path/to/project"
```

This is a release-surface smoke check. It does **not** prove product
correctness, UX quality, or E-tier experience.

## Linux CI and xvfb

Godot still needs a display server for rendered screenshot flows on headless
Linux runners. Use `xvfb-run` when you need live rendering.

Minimal shape:

```bash
xvfb-run --auto-servernum --server-args="-screen 0 1280x720x24" \
  npm run verify:release -- --godot-exe "/path/to/godot" --project "/path/to/project"
```

Key points:

- `xvfb-run` provides a virtual display so Godot can render
- `--auto-servernum` avoids display-number conflicts
- `-screen 0 1280x720x24` gives Godot a stable framebuffer

Windows and macOS runners already provide a display server, so `xvfb` is
usually not needed there.

## Project-Level GRB 2.0 Proof Workflows

If you are validating a real Godot project with GRB 2.0, the normal path is not
the legacy mission pack. It is:

1. `node cli/grb.mjs init --project <project>`
2. `node cli/grb.mjs mission run smoke_boot --project <project> --exe <godot>`
3. inspect `grb_reports/<run-id>/summary.md`
4. after a trustworthy small mission pass, use compare honestly

That workflow is project-local and belongs in the project's own CI or release
process, not in this repo's generic smoke workflow.

Use the root `README.md` for that path.

## Legacy Mission Runner in CI

The older mission runner still works for broad runtime passes:

```bash
node missions/run_mission.mjs --mission smoke_test --exe "/path/to/godot" --project "/path/to/project"
```

It writes reports under `missions/reports/` by default.

That can be useful when a project wants a generic built-in mission pack without
adopting the GRB 2.0 project-contract flow. It should not be confused with:

- GRB 2.0 proof bundles under `grb_reports/`
- baseline-candidate guidance
- `node cli/grb.mjs compare ...`

One current repo-truth wrinkle: `run_mission.mjs` still accepts
`--mission starters`, but the built-in mission pack on current `main` does not
mark any missions with `starter: true`. In practice, use an explicit mission id
or `--mission all`.

## What CI Can and Cannot Honestly Claim

CI can realistically support:

- version parity checks
- bridge launch/connect smoke checks
- screenshot/runtime artifact capture
- generic or project-specific mission execution
- comparison as a review aid when a project intentionally opts into it

CI does **not** automatically prove:

- product correctness
- design intent correctness
- player experience / feel
- E-tier proof

Use CI evidence as a decision aid, then keep the remaining human review
explicit.
