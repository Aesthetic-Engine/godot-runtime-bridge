@tool
extends VBoxContainer

const _Commands := preload("res://addons/godot-runtime-bridge/runtime_bridge/Commands.gd")

const VERSION := "2.0.2"
const SCREENSHOTS_DIR := "res://debug/screenshots"
const GRB_COMMANDS_AUTOLOAD_PATH := "res://addons/godot-runtime-bridge/runtime_bridge/GRBCommands.gd"

const GRB_TESTING_RULE := """When testing with GRB:
- After any visual change, take a screenshot (grb_screenshot) and verify the result before reporting done.
- After launch, check grb_get_errors before continuing.
- Prefer grb_reset instead of ad-hoc relaunch logic when a session goes stale.
- If a fix fails 3 times in a row, stop and ask the user for guidance instead of retrying."""

# Cursor-specific rules support is opt-in. Enabling the plugin never writes
# these files automatically — only the explicit dock action below does.
const GRB_CURSOR_RULES_PATH := "res://.cursor/rules/grb.mdc"
const GRB_CURSOR_RULES_CONTENT := """---
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
- `grb_connect` — connect to an already-running GRB session
- `grb_screenshot` — capture viewport screenshot
- `grb_scene_tree` — inspect node hierarchy
- `grb_call_method` — call methods on nodes
- `grb_get_property` / `grb_set_property` — read/write node properties
- `grb_click` / `grb_key` / `grb_drag` / `grb_scroll` / `grb_gesture` / `grb_gamepad` — simulate input
- `grb_runtime_info` — get FPS, frame count, engine version
- `grb_get_errors` — inspect engine/runtime errors
- `grb_wait_for` — wait for property/state changes
- `grb_capabilities` — inspect available commands at the current tier
- `grb_quit` / `grb_reset` — stop or cleanly relaunch the game
- `grb_audio_state` / `grb_network_state` — inspect runtime subsystems
- `grb_find_nodes` — search for nodes by name, type, or group
- `grb_performance` — capture performance metrics
- `grb_run_custom_command` — call project-registered hooks via `GRBCommands`

## 4. When the User Says "Run the GRB verification loop"
This means: launch the game, take a screenshot, verify visually, report what you see. Always do this.

## 5. Error Check on Launch
After launching the game with `grb_launch`, immediately check the console output for errors. If you see errors, STOP. Report them to the user and ask whether to fix them before continuing with the original task.

## 6. Anti-Drift Rules
- Do NOT forget you have MCP tools. They are always available.
- Do NOT skip verification because "the code looks right."
- Do NOT ask the user where Godot is. Read `.cursor/mcp.json`.
- Prefer `grb_reset` over ad-hoc relaunch logic when the session looks stale.
- If a fix fails 3 times, stop and ask the user for guidance.
"""

const CUSTOM_COMMAND_SNIPPET := """# Add as an autoload or call from your game's bootstrap.
func _ready() -> void:
\tif has_node("/root/GRBCommands"):
\t\tGRBCommands.register("smoke_test", func() -> Dictionary:
\t\t\treturn {"ok": true, "scene": get_tree().current_scene.name}
\t\t)
"""

var _content: VBoxContainer
var _clear_btn: Button
var _runtime_status_label: Label
var _grb_commands_action_btn: Button
var _grb_commands_help_label: Label
var _cursor_rules_status_label: Label
var _cursor_rules_action_btn: Button

# Mission prompt buttons
var _mission_section: VBoxContainer
var _autofix_toggle: CheckButton
var _mission_data: Array = []


func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	custom_minimum_size.y = 300

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)

	_content = VBoxContainer.new()
	_content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_content)

	_build_header()
	_build_quickstart()
	_build_runtime_status()
	_build_agent_settings()
	_build_mission_dashboard()


func _build_header() -> void:
	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)

	var title := Label.new()
	title.text = "Godot Runtime Bridge v%s" % VERSION
	title.add_theme_font_size_override("font_size", 15)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)

	var docs_btn := Button.new()
	docs_btn.text = "Protocol"
	docs_btn.tooltip_text = "Open PROTOCOL.md — full command reference and wire format"
	docs_btn.pressed.connect(_on_docs_pressed.bind("PROTOCOL.md"))
	header.add_child(docs_btn)

	var sec_btn := Button.new()
	sec_btn.text = "Security"
	sec_btn.tooltip_text = "Open SECURITY.md — threat model, tiers, and safety defaults"
	sec_btn.pressed.connect(_on_docs_pressed.bind("SECURITY.md"))
	header.add_child(sec_btn)

	_content.add_child(header)
	_content.add_child(HSeparator.new())


