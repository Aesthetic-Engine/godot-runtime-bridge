@tool
extends EditorPlugin

var _dock: Control


func _enter_tree() -> void:
	add_autoload_singleton("GRBServer", "res://addons/godot-runtime-bridge/runtime_bridge/DebugServer.gd")
	_dock = preload("res://addons/godot-runtime-bridge/runtime_bridge/EditorDock.gd").new()
	_dock.name = "GRB"
	add_control_to_bottom_panel(_dock, "Runtime Bridge")


func _exit_tree() -> void:
	remove_autoload_singleton("GRBServer")
	if _dock:
		remove_control_from_bottom_panel(_dock)
		_dock.queue_free()
		_dock = null
