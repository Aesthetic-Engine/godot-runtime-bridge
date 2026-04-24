# Security Model

GRB 2.0 is a security-conscious **local development bridge**, not a hardened
remote automation platform. Its defaults are designed to keep day-to-day Godot
development and proof runs reasonably bounded on a developer machine.

GRB is **not independently audited**. Do not expose it to public networks or
treat it as an enterprise deployment surface.

## Architecture and Trust Boundary

GRB currently has two linked transport layers:

1. **Agent client -> MCP helper** via stdio
2. **MCP helper -> Godot runtime** via raw localhost TCP using newline-delimited
   JSON (`grb/1`)

Today there is **no HTTP or WebSocket runtime server surface** in the Godot
bridge. The Godot-side runtime uses `TCPServer`, binds to `127.0.0.1`, and
speaks one JSON request per line / one JSON response per line over TCP.

That means GRB's main trust boundary is:

- **local machine**
- **same user account**
- **trusted MCP client / coding agent / terminal environment**

GRB is meant for local development only.

## Secure-By-Default Local Development Defaults

| Protection | Current behavior |
|---|---|
| Activation | Off by default |
| Runtime bind | `127.0.0.1` only |
| Runtime port | Random by default (`0` / OS-assigned) |
| Protocol | Raw newline-delimited JSON over TCP |
| Auth | Bearer token required on every command |
| Default session tier | Tier 1 (`input`) |
| Danger tier | `eval` disabled unless `GDRB_ENABLE_DANGER=1` and tier 3 |
| MCP transport | stdio between client and Node helper |
| Exported-build activation | Requires feature-tag gate plus activation env |

### Activation Gates

The runtime bridge only activates when **both** conditions are true:

1. Godot runtime has one of the feature tags:
   - `grb`
   - `debug`
   - `editor`
2. Launch environment provides:
   - `GDRB_TOKEN`
   - or legacy `GODOT_DEBUG_SERVER=1`

Without both gates:

- no TCP server starts
- no port opens
- no bridge thread runs
- the addon stays inert

This is why exported retail builds remain inert unless someone explicitly
creates a GRB-capable export mode.

## Current Transport and Runtime Surface

GRB 2.0 currently documents and ships:

- Godot runtime bridge in
  [`addons/godot-runtime-bridge/runtime_bridge/DebugServer.gd`](addons/godot-runtime-bridge/runtime_bridge/DebugServer.gd)
- raw `grb/1` protocol in [PROTOCOL.md](PROTOCOL.md)
- MCP helper in [`mcp/index.js`](mcp/index.js) using `StdioServerTransport`
  toward the AI client and Node `net.Socket` toward Godot

This pass does **not** add:

- TLS
- HTTP server mode
- WebSocket server mode
- Host / Origin validation
- named pipes / Unix sockets

Those are intentionally out of scope for GRB 2.0.1.

## Capability Tiers

Commands are grouped by risk:

| Tier | Purpose | Commands |
|---|---|---|
| 0 | Observe | `ping`, `auth_info`, `capabilities`, `screenshot`, `scene_tree`, `get_property`, `runtime_info`, `get_errors`, `wait_for`, `audio_state`, `network_state`, `grb_performance`, `find_nodes` |
| 1 | Input | `click`, `key`, `press_button`, `drag`, `scroll`, `gesture`, `gamepad` |
| 2 | Control | `set_property`, `call_method`, `quit`, `run_custom_command` |
| 3 | Danger | `eval` |

Tier 1 is the current default. That is enough for normal screenshot-capable
automation without opening direct mutation surfaces like `set_property`,
`call_method`, or `run_custom_command`.

## Dangerous Commands and Modes

These are the main surfaces that can break project invariants or widen trust:

- `eval`
  - arbitrary GDScript expression execution
  - requires **both** tier 3 and `GDRB_ENABLE_DANGER=1`
- `set_property`
  - direct state mutation
  - dangerous properties like `script` are blocked
- `call_method`
  - direct node method calls
  - dangerous method names are blocked, but project code still decides what a
    permitted method can do
- `run_custom_command`
  - runs project-registered command hooks
  - safety depends entirely on the game project's registered commands
- `GDRB_INPUT_MODE=os`
  - allows real OS cursor movement / OS-facing input behavior
  - use only when synthetic input is insufficient
- fixed ports via `GDRB_PORT`
  - reduce unpredictability
  - acceptable for controlled setups, but less conservative than random ports

## What GRB Does Not Protect Against

GRB does **not** protect you from:

- malicious same-user local processes on the same machine
- a compromised MCP client or compromised coding-agent environment
- a leaked local bearer token
- prompt-injected agents using IDE, terminal, shell, git, or file-edit tools
  outside GRB
- destructive source edits or shell commands performed outside the bridge
- unsafe user-created custom commands
- intentional public-network exposure through tunneling, port forwarding, or
  host firewall misconfiguration

If another local process can read your environment, files, stdout logs, IDE
state, or MCP configuration, it may be able to recover the token or act through
other local tools anyway. GRB's protections are primarily about safe defaults,
not defense against a hostile same-user local environment.

## Exports and Production-Like Builds

Current repo truth:

- addon/runtime code may ship in exports
- bridge activation is still gated
- retail exports without the right feature tags stay inert

That does **not** make GRB a public deployment surface. "Safe to ship in
production builds" here means **inert by default when not activated**, not
"safe for enterprise deployment" or "safe to expose remotely."

## Recommendations

- Keep GRB on localhost only
- Prefer random ports over fixed ports unless you truly need determinism
- Use the lowest session tier that does the job
- Leave `eval` disabled unless you explicitly need it
- Treat `run_custom_command` as project-owned code, not a trusted sandbox
- Prefer synthetic input over OS input
- Do not expose GRB to public or semi-public networks
- Read [PROTOCOL.md](PROTOCOL.md) and this file together before changing the
  transport or security posture

## Security Verification

For a lightweight static check of the current security shape:

```bash
cd mcp
npm run verify:security
```

This verifier is static only. It does **not** launch Godot. It checks a small
set of credibility-critical truths such as:

- runtime bridge still uses `TCPServer`
- bind address remains `127.0.0.1`
- protocol docs still describe newline-delimited JSON over TCP
- MCP still uses stdio plus raw TCP sockets, not HTTP/WebSocket runtime servers
- default port remains random
- default tier remains non-danger
- `eval` still needs `GDRB_ENABLE_DANGER=1`