const CURSOR_SETUP_PROMPT := "Set up the Godot Runtime Bridge (GRB) for this project. Install the addon if missing, create .cursor/mcp.json with the GRB MCP server (args: path to godot-runtime-bridge/mcp/index.js), add GODOT_PATH to env with the path to my Godot executable — search common locations or ask me. Run npm install in the mcp folder if needed. Tell me when done."


func _build_quickstart() -> void:
	var heading := Label.new()
	heading.text = "Connect Cursor to this project"
	heading.add_theme_font_size_override("font_size", 13)
	_content.add_child(heading)

	var first_time := Label.new()
	first_time.text = "If you haven't connected before, paste this into Cursor Agent mode:"
	first_time.add_theme_font_size_override("font_size", 11)
	first_time.add_theme_color_override("font_color", Color(0.75, 0.75, 0.75))
	first_time.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(first_time)

	var prompt_row := HBoxContainer.new()
	prompt_row.add_theme_constant_override("separation", 6)

	var prompt_box := TextEdit.new()
	prompt_box.text = CURSOR_SETUP_PROMPT
	prompt_box.editable = false
	prompt_box.custom_minimum_size = Vector2(0, 52)
	prompt_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	prompt_box.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	prompt_row.add_child(prompt_box)

	var copy_btn := Button.new()
	copy_btn.text = "Copy"
	copy_btn.tooltip_text = "Copy prompt to clipboard"
	copy_btn.pressed.connect(func() -> void:
		DisplayServer.clipboard_set(CURSOR_SETUP_PROMPT)
		copy_btn.text = "Copied!"
		get_tree().create_timer(1.5).timeout.connect(func() -> void:
			if is_instance_valid(copy_btn):
				copy_btn.text = "Copy"
		)
	)
	prompt_row.add_child(copy_btn)

	_content.add_child(prompt_row)

	var already := Label.new()
	already.text = "If you have connected before: ensure godot-runtime-bridge is enabled in Cursor Settings > Tools & MCP > Installed MCP Servers, then open your project folder in Cursor and tell Cursor to connect to Godot via GRB to begin."
	already.add_theme_font_size_override("font_size", 11)
	already.add_theme_color_override("font_color", Color(0.65, 0.65, 0.65))
	already.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(already)

	_content.add_child(HSeparator.new())




func _on_docs_pressed(filename: String) -> void:
	var path := "res://addons/godot-runtime-bridge/%s" % filename
	var abs_path := ProjectSettings.globalize_path(path)
	OS.shell_open(abs_path)


func _build_runtime_status() -> void:
	_content.add_child(HSeparator.new())

	var heading := Label.new()
	heading.text = "Install and hook status"
	heading.add_theme_font_size_override("font_size", 13)
	_content.add_child(heading)

	_runtime_status_label = Label.new()
	_runtime_status_label.add_theme_font_size_override("font_size", 11)
	_runtime_status_label.add_theme_color_override("font_color", Color(0.72, 0.72, 0.72))
	_runtime_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(_runtime_status_label)

	var hook_heading := Label.new()
	hook_heading.text = "Opt-in custom command hook"
	hook_heading.add_theme_font_size_override("font_size", 12)
	_content.add_child(hook_heading)

	_grb_commands_help_label = Label.new()
	_grb_commands_help_label.add_theme_font_size_override("font_size", 11)
	_grb_commands_help_label.add_theme_color_override("font_color", Color(0.68, 0.68, 0.68))
	_grb_commands_help_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(_grb_commands_help_label)

	var hook_row := HBoxContainer.new()
	hook_row.add_theme_constant_override("separation", 6)

	_grb_commands_action_btn = Button.new()
	_grb_commands_action_btn.pressed.connect(_on_enable_grb_commands_pressed)
	hook_row.add_child(_grb_commands_action_btn)

	var hook_box := TextEdit.new()
	hook_box.text = CUSTOM_COMMAND_SNIPPET
	hook_box.editable = false
	hook_box.custom_minimum_size = Vector2(0, 84)
	hook_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hook_box.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	hook_row.add_child(hook_box)

	var copy_hook_btn := Button.new()
	copy_hook_btn.text = "Copy hook"
	copy_hook_btn.tooltip_text = "Copy a GRBCommands registration snippet"
	copy_hook_btn.pressed.connect(func() -> void:
		DisplayServer.clipboard_set(CUSTOM_COMMAND_SNIPPET)
		copy_hook_btn.text = "Copied!"
		get_tree().create_timer(1.5).timeout.connect(func() -> void:
			if is_instance_valid(copy_hook_btn):
				copy_hook_btn.text = "Copy hook"
		)
	)
	hook_row.add_child(copy_hook_btn)

	_content.add_child(hook_row)
	_refresh_runtime_status()


