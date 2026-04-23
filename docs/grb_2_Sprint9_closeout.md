# GRB 2.0 - Sprint 9 Closeout Report

## Sprint Theme

Sprint 9 focused on tightening the GRB 2.0 product layer after the core proof workflow had become real.

Earlier sprints established:

- first trustworthy proof run
- second-mission authoring
- scaffold patterns
- runtime proof hook guidance
- proving-ground examples
- regression workflow onboarding
- compare and baseline discipline

Sprint 9 answered the next question:

**Can the GRB 2.0 proof workflow feel clear, durable, and internally consistent enough that a fresh user or coding agent can follow it without product-layer drift?**

This sprint stayed intentionally narrow.

It did not add runtime features, protocol commands, mission runner behavior, compare behavior, schema expansion, packaging, CI, or editor automation.

It focused on product-shape clarity:

- staged onboarding and contract routing
- blocked compare explanation quality
- proof-bundle review clarity
- scaffold/proving-ground contract consistency
- lightweight verification of product-layer truths
- a clearer canonical compare teaching path

---

## Outcome

**Sprint 9 is complete.**

GRB 2.0 now presents a more coherent proof workflow from the repo front door through first proof, second mission, regression practice, and compare review.

The refined path is:

```text
understand GRB
init the project contract
review first-read docs
run smoke_boot
inspect the proof bundle summary
scaffold one small mission
use runtime proof hooks only when needed
inspect a passing run before treating it as a baseline candidate
start compare practice with stable smoke_boot reruns
graduate to change-expected missions
use comparison.md as a decision aid
keep human review explicit
```

The major Sprint 9 improvement is not new power. It is reduced ambiguity around how to use the power GRB 2.0 already has.

---

## Slices Completed

### Slice 1 - Staged Onboarding and Contract Routing

This slice cleaned up the fresh-user path across the README, CLI init closeout, generated template docs, and proving-ground docs.

It clarified the intended stages:

1. understand GRB
2. run `grb init`
3. review first-read docs
4. run `smoke_boot`
5. scaffold one small project-specific mission
6. use runtime proof hooks only when needed
7. use regression workflow only after a trustworthy pass
8. use compare honestly

The key product improvement was role clarity:

- `README.md` is the front door.
- `AGENTS.md` is the operating contract and routing doc.
- `grb.project.yaml` records project contract truth.
- `mission_authoring.md` owns second-mission authoring.
- `runtime_proof_hooks.md` is optional and specific to runtime-readable proof.
- `regression_workflow.md` starts after a small mission passes.

No command behavior changed.

### Slice 2 - Compare Blocked / Rejected Baseline Clarity

This slice made compare edge cases readable for humans.

Before this slice, comparison output could expose internal reason strings such as:

- `candidate_self`
- `mission_mismatch`
- `missing_run_json`
- `unusable_result:blocked`
- `load_failed:...`

Those codes are useful internally, but not ideal for a fresh user.

The slice added a thin user-facing translation layer so CLI closeout and `comparison.md` now explain:

- the candidate cannot be used as its own baseline
- a run belongs to a different mission
- a run did not pass and is not eligible as an automatic baseline
- a bundle is incomplete or could not be loaded
- no prior passing baseline exists yet

The selector rules did not change. Only the explanation layer changed.

### Slice 3 - Proof-Bundle Review Clarity

This slice made `summary.md` easier to use as the first review artifact after a mission run.

It added:

- explicit `primary_review_artifact` metadata in `run.json`
- a `Review Verdict` section in `summary.md`
- clearer artifact role labels
- stronger passing-vs-blocked handoff wording
- CLI closeout lines for the primary review artifact and review focus

The new proof-bundle review flow is:

```text
result
primary artifact to inspect
why that artifact matters
what the reviewer should check
what automation proved
what automation did not prove
what still needs human review
next step
supporting evidence
trust boundary
handoff
```

The implementation did not change mission execution, screenshot capture, proof tiers, runner behavior, compare behavior, or exit codes.

### Slice 4 - Proving-Ground Contract Consistency

