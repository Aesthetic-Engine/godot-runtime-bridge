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
| `token` | string | **Required** | Auth token. Required for all commands. |

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
| `forbidden` | Command blocked by security policy (method/property/expr allowlist) |
| `rate_limit` | Request rate exceeded (e.g. screenshot limit) |

## Startup

On startup, the server prints exactly one line to stdout:

```
GDRB_READY:{"proto":"grb/1","port":54321,"token":"xK9m...","tier_default":1}
```

The MCP launcher parses this line to discover the port and token.

The server only starts when the runtime has the `grb`, `debug`, or `editor`
feature tag and either `GDRB_TOKEN` or `GODOT_DEBUG_SERVER=1` is set. All
commands require the bearer token once the server is running.

## Commands Reference

### Tier 0 — Observe

#### ping
No args. Returns `{"pong": true}`. Requires token.

#### auth_info
No args. Returns session info. Requires token.
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

#### get_errors
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `since_index` | int | 0 | Return logged engine/runtime errors and warnings at or after this index |

Returns captured engine/runtime error state, including error and warning counts.

#### wait_for
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `node` | string | | NodePath |
| `property` | string | | Property to watch |
| `value` | any | | Expected value |
| `timeout_ms` | int | 5000 | Max wait time |

Polls each frame until `node.property == value` or timeout. Returns `{"matched": true/false, "elapsed_ms": ...}`.

#### audio_state
No args. Returns audio bus names, volumes, mute state, bus count, and mix rate.

#### network_state
No args. Returns the bridge's current network-state placeholder:
`{"multiplayer": false, "message": "no multiplayer"}`.

#### grb_performance
No args. Returns available performance counters such as FPS, process timing,
object counts, render draw calls, primitives, and video memory fields.

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

#### gesture
| Arg | Type | Default | Description |
|-----|------|---------|-------------|
| `type` | string | | `"pinch"` or `"swipe"` |
| `params.center` | [x, y] | [0, 0] | Gesture position |
| `params.scale` | float | 1.1 | Magnify factor for `"pinch"` |
| `params.delta` | [x, y] | [0, 0] | Pan delta for `"swipe"` |

Injects `InputEventMagnifyGesture` or `InputEventPanGesture`.

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

Dangerous properties such as `script` are blocked with `forbidden`.

#### call_method
| Arg | Type | Description |
|-----|------|-------------|
| `node` | string | NodePath |
| `method` | string | Method name |
| `args` | array | Arguments (optional, default `[]`) |

Returns `{"result": ...}`. Dangerous method names such as process execution,
file access helpers, and script loading helpers are blocked with `forbidden`.

#### quit
No args. Requests `get_tree().quit()` via `call_deferred` and returns a short
confirmation message.

#### run_custom_command
| Arg | Type | Description |
|-----|------|-------------|
| `name` | string | Name registered on the `GRBCommands` autoload |
| `args` | array | Optional positional arguments passed to the registered callable |

Returns `{"result": ...}`. Requires the optional `GRBCommands` autoload and a
registered command name.

### Tier 3 — Danger

#### eval
| Arg | Type | Description |
|-----|------|-------------|
| `expr` | string | GDScript expression to evaluate |

Requires `GDRB_ENABLE_DANGER=1` AND tier 3. Returns `{"result": "..."}`.
