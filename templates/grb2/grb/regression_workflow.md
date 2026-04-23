# Regression Workflow

Use this after a small mission passes and you want to turn it into a lightweight regression surface.

A regression surface is a narrow, repeatable proof target: one mission, one behavior surface, and a small set of artifacts that can be compared later. Good examples are a title-to-gameplay transition, a pause panel opening, or a HUD value changing.

## Baseline Candidates

A passing run is a baseline candidate when:

- the mission is small and project-specific
- `summary.md` says the run passed
- the primary screenshot, mission report, and captured runtime state look like the intended surface
- `human_handoff` still says what automation did not prove
- the run is not blocked, corrupt, or based on unresolved TODO meaning

A baseline is not magical truth. It is a prior run you intentionally decide is good enough to compare against. If the baseline has a hidden bug, compare can preserve that bug.

## Minimum Honesty Bar

Before using compare, inspect:

1. `grb_reports/<run-id>/summary.md`
2. the named screenshot in `human_handoff.artifact_to_inspect`
3. the mission runner report under `mission_runner/<mission_id>/`
4. captured runtime values when the mission uses `call_method` or `get_property`
5. the unresolved question in `human_handoff`

Only treat the run as a baseline candidate after you know what it proves and what still needs human review.

Passing proof summaries may call a run a baseline candidate, but that is conditional on this inspection step.

## First Compare Workflow

1. Run the mission once:

   ```bash
   node <path-to-grb-main>/cli/grb.mjs mission run <mission_id> --project <project> --exe <godot_exe>
   ```

2. Inspect `summary.md`.
3. Inspect the named screenshot, mission report, and runtime state.
4. Confirm what still needs human judgment.
5. Treat that run as a baseline candidate if it is trustworthy enough.
6. Rerun with automatic same-mission baseline selection:

   ```bash
   node <path-to-grb-main>/cli/grb.mjs mission run <mission_id> --project <project> --exe <godot_exe> --compare-to latest
   ```

7. Inspect:

   ```text
   grb_reports/<candidate-run-id>/comparison/comparison.md
   ```

Use `comparison.md` as a decision aid. It should tell you what the comparison supports, what it does not prove, and what human judgment remains.

## Which Compare Flow To Use

Use `--compare-to latest` when:

- you already have a passing baseline candidate for the same mission
- you want GRB to choose the newest eligible passing run with the same `mission_id`
- you are doing a normal rerun of a known proof surface

Use explicit bundle-to-bundle compare when:

- you want to choose the baseline yourself
- there are several plausible baselines
- you are reviewing a specific before/after pair
- automatic baseline selection is blocked or not trusted

```bash
node <path-to-grb-main>/cli/grb.mjs compare <baseline-run-dir> <candidate-run-dir>
```

If no trustworthy baseline exists, create one first. Do not force comparison against a vague or unreviewed run.

## Outcomes

- `matched`: compared artifacts matched within current GRB checks. Still inspect the summary before claiming correctness.
- `difference_detected`: something changed. Decide whether it was intended or suspicious.
- `regression_suspected`: the comparison found a worse issue/error surface or a change that conflicts with the expectation. Treat it as suspected until reviewed.
- `blocked`: comparison did not complete because baseline selection or bundle loading was not trustworthy.
- `human_review_required`: automation found evidence that needs human judgment.

## compare_expectation

`compare_expectation` tells GRB how to interpret differences for this mission.

- `no_unintended_change`: use when the mission should stay visually/runtime stable across reruns. Differences require review.
- `change_expected`: use when the mission itself intentionally creates a before/after difference inside the run, such as a transition, toggle, or state change.

This field is guidance for comparison classification. It is not a complete policy system, and it does not prove product correctness.

## What Compare Can And Cannot Prove

Compare can help show:

- screenshots changed or matched
- runtime summary changed or matched
- error/log surfaces got better, worse, or stayed similar
- whether a candidate differs from an accepted baseline candidate

Compare cannot prove:

- the UI is good, readable, or fun
- the feature matches design intent
- the baseline was correct
- E-tier experience

Keep `human_handoff` honest even when comparison says `matched`.