This slice aligned the proving-ground `grb.project.yaml` with the generated GRB 2.0 project contract shape.

Before this slice, the generated scaffold and proving ground used different manifest shapes.

The generated template used fields such as:

- `name`
- `grb_version`
- `default_recipe`
- `missions` as a list
- `read_first`
- `expected_first_run`
- `proof_reports_dir`
- `first_trustworthy_proof_run`

The proving ground had older fixture-specific fields such as:

- `project_name`
- `project_type`
- `purpose`
- `primary_surfaces`
- `setup`
- `missions` as a mapping

The proving-ground contract now follows the generated contract shape. Fixture-specific context moved into `README.md` and `AGENTS.md`, where it belongs.

The result is that the proving ground now looks like a filled-in canonical GRB 2.0 project contract, not a parallel configuration dialect.

### Slice 5 - Lightweight Product-Shape Verification

This slice added a repo-native verification script:

```bash
node tools/verify_grb2_product_shape.mjs
```

It is deliberately small, deterministic, and local.

It does not launch Godot and does not add a test framework.

It verifies key Sprint 9 product-shape truths:

- baseline rejection reasons render as human-readable text
- blocked comparison summaries include review-friendly sections
- proof-bundle summaries expose a primary review artifact and trust boundary
- generated and proving-ground contracts share the expected GRB 2.0 top-level shape

This gives future agents and contributors a cheap way to avoid regressing the human-facing proof workflow.

### Slice 6 - Canonical Compare Teaching Path

This slice refined the proving-ground compare teaching sequence.

The proving ground has two compare teaching modes:

1. **Stable rerun compare**
   - `smoke_boot`
   - `compare_expectation: no_unintended_change`

2. **Change-within-the-run compare**
   - `scene_transition`
   - `toggle_panel`
   - `hud_state_check`
   - `compare_expectation: change_expected`

The docs now teach `smoke_boot` as the first compare practice surface because it is the simplest mental model:

```text
stable boot surface
passing run inspected as baseline candidate
rerun with --compare-to latest
review comparison.md
```

The change-expected missions are still important, but they are now positioned as the second compare layer once the baseline loop is understood.

---

## Product Questions Answered

### Can a fresh user follow the GRB 2.0 proof path without reading everything at once?

Yes.

The staged path now appears in the README, init closeout, generated contract docs, and proving-ground docs.

Users are routed to the right doc at the right time instead of being handed all docs as equal priority.

### Can blocked compare cases explain themselves clearly?

Yes.

Blocked and rejected baseline cases now answer:

- what GRB tried to do
- why it refused to compare
- which candidate runs were rejected
- what the user should do next
- what compare still does not prove

### Can a proof bundle tell the user what to inspect first?

Yes.

Proof bundles now expose a primary review artifact, review focus, unresolved question, and trust boundary.

This is especially useful for fresh users who need to know where to start in `grb_reports/<run-id>/`.

### Does the proving ground model the generated project contract?

Yes.

The proving-ground contract now follows the same shape as the generated GRB 2.0 contract scaffold.

That makes it a better reference implementation.

### Is there a lightweight guard against product-layer drift?

Yes.

`tools/verify_grb2_product_shape.mjs` protects the most important Sprint 9 surfaces without adding framework weight.

### Does the proving ground teach compare in the right order?

Yes.

The first compare practice path is now `smoke_boot`, followed by change-expected missions.

This makes the proving-ground compare story more honest and easier to learn.

---

## Key Files and Surfaces Improved

### Onboarding and Routing

- `README.md`
- `cli/grb.mjs`
- `templates/grb2/AGENTS.md`
- `templates/grb2/grb.project.yaml`
- `templates/grb2/grb/mission_authoring.md`
- `templates/grb2/grb/runtime_proof_hooks.md`
- `templates/grb2/grb/regression_workflow.md`

### Compare Clarity

- `cli/lib/baseline_reason_text.mjs`
- `cli/lib/compare_runs.mjs`
- `cli/lib/render_comparison_summary.mjs`
- `cli/lib/smoke_boot.mjs`
- `templates/grb2/grb/regression_workflow.md`
- `examples/grb2-proving-ground/grb/regression_workflow.md`

