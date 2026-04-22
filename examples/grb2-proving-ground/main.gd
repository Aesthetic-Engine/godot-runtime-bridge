extends Control

var current_state := "title"
var counter := 0
var theme_mode := "blue"
var panel_open := false
var banner_visible := false

var background: ColorRect
var title_label: Label
var subtitle_label: Label
var state_label: Label
var counter_label: Label
var theme_label: Label
var panel_label: Label
var banner_label: Label
var proof_panel: PanelContainer


func _ready() -> void:
	_build_ui()
	_apply_state()
	_register_grb_commands()


func _build_ui() -> void:
	background = ColorRect.new()
	background.name = "Background"
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	var margin := MarginContainer.new()
	margin.name = "LayoutMargin"
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 48)
	margin.add_theme_constant_override("margin_right", 48)
	margin.add_theme_constant_override("margin_top", 36)
	margin.add_theme_constant_override("margin_bottom", 36)
	add_child(margin)

	var rows := VBoxContainer.new()
	rows.name = "Content"
	rows.add_theme_constant_override("separation", 18)
	margin.add_child(rows)

	title_label = Label.new()
	title_label.name = "TitleLabel"
	title_label.text = "GRB 2.0 Proving Ground"
	title_label.add_theme_font_size_override("font_size", 34)
	rows.add_child(title_label)

	subtitle_label = Label.new()
	subtitle_label.name = "SubtitleLabel"
	subtitle_label.text = "Deterministic proof surfaces for boot, transition, and panel checks."
	subtitle_label.add_theme_font_size_override("font_size", 18)
	rows.add_child(subtitle_label)

	var hud := GridContainer.new()
	hud.name = "HudGrid"
	hud.columns = 2
	hud.add_theme_constant_override("h_separation", 32)
	hud.add_theme_constant_override("v_separation", 8)
	rows.add_child(hud)

	state_label = _hud_label("StateLabel")
	counter_label = _hud_label("CounterLabel")
	theme_label = _hud_label("ThemeLabel")
	panel_label = _hud_label("PanelLabel")
	hud.add_child(state_label)
	hud.add_child(counter_label)
	hud.add_child(theme_label)
	hud.add_child(panel_label)

	banner_label = Label.new()
	banner_label.name = "CompareBanner"
	banner_label.text = "COMPARE BANNER: hidden"
	banner_label.add_theme_font_size_override("font_size", 20)
	rows.add_child(banner_label)

	var buttons := HBoxContainer.new()
	buttons.name = "ActionButtons"
	buttons.add_theme_constant_override("separation", 12)
	rows.add_child(buttons)

	var enter_button := Button.new()
	enter_button.name = "EnterLabButton"
	enter_button.text = "Enter Lab"
	enter_button.pressed.connect(_enter_lab)
	buttons.add_child(enter_button)

	var panel_button := Button.new()
	panel_button.name = "TogglePanelButton"
	panel_button.text = "Toggle Panel"
	panel_button.pressed.connect(_toggle_panel)
	buttons.add_child(panel_button)

	var reset_button := Button.new()
	reset_button.name = "ResetButton"
	reset_button.text = "Reset"
	reset_button.pressed.connect(_reset)
	buttons.add_child(reset_button)

	proof_panel = PanelContainer.new()
	proof_panel.name = "ProofPanel"
	rows.add_child(proof_panel)

	var panel_margin := MarginContainer.new()
	panel_margin.name = "ProofPanelMargin"
	panel_margin.add_theme_constant_override("margin_left", 18)
	panel_margin.add_theme_constant_override("margin_right", 18)
	panel_margin.add_theme_constant_override("margin_top", 14)
	panel_margin.add_theme_constant_override("margin_bottom", 14)
	proof_panel.add_child(panel_margin)

	var panel_text := Label.new()
	panel_text.name = "ProofPanelText"
	panel_text.text = "PANEL OPEN: runtime and screenshot evidence should both show this panel."
	panel_text.add_theme_font_size_override("font_size", 18)
	panel_margin.add_child(panel_text)


func _hud_label(node_name: String) -> Label:
	var label := Label.new()
	label.name = node_name
	label.add_theme_font_size_override("font_size", 20)
	return label


func _register_grb_commands() -> void:
	var registry := get_node_or_null("/root/GRBCommands")
	if registry == null:
		return
	registry.register("pg_state", Callable(self, "grb_pg_state"))
	registry.register("pg_enter_lab", Callable(self, "grb_pg_enter_lab"))
	registry.register("pg_toggle_panel", Callable(self, "grb_pg_toggle_panel"))
	registry.register("pg_reset", Callable(self, "grb_pg_reset"))


func _enter_lab() -> void:
	current_state = "lab"
	counter += 1
	banner_visible = true
	_apply_state()


func _toggle_panel() -> void:
	panel_open = !panel_open
	counter += 1
	_apply_state()


func _reset() -> void:
	current_state = "title"
	counter = 0
	theme_mode = "blue"
	panel_open = false
	banner_visible = false
	_apply_state()


func _apply_state() -> void:
	var title_color := Color(0.08, 0.16, 0.26)
	var lab_color := Color(0.10, 0.24, 0.16)
	background.color = lab_color if current_state == "lab" else title_color
	state_label.text = "STATE: %s" % current_state
	counter_label.text = "COUNTER: %d" % counter
	theme_label.text = "THEME: %s" % theme_mode
	panel_label.text = "PANEL: %s" % ("open" if panel_open else "closed")
	banner_label.text = "COMPARE BANNER: visible" if banner_visible else "COMPARE BANNER: hidden"
	banner_label.visible = banner_visible
	proof_panel.visible = panel_open


func grb_pg_state() -> Dictionary:
	return {
		"state": current_state,
		"counter": counter,
		"theme": theme_mode,
		"panel_open": panel_open,
		"banner_visible": banner_visible
	}


func grb_pg_enter_lab() -> Dictionary:
	_enter_lab()
	return grb_pg_state()


func grb_pg_toggle_panel() -> Dictionary:
	_toggle_panel()
	return grb_pg_state()


func grb_pg_reset() -> Dictionary:
	_reset()
	return grb_pg_state()
