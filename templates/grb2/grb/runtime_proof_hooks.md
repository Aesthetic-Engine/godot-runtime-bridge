# Runtime Proof Hooks

Use this when a `state_check` mission needs a stable runtime value to read with `call_method` or `get_property`.

A proof hook is a small, safe piece of project code that exposes product truth for proof runs. It should help answer a narrow question like "which screen is active?", "is the pause panel visible?", or "what HUD mode is shown?"

## When To Use Each Read

- `call_method`: use when you can add a small helper method that returns exactly the proof state you care about. This is usually best for `state_check` missions.
- `get_property`: use when a stable node property already expresses the proof state clearly.

Prefer product truth over engine trivia. `current_screen == "inventory"` is better proof than a random node count. `panel_visible == true` is better proof than a theme color or layout number unless the mission is specifically about that visual value.

## Stable Hook Rules

Good runtime proof hooks are:

- explicit: return named fields like `screen`, `panel_visible`, `counter`, or `mode`
- small: return a scalar or a tiny dictionary, not a whole node tree
- deterministic: avoid timestamps, random IDs, object addresses, frame counts, or animation noise
- safe: read state only; do not mutate gameplay unless the method is clearly a reset/setup helper
- product-facing: expose the state the player or feature cares about
- easy to name: use names like `grb_get_hud_state`, `grb_current_screen`, or `grb_is_pause_panel_open`

Do not expose secrets, save data, personal data, auth tokens, large inventories, raw logs, or broad internal objects just to make a mission pass.

## Tiny Examples

These examples are guidance only. Add hooks where they naturally fit in your project code.

### HUD State Summary

```gdscript
func grb_get_hud_state() -> Dictionary:
	return {
		"mode": hud.mode,
		"counter": hud.counter,
		"label": hud.mode_label.text,
	}
```

Mission read:

```yaml
- action: call_method
  node: Main
  method: grb_get_hud_state
  label: state_after
```

### Current Screen Or State

```gdscript
func grb_current_screen() -> String:
	return current_screen_name
```

Mission read:

```yaml
- action: call_method
  node: Main
  method: grb_current_screen
  label: screen_after
- action: assert_property
  label: screen_after
  expected: gameplay
```

### Visible Or Hidden Flag

```gdscript
func grb_is_pause_panel_open() -> bool:
	return pause_panel.visible
```

Mission read:

```yaml
- action: call_method
  node: Main
  method: grb_is_pause_panel_open
  label: panel_open
- action: assert_property
  label: panel_open
  expected: true
```

### Small Review Dictionary

```gdscript
func grb_proof_state() -> Dictionary:
	return {
		"screen": current_screen_name,
		"panel": "open" if pause_panel.visible else "closed",
		"selected_tool": selected_tool_id,
	}
```

This kind of hook is useful when the screenshot and runtime state should be reviewed together.

## What This Does Not Prove

Runtime proof hooks can make R-tier evidence stronger by pairing screenshots with stable project state.

They do not prove E-tier claims. A mission can show that `screen_after == "gameplay"` and capture the gameplay screenshot, but a human still needs to decide whether that screen looks right, feels right, and matches design intent.