func _build_agent_settings() -> void:
	_content.add_child(HSeparator.new())

	var heading := Label.new()
	heading.text = "Testing guidance for Cursor"
	heading.add_theme_font_size_override("font_size", 13)
	_content.add_child(heading)

	var guide := Label.new()
	guide.text = "Add this to your .cursor/rules so Cursor knows how to test: after visual changes, take a screenshot and verify before reporting done; if a fix fails 3 times, ask the user for guidance."
	guide.add_theme_font_size_override("font_size", 11)
	guide.add_theme_color_override("font_color", Color(0.7, 0.7, 0.7))
	guide.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(guide)

	var rule_row := HBoxContainer.new()
	rule_row.add_theme_constant_override("separation", 6)

	var rule_box := TextEdit.new()
	rule_box.text = GRB_TESTING_RULE
	rule_box.editable = false
	rule_box.custom_minimum_size = Vector2(0, 48)
	rule_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rule_box.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY
	rule_row.add_child(rule_box)

	var copy_rule_btn := Button.new()
	copy_rule_btn.text = "Copy rule"
	copy_rule_btn.tooltip_text = "Copy to paste into .cursor/rules/grb.mdc"
	copy_rule_btn.pressed.connect(func() -> void:
		DisplayServer.clipboard_set("# GRB Testing\n\n" + GRB_TESTING_RULE)
		copy_rule_btn.text = "Copied!"
		get_tree().create_timer(1.5).timeout.connect(func() -> void:
			if is_instance_valid(copy_rule_btn):
				copy_rule_btn.text = "Copy rule"
		)
	)
	rule_row.add_child(copy_rule_btn)

	_content.add_child(rule_row)

	var rules_file_heading := Label.new()
	rules_file_heading.text = "Install Cursor rules file (optional, Cursor-specific)"
	rules_file_heading.add_theme_font_size_override("font_size", 12)
	_content.add_child(rules_file_heading)

	_cursor_rules_status_label = Label.new()
	_cursor_rules_status_label.add_theme_font_size_override("font_size", 11)
	_cursor_rules_status_label.add_theme_color_override("font_color", Color(0.68, 0.68, 0.68))
	_cursor_rules_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(_cursor_rules_status_label)

	var rules_action_row := HBoxContainer.new()
	rules_action_row.add_theme_constant_override("separation", 6)

	_cursor_rules_action_btn = Button.new()
	_cursor_rules_action_btn.pressed.connect(_on_install_cursor_rules_pressed)
	rules_action_row.add_child(_cursor_rules_action_btn)

	_content.add_child(rules_action_row)
	_refresh_cursor_rules_status()

	var clear_row := HBoxContainer.new()
	clear_row.add_theme_constant_override("separation", 6)

	var open_btn := Button.new()
	open_btn.text = "Open Screenshot Folder"
	open_btn.tooltip_text = "Open debug/screenshots/ in your file manager"
	open_btn.pressed.connect(_on_open_screenshots_folder)
	clear_row.add_child(open_btn)

	_clear_btn = Button.new()
	_clear_btn.text = "Clear Screenshots"
	_clear_btn.tooltip_text = "Delete all screenshot files from debug/screenshots/"
	_clear_btn.pressed.connect(_on_clear_screenshots)
	clear_row.add_child(_clear_btn)
	_content.add_child(clear_row)


func _read_cursor_rules_text() -> String:
	if not FileAccess.file_exists(GRB_CURSOR_RULES_PATH):
		return ""
	var f := FileAccess.open(GRB_CURSOR_RULES_PATH, FileAccess.READ)
	if f == null:
		return ""
	var t := f.get_as_text()
	f.close()
	return t


