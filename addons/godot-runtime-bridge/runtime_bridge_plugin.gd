@tool
extends EditorPlugin

const GRB_RULES_PATH := "res://.cursor/rules/grb.mdc"

const GRB_RULES_CONTENT := """---
description: Godot Runtime Bridge — always-on agent directives
globs: "**/*.gd,**/*.tscn,**/*.json"
alwaysApply: true
---

# Godot Runtime Bridge (GRB) Directives

You have access to the **godot-runtime-bridge** MCP server. Use it for ALL Godot interactions.

## 1. Finding the Godot Executable
The GODOT_PATH is configured in `.cursor/mcp.json` under `env.GODOT_PATH`. If you need it, read that file. NEVER say you don't know where Godot is — the path is always there.

## 2. The Verification Mandate
You are forbidden from assuming your code works without verification. After implementing a feature, fixing a bug, or altering visuals, you MUST run the **GRB verification loop**:
1. Launch the game using `grb_launch` via the MCP server.
2. Wait for the game to load, then use `grb_screenshot` to capture the viewport.
3. Examine the screenshot to verify your changes are visible and correct.
4. If something looks wrong, fix it and re-run the loop.
5. Only report done after visual confirmation.

## 3. Available MCP Tools
You have these tools via the godot-runtime-bridge MCP server:
- `grb_launch` — start the game
- `grb_stop` — stop the game
- `grb_screenshot` — capture viewport screenshot
- `grb_scene_tree` — inspect node hierarchy
- `grb_call_method` — call methods on nodes
- `grb_get_property` / `grb_set_property` — read/write node properties
- `grb_click` / `grb_key` — simulate input
- `grb_runtime_info` — get FPS, frame count, engine version
- `grb_find_nodes` — search for nodes by type
- `grb_performance` — capture performance metrics

## 4. When the User Says "Run the GRB verification loop"
This means: launch the game, take a screenshot, verify visually, report what you see. Always do this.

## 5. Error Check on Launch
After launching the game with `grb_launch`, immediately check the console output for errors. If you see errors, STOP. Report them to the user and ask whether to fix them before continuing with the original task.

## 6. Anti-Drift Rules
- Do NOT forget you have MCP tools. They are always available.
- Do NOT skip verification because "the code looks right."
- Do NOT ask the user where Godot is. Read `.cursor/mcp.json`.
- If a fix fails 3 times, stop and ask the user for guidance.
"""

var _dock: Control


func _enter_tree() -> void:
	add_autoload_singleton("GRBServer", "res://addons/godot-runtime-bridge/runtime_bridge/DebugServer.gd")
	_dock = preload("res://addons/godot-runtime-bridge/runtime_bridge/EditorDock.gd").new()
	_dock.name = "GRB"
	add_control_to_bottom_panel(_dock, "Runtime Bridge")
	_ensure_cursor_rules()


func _exit_tree() -> void:
	remove_autoload_singleton("GRBServer")
	if _dock:
		remove_control_from_bottom_panel(_dock)
		_dock.queue_free()
		_dock = null


func _ensure_cursor_rules() -> void:
	if FileAccess.file_exists(GRB_RULES_PATH):
		return
	var dir_path := GRB_RULES_PATH.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		DirAccess.make_dir_recursive_absolute(dir_path)
	var f := FileAccess.open(GRB_RULES_PATH, FileAccess.WRITE)
	if f:
		f.store_string(GRB_RULES_CONTENT)
		f.close()
		print("[GRB] Created Cursor rules at %s" % GRB_RULES_PATH)
