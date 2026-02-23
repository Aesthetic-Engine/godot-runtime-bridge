# Security Model — Godot Runtime Bridge

## Threat Model

The Godot Runtime Bridge runs a TCP server inside your game process. This is powerful for automation but requires careful defaults to prevent misuse.

### Risks Addressed

1. **Localhost CSRF attacks** — Malicious websites can send HTTP requests to `localhost` ports. If the debug server accepts unauthenticated commands, a website could inject input or execute arbitrary code.

2. **Unintended exposure** — If bound to `0.0.0.0` or a predictable port, the server could be accessible to other machines on the network.

3. **Arbitrary code execution** — The `eval` command can execute any GDScript expression, including file operations and OS calls.

## Security Defaults

| Protection | Default | Override |
|-----------|---------|----------|
| **Export safety** | Requires `grb` or `debug` feature tag | Server is inert in retail export presets |
| **Bind address** | `127.0.0.1` (localhost only) | Not configurable — always localhost |
| **Port** | Random (OS-assigned via port 0) | `GDRB_PORT=9999` for fixed port |
| **Authentication** | Required — cryptographic token | `GDRB_TOKEN=your_token` or auto-generated |
| **Session tier** | Tier 1 (observe + input) | `GDRB_TIER=0\|1\|2\|3` |
| **eval command** | Disabled | Requires BOTH `GDRB_ENABLE_DANGER=1` AND tier 3 auth |
| **Activation** | Off by default | Only runs when `GDRB_TOKEN` is set or `GODOT_DEBUG_SERVER=1` |
| **Input mode** | Synthetic (no OS cursor) | `GDRB_INPUT_MODE=os` for real cursor |
| **Threading** | I/O on background thread | SceneTree access on main thread only |

## Export Safety Toggle

The server requires one of these Godot feature tags to be present at runtime:

- `debug` — Present in all editor runs and debug export builds
- `editor` — Present when running inside the Godot editor
- `grb` — Custom feature tag for QA export presets

**Retail export presets will never have these features**, so the server cannot accidentally start in a build shipped to players.

### Setting up a QA Export Preset

1. In Godot, go to **Project → Export**
2. Create a new export preset (e.g. "QA Build")
3. Under **Resources → Features**, add `grb`
4. Export with this preset for internal testing
5. Your retail preset (without `grb`) will have no bridge — guaranteed

## Capability Tiers

Commands are grouped by risk level. The server rejects any command above the session tier.

| Tier | Name | Commands | Risk |
|------|------|----------|------|
| 0 | **Observe** | ping, auth_info, capabilities, screenshot, scene_tree, get_property, runtime_info, wait_for | Read-only. Cannot change game state. |
| 1 | **Input** | click, key, press_button, drag, scroll | Simulates a human player. Cannot do anything a player couldn't. |
| 2 | **Control** | set_property, call_method | Direct state manipulation. Can break game invariants. |
| 3 | **Danger** | eval | Arbitrary GDScript execution. Can access filesystem and OS. |

## Authentication Flow

1. The MCP launcher generates a random token and passes it to Godot via `GDRB_TOKEN` environment variable.
2. Godot prints `GDRB_READY:{"port":XXXXX,"token":"..."}` to stdout on startup.
3. The launcher parses this line to discover the port and confirm the token.
4. Every command (except `ping` and `auth_info`) must include the token in the request JSON.
5. Requests with missing or invalid tokens are rejected with `bad_token` error.

## The Two-Key Rule for eval

The `eval` command requires two independent conditions to be true:

1. `GDRB_ENABLE_DANGER=1` environment variable must be set at launch
2. Session tier must be 3 (set via `GDRB_TIER=3`)

This prevents accidental exposure. A developer must make a conscious, explicit decision to enable arbitrary code execution.

## Production Builds

The server requires two independent gates to activate:

1. **Feature tag gate** — `grb`, `debug`, or `editor` must be present (retail exports have none of these)
2. **Environment variable gate** — `GDRB_TOKEN` or `GODOT_DEBUG_SERVER=1` must be set

Even if a player somehow sets the environment variable, the feature tag gate blocks activation. In production builds:

- No TCP server is created
- No thread is spawned
- No port is opened
- No CPU overhead
- No network exposure

There is no need to remove the addon for release builds — it cannot activate.

## Recommendations

- **Never** set `GDRB_ENABLE_DANGER=1` in CI/CD pipelines unless absolutely necessary
- **Never** use a fixed, guessable token — let the launcher auto-generate one
- **Never** expose the debug port to the network (the server enforces `127.0.0.1` binding)
- Use the lowest tier that accomplishes your testing goals
- In CI pipelines, tier 0 (observe) is usually sufficient for screenshot-based regression testing