func _cursor_rules_state() -> String:
	if not FileAccess.file_exists(GRB_CURSOR_RULES_PATH):
		return "absent"
	if _read_cursor_rules_text() == GRB_CURSOR_RULES_CONTENT:
		return "fresh"
	return "stale"


func _refresh_cursor_rules_status() -> void:
	if _cursor_rules_status_label == null or _cursor_rules_action_btn == null:
		return
	match _cursor_rules_state():
		"absent":
			_cursor_rules_status_label.text = "Cursor rules file is NOT installed. Click to write %s with the GRB verification loop and anti-drift directives. Only needed if you use Cursor." % GRB_CURSOR_RULES_PATH
			_cursor_rules_action_btn.text = "Install Cursor rules"
			_cursor_rules_action_btn.disabled = false
			_cursor_rules_action_btn.tooltip_text = "Write the GRB-shipped Cursor rules file to %s." % GRB_CURSOR_RULES_PATH
		"fresh":
			_cursor_rules_status_label.text = "Cursor rules file is up to date at %s." % GRB_CURSOR_RULES_PATH
			_cursor_rules_action_btn.text = "Cursor rules up to date"
			_cursor_rules_action_btn.disabled = true
			_cursor_rules_action_btn.tooltip_text = "The installed Cursor rules match the version shipped with this GRB."
		"stale":
			_cursor_rules_status_label.text = "Cursor rules file at %s differs from the version shipped with this GRB. Refresh to overwrite with the current rules, or ignore to keep your customizations." % GRB_CURSOR_RULES_PATH
			_cursor_rules_action_btn.text = "Refresh Cursor rules"
			_cursor_rules_action_btn.disabled = false
			_cursor_rules_action_btn.tooltip_text = "Overwrite %s with the GRB-shipped Cursor rules content." % GRB_CURSOR_RULES_PATH


func _on_install_cursor_rules_pressed() -> void:
	var dir_path := GRB_CURSOR_RULES_PATH.get_base_dir()
	if not DirAccess.dir_exists_absolute(dir_path):
		var mk_err := DirAccess.make_dir_recursive_absolute(dir_path)
		if mk_err != OK:
			push_warning("GRB: could not create %s (%s)" % [dir_path, error_string(mk_err)])
			return
	var f := FileAccess.open(GRB_CURSOR_RULES_PATH, FileAccess.WRITE)
	if f == null:
		push_warning("GRB: could not open %s for write" % GRB_CURSOR_RULES_PATH)
		return
	f.store_string(GRB_CURSOR_RULES_CONTENT)
	f.close()
	print("[GRB] Wrote Cursor rules to %s" % GRB_CURSOR_RULES_PATH)
	_refresh_cursor_rules_status()


func _on_open_screenshots_folder() -> void:
	if not DirAccess.dir_exists_absolute(SCREENSHOTS_DIR):
		DirAccess.make_dir_recursive_absolute(SCREENSHOTS_DIR)
	var gdignore_path := SCREENSHOTS_DIR.path_join(".gdignore")
	if not FileAccess.file_exists(gdignore_path):
		var f := FileAccess.open(gdignore_path, FileAccess.WRITE)
		if f:
			f.close()
	OS.shell_open(ProjectSettings.globalize_path(SCREENSHOTS_DIR))


func _normalize_autoload_value(value: Variant) -> String:
	return String(value).trim_prefix("*")


func _has_grb_commands_autoload() -> bool:
	return _normalize_autoload_value(ProjectSettings.get_setting("autoload/GRBCommands", "")) == GRB_COMMANDS_AUTOLOAD_PATH


