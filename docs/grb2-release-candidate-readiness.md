# GRB 2.0 Release-Candidate Readiness

This document is the compact release-candidate readiness surface for GRB 2.0.

Use it when you need to answer:

- what is currently release-candidate ready
- which checks are required before tagging
- what those checks support
- what those checks do not prove
- what remains deferred to Sprint 13

## What Is Currently Release-Candidate Ready

The repo is currently release-candidate ready for the following GRB 2.0 surfaces:

- repo-root GRB launchers for the full-repo workflow:
  - `grb.cmd`
  - `./grb`
- GRB 2.0 project initialization and local repo-linkage stamping
- no-launch readiness checking via `doctor`, including a refusal to
  green-light unresolved `<project>` / `<godot_exe>` / `<path-to-godot-exe>`
  placeholders in the first trustworthy proof-run contract
- first trustworthy proof-run flow:
  - `init`
  - `doctor`
  - `mission run smoke_boot`
- project-local proof bundles and compare/baseline workflow
- deterministic proving-ground reference project
- lightweight GRB 2.0 product-shape verification
- release smoke that now includes GRB 2.0 product-shape verification plus a
  live `init` → `doctor` → `mission run smoke_boot` exercise on a fresh
  project, not just file-shape assertions
- MCP `grb_launch` refuses never-opened projects missing `.godot/` metadata
  with an actionable error instead of a slow launch timeout

## Required Checks

From `mcp/`:

```bash
npm run verify:versions
npm run verify:grb2:shape
npm run verify:grb -- --godot-exe "/path/to/godot" --project "/path/to/project"
npm run verify:release -- --godot-exe "/path/to/godot" --project "/path/to/project"
```

What each check does:

- `verify:versions`
  - does **not** launch Godot
  - checks version parity across:
    - `mcp/package.json`
    - `mcp/package-lock.json`
    - `addons/godot-runtime-bridge/plugin.cfg`
    - `addons/godot-runtime-bridge/runtime_bridge/EditorDock.gd`
    - `mcp/index.js` server version and startup banner
- `verify:grb2:shape`
  - does **not** launch Godot
  - checks GRB 2.0 product-shape truth such as launcher/docs/template/proving-ground consistency
- `verify:grb`
  - **does** require a real Godot executable and a real project
  - runs the live GRB release smoke sequence
- `verify:release`
  - **does** require a real Godot executable and a real project
  - is the honest aggregate release gate: it runs `verify:grb2:shape` first,
    then version parity, then the live release smoke sequence. This is the
    command maintainers should treat as "the full release-facing check."
- `verify:release:live`
  - **does** require a real Godot executable and a real project
  - runs version parity plus the live release smoke sequence only; it does
    not run the GRB 2.0 product-shape check. Use it when you have already run
    `verify:grb2:shape` separately and just want to re-exercise the live smoke.

## What These Checks Support

Together, these checks support release-candidate confidence that:

- version surfaces agree
- the repo-root launcher and full-repo GRB 2.0 path still exist
- README, templates, proving-ground docs, and project-shape truth have not drifted
- `init` still stamps repo linkage
- `doctor` still reports readiness shape honestly
- the live bridge can still launch, connect, observe, capture, and quit on a real smoke target

## What These Checks Do Not Prove

These checks do **not** prove:

- product correctness
- gameplay correctness
- design intent correctness
- experiential quality or E-tier proof
- that every distribution channel provides the same tooling surface

They support release-candidate confidence.
They do not replace human judgment.

## Distribution / Channel Truth

Current channel truth remains:

- addon/archive/export packaging is addon-oriented
- the GRB 2.0 proof workflow requires a full repo clone
- templates, proving ground, repo-root launchers, and product-shape verification are full-repo surfaces

Do not treat addon-only or AssetLib delivery as equivalent to the full-repo GRB 2.0 workflow.

## Deferred To Sprint 13

Sprint 13 Slice 1 has now delivered:

- **version/tag decision** — all GRB version surfaces now report
  `2.0.0-rc.0`; `verify:versions` enforces this parity
- **release changelog section** — `CHANGELOG.md` now has a real
  `2.0.0-rc.0 — 2026-04-22` section in place of the open-ended `Unreleased`
  bucket
- **release verification naming** — `verify:release` is now the honest
  aggregate (shape + versions + live smoke); `verify:release:live` preserves
  the prior versions+live-smoke-only behavior

Sprint 13 Slice 2 additionally delivered launcher-doctrine cleanup across
templates, proving-ground helper output, CLI error text, and docs, plus
product-facing comparison wording and product-shape enforcement of these
surfaces.

Sprint 13 Slice 3 additionally delivered:

- **CI coverage of the actual first-run flow** — release smoke now
  exercises `init` → `doctor` → `mission run smoke_boot` on a fresh project
  end-to-end
- **stricter placeholder detection** — `doctor` and the first-proof contract
  check now refuse `<project>`, `<godot_exe>`, `<path-to-godot-exe>`,
  `<path-to-godot>`, and `<godot_path>` in `first_trustworthy_proof_run.command`
- **proving-ground contract honesty** — the proving-ground's
  `grb.project.yaml` no longer ships with unresolved placeholders in its
  first-proof command
- **MCP `.godot/` guard** — `grb_launch` refuses never-opened projects with
  an actionable error instead of a slow launch timeout

Still deferred to later Sprint 13 slices:

- final release smoke on the intended release target
- any final release-channel or packaging decision beyond current addon-oriented archive truth
- the other audit items not covered yet (addon-side Cursor-only side
  effects, archive/channel policy, proof-tier headline wording, and YAML
  parser robustness)

## Intentionally Out Of Scope For GRB 2.0 Launch

The following remain intentionally out of scope unless a later sprint explicitly changes that:

- PATH/global install polish
- packaging overhaul
- addon-only delivery of the full GRB 2.0 proof/tooling surface
- schema redesign
- runtime/protocol redesign
- compare or proof-semantics redesign
