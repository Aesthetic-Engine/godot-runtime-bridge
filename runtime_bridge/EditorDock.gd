@tool
extends VBoxContainer

const _Commands := preload("res://addons/godot-runtime-bridge/runtime_bridge/Commands.gd")

const VERSION := "0.1.0"

const TIER_TOOLTIPS := {
	0: "Observe only — take screenshots, read scene tree, inspect values, wait for conditions.",
	1: "Everything in Observe, plus click buttons, press keys, drag, and scroll. Enough for automated playtests and bug reports.",
	2: "Advanced control — everything in Playtester, plus set values and call methods directly. Useful for fast test setup that changes game state.",
}

var _tier_option: OptionButton
var _port_spin: SpinBox
var _input_option: OptionButton
var _command_label: RichTextLabel
var _copy_btn: Button
var _tier_detail: Label
var _technical_container: VBoxContainer
var _technical_toggle: CheckButton
var _content: VBoxContainer


func _ready() -> void:
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
	_build_technical_toggle()
	_update_command()
	_update_tier_detail()


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


func _build_quickstart() -> void:
	var qs_label := Label.new()
	qs_label.text = "Quickstart (60 seconds)"
	qs_label.add_theme_font_size_override("font_size", 13)
	_content.add_child(qs_label)

	# Step 1: Power level
	var step1 := HBoxContainer.new()
	step1.add_theme_constant_override("separation", 8)

	var step1_lbl := Label.new()
	step1_lbl.text = "1. Power level:"
	step1.add_child(step1_lbl)

	_tier_option = OptionButton.new()
	_tier_option.add_item("0 \u2014 Observe only", 0)
	_tier_option.add_item("1 \u2014 Playtester (recommended)", 1)
	_tier_option.add_item("2 \u2014 Advanced control", 2)
	var popup := _tier_option.get_popup()
	popup.set_item_tooltip(0, TIER_TOOLTIPS[0])
	popup.set_item_tooltip(1, TIER_TOOLTIPS[1])
	popup.set_item_tooltip(2, TIER_TOOLTIPS[2])
	_tier_option.select(1)
	_tier_option.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_tier_option.tooltip_text = "Controls what your AI tool is allowed to do. Tier 1 is enough for automated playtests and bug reports."
	_tier_option.item_selected.connect(_on_config_changed)
	step1.add_child(_tier_option)
	_content.add_child(step1)

	_tier_detail = Label.new()
	_tier_detail.add_theme_font_size_override("font_size", 11)
	_tier_detail.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	_tier_detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_content.add_child(_tier_detail)

	# Advanced options row
	var opts := HBoxContainer.new()
	opts.add_theme_constant_override("separation", 12)

	var port_lbl := Label.new()
	port_lbl.text = "    Port:"
	opts.add_child(port_lbl)

	_port_spin = SpinBox.new()
	_port_spin.min_value = 0
	_port_spin.max_value = 65535
	_port_spin.value = 0
	_port_spin.tooltip_text = "0 = random port assigned by your OS (recommended for security)"
	_port_spin.custom_minimum_size.x = 80
	_port_spin.value_changed.connect(func(_v: float) -> void: _update_command())
	opts.add_child(_port_spin)

	var input_lbl := Label.new()
	input_lbl.text = "Input:"
	opts.add_child(input_lbl)

	_input_option = OptionButton.new()
	_input_option.add_item("synthetic", 0)
	_input_option.add_item("os", 1)
	var input_popup := _input_option.get_popup()
	input_popup.set_item_tooltip(0, "Injects input inside Godot without moving your real mouse cursor. Use for background testing while you work.")
	input_popup.set_item_tooltip(1, "Moves the real OS cursor. Only needed for rare edge cases when the game requires it.")
	_input_option.select(0)
	_input_option.tooltip_text = "Synthetic: injects input inside Godot without moving your real mouse cursor. Use this for background testing.\nOS: moves the real cursor (only needed for rare edge cases)."
	_input_option.item_selected.connect(_on_config_changed)
	opts.add_child(_input_option)

	_content.add_child(opts)

	# Step 2: Launch command
	var step2_lbl := Label.new()
	step2_lbl.text = "2. Open PowerShell in your game directory, click Copy, then paste this line into the terminal and press Enter:"
	_content.add_child(step2_lbl)

	var cmd_row := HBoxContainer.new()
	cmd_row.add_theme_constant_override("separation", 6)

	_command_label = RichTextLabel.new()
	_command_label.bbcode_enabled = true
	_command_label.fit_content = true
	_command_label.scroll_active = false
	_command_label.selection_enabled = true
	_command_label.custom_minimum_size = Vector2(0, 26)
	_command_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cmd_row.add_child(_command_label)

	_copy_btn = Button.new()
	_copy_btn.text = "Copy"
	_copy_btn.tooltip_text = "Copy launch command to clipboard"
	_copy_btn.pressed.connect(_on_copy_pressed)
	cmd_row.add_child(_copy_btn)

	_content.add_child(cmd_row)

	# Step 3: Connect AI tool
	var step3_lbl := Label.new()
	step3_lbl.text = "3. Connect your AI tool:"
	_content.add_child(step3_lbl)

	var agent_row := HBoxContainer.new()
	agent_row.add_theme_constant_override("separation", 6)

	var agent_cmd := Label.new()
	agent_cmd.text = "    Any MCP-capable AI tool can drive the game. See companion package for setup."
	agent_cmd.add_theme_font_size_override("font_size", 11)
	agent_cmd.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	agent_cmd.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	agent_row.add_child(agent_cmd)

	var readme_btn := Button.new()
	readme_btn.text = "Open README"
	readme_btn.tooltip_text = "Open README.md for setup instructions"
	readme_btn.pressed.connect(_on_docs_pressed.bind("README.md"))
	agent_row.add_child(readme_btn)

	_content.add_child(agent_row)
	_content.add_child(HSeparator.new())


