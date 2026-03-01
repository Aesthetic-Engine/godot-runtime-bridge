@tool
extends VBoxContainer

const _Commands := preload("res://addons/godot-runtime-bridge/runtime_bridge/Commands.gd")

const VERSION := "1.0.1"

const GRB_TESTING_RULE := """When testing with GRB:
- After any visual change, take a screenshot (grb_screenshot) and verify the result before reporting done.
- If a fix fails 3 times in a row, stop and ask the user for guidance instead of retrying."""

var _content: VBoxContainer

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

	var ss_label := Label.new()
	ss_label.text = "Screenshots saved to: debug/screenshots/"
	ss_label.add_theme_font_size_override("font_size", 11)
	ss_label.add_theme_color_override("font_color", Color(0.65, 0.65, 0.65))
	_content.add_child(ss_label)

	var open_btn := Button.new()
	open_btn.text = "Open Screenshot Folder"
	open_btn.tooltip_text = "Open debug/screenshots/ in your file manager"
	open_btn.pressed.connect(_on_open_screenshots_folder)
	_content.add_child(open_btn)


func _on_open_screenshots_folder() -> void:
	var ss_dir := "res://debug/screenshots"
	var abs_path := ProjectSettings.globalize_path(ss_dir)
	if not DirAccess.dir_exists_absolute(ss_dir):
		DirAccess.make_dir_recursive_absolute(ss_dir)
	var gdignore_path := ss_dir.path_join(".gdignore")
	if not FileAccess.file_exists(gdignore_path):
		var f := FileAccess.open(gdignore_path, FileAccess.WRITE)
		if f:
			f.close()
	OS.shell_open(abs_path)


# ── Mission Dashboard ──

const MISSIONS_REL := "packages/godot-runtime-bridge-mcp/missions"


func _resolve_missions_dir() -> String:
	var project_root := ProjectSettings.globalize_path("res://")
	var parent := path_join(project_root, "..")
	var json_candidates: PackedStringArray = [
		path_join(project_root, MISSIONS_REL, "missions.json"),
		path_join(parent, MISSIONS_REL, "missions.json"),
		path_join(project_root, "missions", "missions.json"),
		path_join(path_join(parent, "grb-main"), "missions", "missions.json"),
	]
	for p in json_candidates:
		if FileAccess.file_exists(p):
			return p.get_base_dir()
	return ""


func _build_mission_dashboard() -> void:
	_content.add_child(HSeparator.new())

	var heading := Label.new()
	heading.text = "Missions — click to copy prompt, paste into Cursor"
	heading.add_theme_font_size_override("font_size", 13)
	_content.add_child(heading)

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
	_autofix_toggle = CheckButton.new()
	_autofix_toggle.text = "Fix bugs automatically"
	_autofix_toggle.button_pressed = false
	_autofix_toggle.tooltip_text = "ON: Cursor fixes bugs it finds. OFF: Cursor produces a report only."
	_mission_section.add_child(_autofix_toggle)

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
