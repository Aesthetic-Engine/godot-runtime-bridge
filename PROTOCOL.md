# Wire Protocol — grb/1

Newline-delimited JSON over TCP. One request per line, one response per line.

## Request Format

```json
{"id":"req_001","proto":"grb/1","cmd":"screenshot","args":{},"token":"abc123..."}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Recommended | Client-generated ID, echoed in response |
| `proto` | string | Optional | Protocol version (`grb/1`). Omit to skip version check |
| `cmd` | string | **Required** | Command name |
| `args` | object | Optional | Command-specific arguments (defaults to `{}`) |
| `token` | string | Conditional | Auth token. Required for all commands except `ping` and `auth_info` |

## Response Format

### Success

```json
{"id":"req_001","ok":true,"width":1280,"height":720,"png_base64":"iVBOR..."}
```

### Error

```json
{"id":"req_001","ok":false,"error":{"code":"tier_denied","message":"Command 'eval' requires tier 3, session tier is 1","tier_required":3}}
```

## Error Codes

| Code | Meaning |
|------|---------|
| `bad_json` | Request is not valid JSON or missing `cmd` |
| `bad_proto` | Unsupported protocol version |
| `unknown_cmd` | Command name not recognized |
| `bad_token` | Missing or invalid authentication token |
| `tier_denied` | Command requires a higher tier than the session allows |
| `danger_disabled` | `eval` called without `GDRB_ENABLE_DANGER=1` |
| `bad_args` | Missing or invalid command arguments |
| `not_found` | Node, property, or method not found |
| `internal_error` | Unexpected server-side error |

## Startup

On startup, the server prints exactly one line to stdout:

```
GDRB_READY:{"proto":"grb/1","port":54321,"token":"xK9m...","tier_default":1}
```

The MCP launcher parses this line to discover the port and token.

## Commands Reference

### Tier 0 — Observe

#### ping
No args. Returns `{"pong": true}`. Does not require token.

#### auth_info
No args. Returns session info. Does not require token.
```json
{"proto":"grb/1","tier":1,"danger_enabled":false}
```

#### capabilities
No args. Returns list of commands available at current session tier.
```json
{"tier":1,"commands":["capabilities","click","drag",...]}
```

#### screenshot
No args. Returns viewport capture.
```json
{"width":1280,"height":720,"png_base64":"iVBOR..."}
```

#### scene_tree
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `max_depth` | int | 10 | How deep to recurse |

Returns nested node tree with names and types.

#### get_property
| Arg | Type | Description |
|-----|------|-------------|
| `node` | string | NodePath (e.g. `"GameState"` or `"Main/RoomView"`) |
| `property` | string | Property name |

Returns `{"value": ...}`.

#### runtime_info
No args. Returns engine version, FPS, frame count, current scene, node count.

#### wait_for
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `node` | string | | NodePath |
| `property` | string | | Property to watch |
| `value` | any | | Expected value |
| `timeout_ms` | int | 5000 | Max wait time |

Polls each frame until `node.property == value` or timeout. Returns `{"matched": true/false, "elapsed_ms": ...}`.

#### find_nodes
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `name` | string | | Name substring to match (case-insensitive). Use `"*"` for all. |
| `type` | string | | Godot class name (e.g. `"Button"`, `"Label"`, `"Camera3D"`) |
| `group` | string | | Group name the node must belong to |
| `limit` | int | 50 | Max results |

At least one of `name`, `type`, or `group` is required. Returns `{"matches": [...], "count": N}` where each match has `name`, `type`, `path`, and `groups`.

### Tier 1 — Input

All input commands respect `GDRB_INPUT_MODE`:
- **`synthetic`** (default): injects Godot `InputEvent` objects via `Input.parse_input_event()`. Does not move the OS cursor. Tests run in the background without stealing mouse/keyboard.
- **`os`**: additionally calls `Viewport.warp_mouse()` to move the real OS cursor. Use only when a game requires OS-level cursor position (rare).

#### click
| Arg | Type | Description |
|-----|------|-------------|
| `x` | int | X coordinate |
| `y` | int | Y coordinate |

Injects mouse motion + press, release on next frame.

#### key
| Arg | Type | Description |
|-----|------|-------------|
| `action` | string | Godot input action name (e.g. `"ui_accept"`) |
| `keycode` | int | Raw keycode (e.g. `4194305` for Enter) |

Provide either `action` or `keycode`, not both.

#### press_button
| Arg | Type | Description |
|-----|------|-------------|
| `name` | string | Node name of a BaseButton in the scene tree |

Finds the button by name (recursive search) and emits its `pressed` signal.

#### drag
| Arg | Type | Description |
|-----|------|-------------|
| `from` | [x, y] | Start coordinates |
| `to` | [x, y] | End coordinates |

Press at `from`, move to `to`, release on next frame.

#### scroll
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `x` | int | 0 | Scroll position X |
| `y` | int | 0 | Scroll position Y |
| `delta` | float | -3.0 | Scroll amount (negative = down, positive = up) |

#### gamepad
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `action` | string | | `"button"`, `"axis"`, or `"vibrate"` |
| `button` | int | 0 | Joypad button index (for `"button"` action) |
| `pressed` | bool | true | Whether button is pressed |
| `axis` | int | 0 | Axis index (for `"axis"` action) |
| `value` | float | 0.0 | Axis value -1.0 to 1.0 (for `"axis"` action) |
| `device` | int | 0 | Device ID |
| `weak` | float | 0.0 | Weak vibration intensity (for `"vibrate"`) |
| `strong` | float | 0.5 | Strong vibration intensity (for `"vibrate"`) |
| `duration` | float | 0.5 | Vibration duration in seconds (for `"vibrate"`) |

For `"button"`: injects press + auto-release after 100ms. For `"axis"`: injects axis motion. For `"vibrate"`: triggers controller vibration.

### Tier 2 — Control

#### set_property
| Arg | Type | Description |
|-----|------|-------------|
| `node` | string | NodePath |
| `property` | string | Property name |
| `value` | any | New value |

#### call_method
| Arg | Type | Description |
|-----|------|-------------|
| `node` | string | NodePath |
| `method` | string | Method name |
| `args` | array | Arguments (optional, default `[]`) |

Returns `{"result": ...}`.

### Tier 3 — Danger

#### eval
| Arg | Type | Description |
|-----|------|-------------|
| `expr` | string | GDScript expression to evaluate |

Requires `GDRB_ENABLE_DANGER=1` AND tier 3. Returns `{"result": "..."}`.