func _refresh_runtime_status() -> void:
	if _runtime_status_label == null:
		return
	var grb_server_status := "managed by plugin"
	var raw_grb_commands_value := String(ProjectSettings.get_setting("autoload/GRBCommands", ""))
	var normalized_grb_commands_value := _normalize_autoload_value(raw_grb_commands_value)
	var grb_commands_status := "missing"
	if normalized_grb_commands_value == GRB_COMMANDS_AUTOLOAD_PATH:
		grb_commands_status = "configured"
	elif not normalized_grb_commands_value.is_empty():
		grb_commands_status = "custom path: %s" % normalized_grb_commands_value
	_runtime_status_label.text = "GRBServer autoload: %s\nGRBCommands autoload: %s" % [grb_server_status, grb_commands_status]
	if _grb_commands_action_btn:
		var configured := normalized_grb_commands_value == GRB_COMMANDS_AUTOLOAD_PATH
		var has_custom_path := not normalized_grb_commands_value.is_empty() and not configured
		if configured:
			_grb_commands_action_btn.text = "GRBCommands Enabled"
			_grb_commands_action_btn.disabled = true
			_grb_commands_action_btn.tooltip_text = "The recommended GRBCommands autoload is already enabled."
		elif has_custom_path:
			_grb_commands_action_btn.text = "Custom GRBCommands Configured"
			_grb_commands_action_btn.disabled = true
			_grb_commands_action_btn.tooltip_text = "A custom GRBCommands autoload already exists. GRB will use that path."
		else:
			_grb_commands_action_btn.text = "Enable GRBCommands"
			_grb_commands_action_btn.disabled = false
			_grb_commands_action_btn.tooltip_text = "Adds the optional GRBCommands autoload used by grb_run_custom_command."
	if _grb_commands_help_label:
		if _has_grb_commands_autoload():
			_grb_commands_help_label.text = "GRBCommands is enabled. Register project-specific helpers, then call them with grb_run_custom_command."
		else:
			_grb_commands_help_label.text = "Enable GRBCommands to expose project-specific helpers through grb_run_custom_command."


func _on_enable_grb_commands_pressed() -> void:
	if _has_grb_commands_autoload():
		_refresh_runtime_status()
		return
	ProjectSettings.set_setting("autoload/GRBCommands", "*" + GRB_COMMANDS_AUTOLOAD_PATH)
	var save_err := ProjectSettings.save()
	if save_err != OK:
		push_warning("GRB: failed to save GRBCommands autoload (%s)" % error_string(save_err))
		return
	_refresh_runtime_status()


func _on_clear_screenshots() -> void:
	var dir := DirAccess.open(SCREENSHOTS_DIR)
	if dir == null:
		return
	var count := 0
	dir.list_dir_begin()
	var fname := dir.get_next()
	while fname != "":
		if not dir.current_is_dir() and fname.ends_with(".png"):
			dir.remove(fname)
			count += 1
		fname = dir.get_next()
	dir.list_dir_end()
	_clear_btn.text = "Cleared %d!" % count
	get_tree().create_timer(1.5).timeout.connect(func() -> void:
		if is_instance_valid(_clear_btn):
			_clear_btn.text = "Clear Screenshots"
	)


# ── Mission Dashboard ──

const MISSIONS_REL := "missions"


func _resolve_missions_dir() -> String:
	var project_root := ProjectSettings.globalize_path("res://")
	var parent := path_join(project_root, "..")
	# Sibling-folder fallbacks resolve when this addon is installed inside a
	# Godot project that lives next to a GRB clone. Both clone-name shapes are
	# accepted: `godot-runtime-bridge` is what `git clone` produces (canonical),
	# `grb-main` is what GitHub's "Download ZIP" extracts to (archive shape).
	var json_candidates: PackedStringArray = [
		path_join(project_root, MISSIONS_REL, "missions.json"),
		path_join(parent, MISSIONS_REL, "missions.json"),
		path_join(project_root, "missions", "missions.json"),
		path_join(path_join(parent, "godot-runtime-bridge"), "missions", "missions.json"),
		path_join(path_join(parent, "grb-main"), "missions", "missions.json"),
	]
	for p in json_candidates:
		if FileAccess.file_exists(p):
			return p.get_base_dir()
	return ""