func _build_technical_toggle() -> void:
	_technical_toggle = CheckButton.new()
	_technical_toggle.text = "Show technical command names"
	_technical_toggle.button_pressed = false
	_technical_toggle.toggled.connect(_on_technical_toggled)
	_content.add_child(_technical_toggle)

	_technical_container = VBoxContainer.new()
	_technical_container.visible = false

	var ref := RichTextLabel.new()
	ref.bbcode_enabled = true
	ref.fit_content = true
	ref.scroll_active = false
	ref.selection_enabled = true

	var tier_labels := {
		_Commands.Tier.OBSERVE: "Observe",
		_Commands.Tier.INPUT: "Playtester",
		_Commands.Tier.CONTROL: "Advanced control",
		_Commands.Tier.DANGER: "Restricted",
	}

	var text := ""
	for tier_val: int in [_Commands.Tier.OBSERVE, _Commands.Tier.INPUT, _Commands.Tier.CONTROL, _Commands.Tier.DANGER]:
		var cmds: Array[String] = []
		for cmd_name: String in _Commands.COMMAND_TIERS:
			if _Commands.COMMAND_TIERS[cmd_name] == tier_val:
				cmds.append(cmd_name)
		cmds.sort()
		var label: String = tier_labels[tier_val]
		text += "[b]Tier %d (%s):[/b]  %s\n" % [tier_val, label, ", ".join(cmds)]

	ref.text = text
	_technical_container.add_child(ref)
	_content.add_child(_technical_container)


func _on_technical_toggled(pressed: bool) -> void:
	_technical_container.visible = pressed


func _on_config_changed(_idx: int) -> void:
	_update_command()
	_update_tier_detail()


func _update_tier_detail() -> void:
	if not is_instance_valid(_tier_option) or not is_instance_valid(_tier_detail):
		return
	var tier := _tier_option.get_selected_id()
	_tier_detail.text = "    " + TIER_TOOLTIPS.get(tier, "")


func _update_command() -> void:
	if not is_instance_valid(_tier_option):
		return
	var tier := _tier_option.get_selected_id()
	var port := int(_port_spin.value)
	var input_mode: String = _input_option.get_item_text(_input_option.selected)

	var parts: PackedStringArray = []
	parts.append("GODOT_DEBUG_SERVER=1")
	if tier != 1:
		parts.append("GDRB_TIER=%d" % tier)
	if port != 0:
		parts.append("GDRB_PORT=%d" % port)
	if input_mode != "synthetic":
		parts.append("GDRB_INPUT_MODE=%s" % input_mode)
	parts.append("godot --path <your_project>")

	var cmd := " ".join(parts)
	_command_label.text = "[code]%s[/code]" % cmd


func _on_copy_pressed() -> void:
	if not is_instance_valid(_command_label):
		return
	var cmd := _command_label.get_parsed_text()
	DisplayServer.clipboard_set(cmd)
	_copy_btn.text = "Copied!"
	get_tree().create_timer(1.5).timeout.connect(func() -> void:
		if is_instance_valid(_copy_btn):
			_copy_btn.text = "Copy"
	)


func _on_docs_pressed(filename: String) -> void:
	var path := "res://addons/godot-runtime-bridge/%s" % filename
	var abs_path := ProjectSettings.globalize_path(path)
	OS.shell_open(abs_path)
