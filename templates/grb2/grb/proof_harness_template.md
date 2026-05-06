# Project Proof Harness Template

Use this when a project-specific feature needs a small deterministic proof probe
that goes beyond a generic mission scaffold.

This is an authoring template, not a new automatic proof runner and not a
guarantee of correctness. It helps you expose and capture evidence that a human
or coding agent can review honestly with W/R/E proof language.

## What This Is For

Use a proof harness when a mission needs one stable project-specific setup or
state read, such as:

- seek to a timestamp, checkpoint, room, or UI state
- return a small JSON-friendly debug snapshot
- capture before/after runtime state alongside screenshots
- write a short markdown report that explains what was and was not shown

Keep the harness narrow: one proof surface, one setup path, one set of evidence.

## Recommended Shape

1. Start from a small GRB mission, usually `transition`, `toggle`, or
   `state_check`.
2. Add a project helper method only when the mission needs stable project truth.
3. Make the helper deterministic: no timestamps, frame counters, random seeds,
   or broad engine dumps unless they are the proof target.
4. Return a small JSON-friendly object with explicit keys.
5. Capture a screenshot before and after the interaction.
6. Capture runtime-readable state before and after the interaction.
7. Write a markdown proof report using `grb/proof_report_template.md`.

## Example Project Helpers

These examples show the intended shape only. Rename nodes, methods, and fields
for your project.

```gdscript
func grb_seek_proof_state(state_id: String) -> Dictionary:
    match state_id:
        "title":
            show_title_screen()
        "paused":
            open_pause_menu()
        "hud_mode_b":
            set_debug_mode("mode_b")
        _:
            return {
                "ok": false,
                "state_id": state_id,
                "error": "unknown proof state"
            }

    return grb_debug_snapshot()


func grb_debug_snapshot() -> Dictionary:
    return {
        "ok": true,
        "screen": current_screen_name,
        "mode": current_mode,
        "counter": score_counter,
        "pause_panel_visible": pause_panel.visible
    }
```

Good snapshot fields describe product truth. Avoid returning full scene trees,
node internals, secrets, absolute machine paths, noisy frame/time values, or
large object dumps.

## Mission Step Shape

Use existing mission-runner primitives. Do not invent a new action type for the
harness.

```yaml
steps:
  - action: runtime_info

  - action: call_method
    node: Main
    method: grb_seek_proof_state
    args: ["title"]
    label: setup_snapshot

  - action: screenshot
    label: before_surface

  - action: call_method
    node: Main
    method: grb_debug_snapshot
    label: before_snapshot

  - action: press_button
    name: StartButton

  - action: wait
    ms: 300

  - action: call_method
    node: Main
    method: grb_debug_snapshot
    label: after_snapshot

  - action: screenshot
    label: after_surface

  - action: screenshot_diff
    a: before_surface
    b: after_surface
    issue_title: Expected the proof surface to change

  - action: check_errors
    label: proof_errors
```

The runtime values are captured into GRB run artifacts. If your project also
writes a JSON debug snapshot file, keep it small and reference it from the
proof report.

## Markdown Proof Report

Use `grb/proof_report_template.md` for the human-facing closeout. Include:

- the exact proof commands
- the before/after worktree state
- the JSON snapshot fields reviewed
- the screenshots reviewed
- W-tier and R-tier evidence
- E-tier evidence only when a human actually reviewed it
- known issues and explicit "not claimed" limits

## What This Does Not Prove

The harness can make proof work more deterministic and reviewable. It still does
not prove product correctness, design intent, accessibility, game feel, balance,
or E-tier experience by itself.
