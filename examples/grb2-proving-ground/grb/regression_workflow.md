# Proving-Ground Regression Workflow

Use this proving ground to practice turning a small passing mission into a lightweight regression surface.

The proving ground has three useful compare surfaces:

- `scene_transition`: title state to lab state
- `toggle_panel`: closed panel to open panel
- `hud_state_check`: visible counter/runtime state change

Each mission captures screenshots and runtime evidence, but none of them claims product correctness or E-tier experience.

## Baseline Candidate Rule

A proving-ground run is a baseline candidate only after you inspect:

- `grb_reports/<run-id>/summary.md`
- the mission report under `mission_runner/<mission_id>/`
- the named screenshots
- captured runtime values such as `state_before`, `state_after`, `counter_before`, or `counter_after`

For example, `hud_state_check` is trustworthy as a baseline candidate only if the report shows `counter_before` is `0`, `counter_after` is `1`, and the screenshots visibly agree.

If the proof summary says the run may be a baseline candidate, read that as conditional on this inspection.

## First Practice Flow

From the repo root:

```bash
node cli/grb.mjs mission run hud_state_check --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe
```

Inspect the resulting `summary.md`, `hud_after.png`, and mission report. If the run is passing and the HUD/runtime state looks right, treat it as a baseline candidate.

Then rerun with compare:

```bash
node cli/grb.mjs mission run hud_state_check --project examples/grb2-proving-ground --exe C:\path\to\Godot_console.exe --compare-to latest
```

Inspect:

```text
grb_reports/<candidate-run-id>/comparison/comparison.md
```

## Explicit Compare Practice

Use explicit compare when you want to choose both bundles yourself:

```bash
node cli/grb.mjs compare examples/grb2-proving-ground/grb_reports/<baseline-run-id> examples/grb2-proving-ground/grb_reports/<candidate-run-id>
```

This is better than `--compare-to latest` when you are reviewing a specific pair or when automatic baseline selection is blocked.

## Outcome Meanings

- `matched`: the deterministic artifacts matched; still review the screenshot and mission report.
- `difference_detected`: something changed and needs interpretation.
- `regression_suspected`: treat as a suspected regression until reviewed.
- `blocked`: no trustworthy comparison completed.
- `human_review_required`: automation found evidence that needs a human decision.

## Honest Limit

The proving ground is a reference surface. It can show that GRB comparison plumbing works on small deterministic missions. It does not prove another game project works, and it does not prove that a UI is good or fun.
