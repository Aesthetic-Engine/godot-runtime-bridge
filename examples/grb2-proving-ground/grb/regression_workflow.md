# Proving-Ground Regression Workflow

Use this proving ground to practice turning a small passing mission into a lightweight regression surface.

The proving ground has two compare teaching layers:

1. Stable rerun surface: `smoke_boot`
2. Change-within-the-run surfaces: `scene_transition`, `toggle_panel`, and `hud_state_check`

Start with `smoke_boot` because it has the cleanest baseline mental model: stable title/HUD boot state across reruns with `compare_expectation: no_unintended_change`.

Then use the other missions once you understand the baseline loop. They intentionally create a before/after change inside the run and use `compare_expectation: change_expected`.

Each mission captures screenshots and runtime evidence, but none of them claims product correctness or E-tier experience.

## Baseline Candidate Rule

A proving-ground run is a baseline candidate only after you inspect:

- `grb_reports/<run-id>/summary.md`
- the mission report under `mission_runner/<mission_id>/`
- the named screenshots
- captured runtime values such as `state_before`, `state_after`, `counter_before`, or `counter_after`

For first compare practice, a `smoke_boot` run is trustworthy as a baseline candidate only if the summary passes and `boot_screen.png` shows the stable title/HUD boot surface.

For later change-expected practice, `hud_state_check` is trustworthy as a baseline candidate only if the report shows `counter_before` is `0`, `counter_after` is `1`, and the screenshots visibly agree.

If the proof summary says the run may be a baseline candidate, read that as conditional on this inspection.

## First Practice Flow: Stable Surface

From the repo root:

```bash
node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
```

Inspect the resulting `summary.md`, `boot_screen.png`, and mission report. If the run is passing and the stable boot surface looks right, treat it as a baseline candidate.

Then rerun with compare:

```bash
node cli/grb.mjs mission run smoke_boot --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe --compare-to latest
```

Inspect:

```text
grb_reports/<candidate-run-id>/comparison/comparison.md
```

Use `comparison.md` as the review artifact. It should tell you what the proving-ground comparison supports, what it does not prove, and what human judgment remains.

## Second Practice Flow: Change-Expected Surfaces

After the stable `smoke_boot` loop is clear, practice with one bounded mission that intentionally changes state inside the run:

```bash
node cli/grb.mjs mission run hud_state_check --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
node cli/grb.mjs mission run hud_state_check --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe --compare-to latest
```

Use the same baseline-candidate rule: inspect the first passing run before trusting it. For change-expected missions, the review question includes whether the before/after change is intended and still readable.

## Explicit Compare Practice

Use explicit compare when you want to choose both bundles yourself:

```bash
node cli/grb.mjs compare examples/grb2-proving-ground/grb_reports/<baseline-run-id> examples/grb2-proving-ground/grb_reports/<candidate-run-id>
```

This is better than `--compare-to latest` when you are reviewing a specific pair or when automatic baseline selection is blocked.

If comparison is blocked, use `comparison.md` to see which proving-ground run candidates were rejected and why. Common causes are no prior passing run yet, choosing the candidate as its own baseline, or comparing against the wrong mission.

## Outcome Meanings

- `matched`: the deterministic artifacts matched; still review the screenshot and mission report.
- `difference_detected`: something changed and needs interpretation.
- `regression_suspected`: treat as a suspected regression until reviewed.
- `blocked`: no trustworthy comparison completed.
- `human_review_required`: automation found evidence that needs a human decision.

## Honest Limit

The proving ground is a reference surface. It can show that GRB comparison plumbing works on small deterministic missions. It does not prove another game project works, and it does not prove that a UI is good or fun.