### Proof-Bundle Review

- `cli/lib/proof_bundle.mjs`
- `cli/lib/smoke_boot.mjs`
- `templates/grb2/grb/proof_policy.yaml`
- `templates/grb2/grb/mission_authoring.md`
- `templates/grb2/grb/regression_workflow.md`

### Proving Ground and Contract Reference

- `examples/grb2-proving-ground/grb.project.yaml`
- `examples/grb2-proving-ground/AGENTS.md`
- `examples/grb2-proving-ground/README.md`
- `examples/grb2-proving-ground/grb/regression_workflow.md`

### Durability

- `tools/verify_grb2_product_shape.mjs`

---

## Validation Performed During Sprint 9

Sprint 9 used lightweight validation appropriate to each slice:

- `node --check` on touched `.mjs` files
- synthetic blocked comparison rendering
- synthetic passing and blocked proof-bundle generation
- contract-shape checks using the repo's simple YAML parser
- sanity scans for real referenced files, missions, and commands
- `git diff --check`
- `node tools/verify_grb2_product_shape.mjs`

The final product-shape verification reports:

```text
ok baseline reason text
ok blocked comparison summary
ok proof bundle review path
ok GRB 2.0 contract shape
```

No runtime/Godot validation was required for these slices because Sprint 9 intentionally avoided runtime behavior changes.

---

## What Sprint 9 Did Not Change

Sprint 9 intentionally did not change:

- GRB Core
- wire protocol
- MCP tool behavior
- editor dock behavior
- mission runner behavior
- compare classification logic
- baseline-selection rules
- artifact pairing behavior
- proof tier definitions
- mission schema
- CLI command shape
- packaging or PATH behavior
- CI configuration
- proving-ground gameplay/content

This was a product-layer clarity sprint, not a capability-expansion sprint.

---

## Current GRB 2.0 Shape After Sprint 9

GRB 2.0 now has a coherent human-and-agent workflow:

```text
Core captures evidence.
Proof layer writes honest bundles and comparisons.
Project contract tells agents what to read and when.
Proving ground demonstrates the workflow.
Verification script protects key product-layer truths.
```

The tool is now better at guiding users and agents through:

- first proof
- second mission
- runtime state proof when needed
- baseline candidate review
- stable compare practice
- change-expected compare practice
- blocked compare recovery
- human handoff

It still does not pretend to prove:

- product correctness
- design intent
- visual quality
- UX feel
- E-tier experience

Those remain explicit human-review responsibilities.

---

## Risks and Remaining Limits

Sprint 9 reduced ambiguity, but a few limits remain:

- The verification script is manual, not wired into CI.
- Contract shape is lightly checked, not schema-validated.
- Proof-bundle rendering now has more product value, but only minimal automated coverage.
- The CLI is still invoked through `node cli/grb.mjs`.
- Compare remains artifact-based and honest, not semantic visual intelligence.
- Proving-ground examples are reference surfaces, not proof that a user's game behaves correctly.

These are acceptable limits for Sprint 9.

---

## Recommended Next Step

Sprint 9 feels like a natural closeout point for GRB 2.0's current product-layer hardening.

The next useful sprint should probably not add more wording polish immediately.

Recommended next direction:

**Use the now-stable proving ground and verification layer to identify the next real capability gap.**

Good candidates include:

- a small runtime/control capability that improves mission usefulness
- a tiny mission-runner affordance that reduces authoring friction
- a focused comparison enhancement backed by proving-ground validation
- a minimal CI hook for the product-shape verification script

The important discipline remains:

```text
Core captures.
Proof compares.
Contract interprets.
Humans decide what automation cannot prove.
```

---

## Sprint 9 Closeout Judgment

Sprint 9 is complete.

It successfully tightened the GRB 2.0 user journey without broadening scope.

The repo now feels less like a collection of proof features and more like a coherent proof workflow:

- clearer to start
- clearer to review
- clearer to compare
- clearer when blocked
- clearer what agents should read
- clearer what humans still own

That is a meaningful product improvement for GRB 2.0.
