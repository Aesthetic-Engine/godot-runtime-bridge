# Install GRB With a Coding Agent

This is the canonical install and upgrade contract for an AI coding agent.
Follow it when a user points you at this GRB folder and asks you to install
Godot Runtime Bridge into a Godot project.

## Required Inputs

Collect or discover these before changing files:

- `GRB_REPO`: this full GRB source folder
- `GODOT_PROJECT`: the folder containing the target `project.godot`
- `GODOT_EXE`: a Godot 4.5+ executable
- the user's coding-agent client (Cursor, Claude Code, Codex, or another MCP
  client)

If a required path cannot be discovered safely, ask for it. Do not guess a
different project.

## Safety Contract

1. Run `git status --short` in both repositories when they are Git worktrees.
   Preserve unrelated and pre-existing changes.
2. Confirm `GODOT_PROJECT/project.godot` exists before copying anything.
3. Never overwrite an entire MCP configuration file. Parse it and merge only
   the `godot-runtime-bridge` server entry, preserving other servers and
   settings.
4. If the target addon already differs from `GRB_REPO/addons/`, report the
   difference before replacing user-authored changes.
5. Do not expose tokens, credentials, or unrelated environment variables in
   generated configuration or logs.
6. Use a windowed Godot runtime with a real render context for screenshots.
   Headless Godot is only for nonvisual import/precompile checks.

## Install or Upgrade Procedure

### 1. Verify prerequisites

Verify:

- Godot is version 4.5 or later.
- Node.js is version 18 or later.
- npm is available.
- `GRB_REPO/mcp/package-lock.json` exists.

Prefer the companion `*_console` Godot executable on Windows when both GUI
and console executables are present. GRB also performs this preference at
launch time.

### 2. Install MCP dependencies

From `GRB_REPO/mcp`, run:

```text
npm ci
```

Use `npm install` only when the lockfile is absent or intentionally being
updated. Do not commit `node_modules`.

### 3. Install or update the Godot addon

Build a clean addon payload from tracked files. Do not recursively copy the
live working-tree directory, because it may contain ignored or untracked local
files. From `GRB_REPO`, run:

```text
git archive --format=zip --output <TEMP>/grb-addon.zip HEAD addons/godot-runtime-bridge
```

Extract that archive in a temporary folder, then copy the extracted directory:

```text
<TEMP>/addons/godot-runtime-bridge/
```

to:

```text
GODOT_PROJECT/addons/godot-runtime-bridge/
```

Do not copy the whole GRB repository into the Godot project. Keep MCP, CLI,
templates, and proof tooling in the stable external `GRB_REPO` folder.

Enable the `Godot Runtime Bridge` editor plugin. If editing `project.godot`
directly, merge its plugin path into the existing `[editor_plugins]` enabled
list; never replace other enabled plugins. When direct enablement is unsafe,
ask the user to enable it under Project > Project Settings > Plugins.

### 4. Merge the MCP server configuration

Use the MCP configuration surface supported by the user's client. Preserve
all existing servers. The merged server must be equivalent to:

```json
{
  "godot-runtime-bridge": {
    "command": "node",
    "args": ["<GRB_REPO>/mcp/index.js"],
    "env": {
      "GODOT_PATH": "<GODOT_EXE>"
    }
  }
}
```

Use absolute paths. On Windows, forward slashes are safest inside JSON. Add
project-specific GRB environment variables only when the project requires
them; do not copy unrelated environment state.

For Cursor, merge the entry under `mcpServers` in
`GODOT_PROJECT/.cursor/mcp.json`. For other clients, use their supported MCP
configuration or CLI and keep the same server command, argument, and Godot
environment value.

### 5. Initialize and diagnose the project

From the GRB repo root, run the platform launcher:

```text
grb.cmd init --project <GODOT_PROJECT>                 # Windows
./grb init --project <GODOT_PROJECT>                   # POSIX
```

Then run:

```text
grb.cmd doctor --project <GODOT_PROJECT> --exe <GODOT_EXE>
./grb doctor --project <GODOT_PROJECT> --exe <GODOT_EXE>
```

Fix failed readiness checks before claiming installation success. A project
that has never been opened may need one editor/import pass to create `.godot/`
metadata.

### 6. Restart or reload MCP

Tell the user to restart/reload the coding client's MCP server after a new
install or GRB tool update. Existing MCP processes do not discover new tools
from changed source files automatically. Some clients also require the user
to enable the server in their MCP settings UI.

### 7. Verify the live bridge

After MCP reload:

1. Confirm GRB tools are listed.
2. Launch the project through `grb_launch` in a normal window.
3. Call `grb_get_errors` and require zero unexpected errors.
4. Capture `grb_screenshot` and inspect it.
5. Confirm the expected project title/game appeared, not another project.
6. Quit the runtime cleanly.

Report W/R/E proof honestly:

- W: bridge ready, commands work, scene/errors are clean
- R: a real runtime screenshot or matching runtime state was captured
- E: only a human can confirm the experience feels correct

## Definition of Done

Installation is complete only when:

- the addon exists in the intended Godot project and is enabled;
- the installed addon came from the tracked-file archive, without ignored or
  untracked working-tree files;
- MCP dependencies are installed in the external GRB repo;
- the client configuration points at the absolute GRB MCP entry point;
- `grb doctor` passes or every remaining blocker is explicitly reported;
- the MCP process has been reloaded;
- a windowed live launch reaches GRB and produces a reviewed screenshot;
- unrelated worktree and MCP configuration content remains intact.

## Upgrade Notes

For an upgrade, repeat the same procedure. In particular:

- compare the installed addon before syncing it;
- run `npm ci` after pulling a new GRB revision;
- preserve client configuration and project-specific environment variables;
- restart/reload MCP so new tools become visible;
- rerun doctor and the live launch/screenshot check.

Do not claim an upgrade is active merely because the GRB source folder was
updated. The running MCP process and installed project addon must both match
the intended revision.