func _build_mission_dashboard() -> void:
	_content.add_child(HSeparator.new())

	var heading_row := HBoxContainer.new()
	heading_row.add_theme_constant_override("separation", 8)

	var heading := Label.new()
	heading.text = "Missions — click to copy prompt, paste into Cursor"
	heading.add_theme_font_size_override("font_size", 13)
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading_row.add_child(heading)

	_autofix_toggle = CheckButton.new()
	_autofix_toggle.text = "Fix bugs automatically"
	_autofix_toggle.button_pressed = false
	_autofix_toggle.tooltip_text = "ON: Cursor fixes bugs it finds. OFF: Cursor produces a report only."
	heading_row.add_child(_autofix_toggle)

	_content.add_child(heading_row)

	var desc := Label.new()
	desc.text = "Click to copy prompt for Cursor, then paste into Cursor Agent chat."
	desc.add_theme_font_size_override("font_size", 11)
	desc.add_theme_color_override("font_color", Color(0.65, 0.65, 0.65))
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(desc)

	_mission_section = VBoxContainer.new()
	_mission_section.add_theme_constant_override("separation", 2)
	_mission_section.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_content.add_child(_mission_section)

	_load_missions()


func path_join(a: String, b: String, c: String = "") -> String:
	var p := a.path_join(b)
	if c != "":
		p = p.path_join(c)
	return p


func _load_missions() -> void:
	var missions_dir := _resolve_missions_dir()
	if missions_dir.is_empty():
		var lbl := Label.new()
		lbl.text = "missions.json not found"
		lbl.add_theme_color_override("font_color", Color(0.7, 0.5, 0.5))
		_mission_section.add_child(lbl)
		return

	var missions_path := path_join(missions_dir, "missions.json")
	var f := FileAccess.open(missions_path, FileAccess.READ)
	if f == null:
		return

	var json := JSON.new()
	var err := json.parse(f.get_as_text())
	f.close()
	if err != OK:
		return

	_mission_data = json.data
	var grid: GridContainer = GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	for m in _mission_data:
		var id_val: String = str(m.get("id", ""))
		var name_val: String = str(m.get("name", id_val))
		var goal_val: String = str(m.get("goal", ""))

		var btn := Button.new()
		btn.text = name_val
		btn.tooltip_text = goal_val + "\n\nClick to copy prompt for Cursor, then paste into Cursor Agent chat."
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.clip_text = true
		btn.pressed.connect(_on_mission_btn_pressed.bind(btn, id_val, goal_val))
		grid.add_child(btn)

	_mission_section.add_child(grid)

	var run_all_row := HBoxContainer.new()
	run_all_row.add_theme_constant_override("separation", 6)

	var run_all_btn := Button.new()
	run_all_btn.text = "Copy: Run ALL missions"
	run_all_btn.tooltip_text = "Copy a prompt that tells Cursor to run every mission"
	run_all_btn.pressed.connect(_on_run_all_btn_pressed.bind(run_all_btn))
	run_all_row.add_child(run_all_btn)

	_mission_section.add_child(run_all_row)


func _build_mission_prompt(id_val: String, goal_val: String) -> String:
	var base := "Using the installed MCP server godot-runtime-bridge to interact with Godot, run the '%s' mission against my game. %s. Run the GRB verification loop after each step." % [id_val, goal_val]
	if _autofix_toggle.button_pressed:
		return base + " Fix any bugs."
	return base + " Do NOT fix anything. Produce a full report of all bugs found as a .md file in the project root and tell me where it is located."


func _build_all_missions_prompt() -> String:
	var ids: PackedStringArray = []
	for m in _mission_data:
		ids.append(str(m.get("id", "")))
	var base := "Using the installed MCP server godot-runtime-bridge to interact with Godot, run ALL of the following missions against my game, one by one. For each mission: run the GRB verification loop after each step."
	if _autofix_toggle.button_pressed:
		base += " Fix any bugs you find along the way."
	else:
		base += " Do NOT fix anything. Produce a full report of all bugs found as a .md file in the project root and tell me where it is located."
	return base + " Missions: " + ", ".join(ids) + "."


func _on_mission_btn_pressed(btn: Button, id_val: String, goal_val: String) -> void:
	var prompt := _build_mission_prompt(id_val, goal_val)
	DisplayServer.clipboard_set(prompt)
	var original_text := btn.text
	btn.text = "Copied!"
	get_tree().create_timer(1.5).timeout.connect(func() -> void:
		if is_instance_valid(btn):
			btn.text = original_text
	)


func _on_run_all_btn_pressed(btn: Button) -> void:
	var prompt := _build_all_missions_prompt()
	DisplayServer.clipboard_set(prompt)
	var original_text := btn.text
	btn.text = "Copied!"
	get_tree().create_timer(1.5).timeout.connect(func() -> void:
		if is_instance_valid(btn):
			btn.text = original_text
	)
