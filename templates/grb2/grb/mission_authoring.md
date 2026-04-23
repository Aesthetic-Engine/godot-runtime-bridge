# Mission Authoring Cookbook

Use this after `smoke_boot` passes and after you run `grb mission scaffold <mission_id>`.

This doc owns mission authoring only: choosing a small pattern, replacing scaffold TODOs, and writing honest handoff text. Use `grb/runtime_proof_hooks.md` only when the mission needs runtime-readable project state. Use `grb/regression_workflow.md` only after the mission has a trustworthy passing run.

A good mission is small: one surface, one action, one before/after question. It captures evidence and names what still needs human judgment.

## Pick a Pattern

- `default`: use when the mission does not fit a named pattern yet.
- `transition`: use when one action should move between screens or states.
- `toggle`: use when one action should open/close or show/hide a UI surface.
- `state_check`: use when visible UI should match a runtime-readable value, such as a HUD label, counter, mode, or selected item.

Canonical runnable examples in this repo:

- `transition`: `examples/grb2-proving-ground/grb/missions/scene_transition.yaml`
- `toggle`: `examples/grb2-proving-ground/grb/missions/toggle_panel.yaml`
- `state_check`: `examples/grb2-proving-ground/grb/missions/hud_state_check.yaml`

Generated `transition`, `toggle`, and `state_check` mission files also keep their matching canonical example path in a top-of-file comment.

## Replace TODO Steps

Choose the smallest action that reaches the proof surface:

- `press_button`: best when a Godot `Button` node has a stable name.
- `click`: use when there is no named button yet; coordinates are more fragile.
- `key`: use for input-map actions like `ui_accept`, `ui_cancel`, or project actions.
- `call_method`: read or prepare project state through a safe project method. This needs tier 2.
- `get_property`: read a specific node property when that property is the clearest proof surface.
- `assert_property`: compare a previously captured value with an exact expected value.
- `screenshot_diff`: show whether two screenshots changed or stayed the same.
- `check_errors`: fail honestly when new engine errors appear.

Keep TODO placeholders until you know the real node names, methods, inputs, and expected values. Do not claim R-tier or higher from a mission that still contains project-meaning TODOs.

For `state_check` missions, read `grb/runtime_proof_hooks.md` before adding helper methods. It explains how to expose small, stable runtime state that supports proof without turning project internals into the proof contract.

## Write Honest Handoff Text

`blocked_proof` should say why automation cannot finish the claim. Common reasons:

- screenshot evidence exists, but visual correctness needs human review
- a runtime value changed, but the expected design intent is not encoded yet
- the mission proves a narrow surface, not the whole feature

`human_handoff` should point to one artifact and one next check:

- artifact: `mission_runner/<mission_id>/<screenshot_label>.png`
- check: what a human should confirm in that artifact
- unresolved question: the exact question automation did not answer

## Tiny Examples

These are authoring examples, not built-in canonical missions.

### Panel Open/Close

Use `toggle` for pause, inventory, map, settings, or debug panels.

```yaml
steps:
  - action: runtime_info
  - action: screenshot
    label: panel_closed
  - action: press_button
    name: PauseButton
  - action: wait
    ms: 300
  - action: screenshot
    label: panel_open
  - action: screenshot_diff
    a: panel_closed
    b: panel_open
    issue_title: Expected the panel to become visible
  - action: check_errors
    label: panel_errors
```

Human review still needs to confirm the panel is the right panel, readable, and acceptable.

### Title To Gameplay

Use `transition` when one action should move to a new screen or state.

```yaml
steps:
  - action: runtime_info
  - action: screenshot
    label: title_before
  - action: press_button
    name: StartButton
  - action: wait
    ms: 300
  - action: screenshot
    label: gameplay_after
  - action: screenshot_diff
    a: title_before
    b: gameplay_after
    issue_title: Expected title screen to transition
  - action: check_errors
    label: transition_errors
```

Human review still needs to confirm the destination state is the intended one.

### HUD Or Runtime State Change

Use `state_check` when visible state should match a runtime value.

```yaml
steps:
  - action: runtime_info
  - action: screenshot
    label: before_state
  - action: call_method
    node: Main
    method: grb_get_hud_state
    label: state_before
  - action: press_button
    name: ModeButton
  - action: wait
    ms: 300
  - action: call_method
    node: Main
    method: grb_get_hud_state
    label: state_after
  - action: assert_property
    label: state_after
    expected: active
  - action: screenshot
    label: after_state
  - action: screenshot_diff
    a: before_state
    b: after_state
    issue_title: Expected HUD state to change visibly
  - action: check_errors
    label: state_errors
```

If the exact value is not stable yet, skip `assert_property` and make the unresolved question explicit in `human_handoff`.

## What Automation Proves

Automation can prove wiring, capture screenshots, collect runtime values, detect engine errors, and compare evidence surfaces.

Automation does not prove that the UI is good, fun, accessible, readable, balanced, or product-correct. Put those claims in `human_handoff` until a human confirms them.

## After This Mission Passes

When this mission passes and the artifacts look trustworthy, move to `grb/regression_workflow.md`. Do not treat a run as a baseline candidate until you inspect the summary, primary artifacts, mission report, runtime state if present, and human handoff.
