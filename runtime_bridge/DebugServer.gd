extends Node

const _Protocol := preload("res://addons/godot-runtime-bridge/runtime_bridge/Protocol.gd")
const _Commands := preload("res://addons/godot-runtime-bridge/runtime_bridge/Commands.gd")

## Godot Runtime Bridge — TCP debug server for automation and AI-driven testing.
##
## Activation requires BOTH:
##   1. Export feature "grb" or "debug" (prevents accidental shipping in retail builds)
##   2. GDRB_TOKEN env var set (or GODOT_DEBUG_SERVER=1 for legacy compat)
##
## Protocol: grb/1 — newline-delimited JSON. See PROTOCOL.md for details.
##
## Environment variables:
##   GDRB_TOKEN          — Auth token (auto-generated if absent but server enabled)
##   GDRB_PORT           — Fixed port (default: 0 = OS-assigned random)
##   GDRB_TIER           — Max session tier 0-3 (default: 1)
##   GDRB_ENABLE_DANGER  — Set to "1" to allow tier-3 eval (default: disabled)
##   GDRB_INPUT_MODE     — "synthetic" (default) or "os". Synthetic injects InputEvents
##                         without moving the OS cursor, so tests run in the background.
##   GDRB_FORCE_WINDOWED — Set to "1" to enforce windowed mode for ~120 frames at startup.
##                         Uses non-screen-sized dimensions to work around Godot issue #80595.
##   GODOT_DEBUG_SERVER   — Legacy: set to "1" to enable (GDRB_TOKEN preferred)
##
## Threading model:
##   Background thread handles TCP accept/read/write.
##   Parsed requests are marshalled to the main thread via a mutex-protected queue.
##   Command dispatch and SceneTree access happen exclusively on the main thread.
##   Responses are queued back to the I/O thread for writing.

var _token: String = ""
var _session_tier: int = _Commands.Tier.INPUT
var _danger_enabled: bool = false
var _input_mode: String = "synthetic"
var _active: bool = false

# Threading
var _io_thread: Thread
var _should_stop: bool = false
var _incoming_mutex: Mutex
var _incoming_queue: Array = []
var _outgoing_mutex: Mutex
var _outgoing_queue: Array = []
var _server_port: int = 0
var _bind_port: int = 0

# Main-thread state for input injection
var _pending_release: bool = false
var _release_pos: Vector2
var _release_button: int

# Async wait_for tracking
var _pending_waits: Array = []

# GDRB_FORCE_WINDOWED: enforce windowed mode for N frames to override project fullscreen settings
var _force_windowed_frames: int = 0


func _ready() -> void:
	# Gate 1: Export feature check — prevents accidental inclusion in retail builds
	if not OS.has_feature("grb") and not OS.has_feature("debug") and not OS.has_feature("editor"):
		return

	# Gate 2: Env var activation
	var token_env := OS.get_environment("GDRB_TOKEN")
	var legacy_env := OS.get_environment("GODOT_DEBUG_SERVER")
	if token_env == "" and legacy_env != "1":
		return

	if token_env != "":
		_token = token_env
	else:
		_token = _generate_token()

	var port_env := OS.get_environment("GDRB_PORT")
	if port_env != "":
		_bind_port = int(port_env)

	var tier_env := OS.get_environment("GDRB_TIER")
	if tier_env != "":
		_session_tier = clampi(int(tier_env), 0, 3)

	_danger_enabled = OS.get_environment("GDRB_ENABLE_DANGER") == "1"

	var input_env := OS.get_environment("GDRB_INPUT_MODE")
	if input_env == "os":
		_input_mode = "os"
	else:
		_input_mode = "synthetic"

	if OS.get_environment("GDRB_FORCE_WINDOWED") == "1":
		_force_windowed_frames = 1

	OS.low_processor_usage_mode = false

	_incoming_mutex = Mutex.new()
	_outgoing_mutex = Mutex.new()
	_active = true

	_io_thread = Thread.new()
	_io_thread.start(_io_thread_func)


func _enforce_windowed() -> void:
	var mode := DisplayServer.window_get_mode()
	if mode != DisplayServer.WINDOW_MODE_WINDOWED:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		var screen_size := DisplayServer.screen_get_size()
		var safe_size := Vector2i(mini(1280, screen_size.x - 1), mini(720, screen_size.y - 1))
		DisplayServer.window_set_size(safe_size)
		DisplayServer.window_set_position(Vector2i(50, 50))


func _exit_tree() -> void:
	if not _active:
		return
	_should_stop = true
	if _io_thread != null:
		_io_thread.wait_to_finish()


func _generate_token() -> String:
	var crypto := Crypto.new()
	var bytes := crypto.generate_random_bytes(24)
	var chars := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	var result := ""
	for i in range(bytes.size()):
		result += chars[bytes[i] % chars.length()]
	return result


# ── Background I/O thread ──

func _io_thread_func() -> void:
	var server := TCPServer.new()
	var err := server.listen(_bind_port, "127.0.0.1")
	if err != OK:
		push_error("GRB: failed to listen: %s" % error_string(err))
		return

	_server_port = server.get_local_port()
	var ready_data := {
		"proto": _Protocol.PROTO_VERSION,
		"port": _server_port,
		"token": _token,
		"tier_default": _session_tier,
		"input_mode": _input_mode,
	}
	# This print is parsed by the MCP launcher for port/token discovery
	print("GDRB_READY:" + JSON.stringify(ready_data))

	var stream: StreamPeerTCP = null
	var read_buffer: String = ""

	while not _should_stop:
		# Accept new connections (drop stale)
		if server.is_connection_available():
			if stream != null:
				stream.disconnect_from_host()
				read_buffer = ""
			stream = server.take_connection()

		# Poll existing connection
		if stream != null:
			stream.poll()
			if stream.get_status() != StreamPeerTCP.STATUS_CONNECTED:
				stream.disconnect_from_host()
				stream = null
				read_buffer = ""

		# Read incoming data
		if stream != null:
			var available: int = stream.get_available_bytes()
			if available > 0:
				var bytes := stream.get_data(available)
				if bytes[0] == OK:
					read_buffer += bytes[1].get_string_from_utf8()
					if read_buffer.length() > 10_000_000:
						push_warning("GRB: client exceeded max buffer size, disconnecting")
						stream.disconnect_from_host()
						stream = null
						read_buffer = ""
						continue
					while true:
						var idx: int = read_buffer.find("\n")
						if idx < 0:
							break
						var line: String = read_buffer.substr(0, idx)
						read_buffer = read_buffer.substr(idx + 1)
						if line.strip_edges() == "":
							continue
						var parsed := _Protocol.parse_request(line)
						_incoming_mutex.lock()
						_incoming_queue.append(parsed)
						_incoming_mutex.unlock()
				else:
					stream.disconnect_from_host()
					stream = null
					read_buffer = ""

		# Write queued responses
		if stream != null and stream.get_status() == StreamPeerTCP.STATUS_CONNECTED:
			_outgoing_mutex.lock()
			var to_send := _outgoing_queue.duplicate()
			_outgoing_queue.clear()
			_outgoing_mutex.unlock()
			for resp_line: String in to_send:
				stream.put_data(resp_line.to_utf8_buffer())

		OS.delay_msec(1)

	# Cleanup
	if stream != null:
		stream.disconnect_from_host()
	server.stop()


# ── Main thread: dequeue and dispatch ──

func _process(_delta: float) -> void:
	if not _active:
		return

	if _force_windowed_frames > 0:
		_force_windowed_frames -= 1
		_enforce_windowed()

	# Handle pending mouse release from previous frame
	if _pending_release:
		_inject_mouse_release(_release_pos, _release_button)
		_pending_release = false

	# Process async wait_for polls
	_poll_pending_waits()

	# Drain incoming request queue
	_incoming_mutex.lock()
	var requests := _incoming_queue.duplicate()
	_incoming_queue.clear()
	_incoming_mutex.unlock()

	for parsed: Dictionary in requests:
		if not parsed.get("valid", false):
			_enqueue_response(_Protocol.error(
				str(parsed.get("id", "")),
				str(parsed.get("error_code", "bad_json")),
				str(parsed.get("error_msg", "Parse error"))))
			continue
		_dispatch(parsed)


func _enqueue_response(resp: Dictionary) -> void:
	var line := _Protocol.serialize(resp)
	_outgoing_mutex.lock()
	_outgoing_queue.append(line)
	_outgoing_mutex.unlock()


# ── Auth + tier gating ──

func _dispatch(req: Dictionary) -> void:
	var cmd: String = req["cmd"]
	var req_id: String = req["id"]
	var args: Dictionary = req["args"]
	var token: String = req["token"]

	if not _Commands.is_known(cmd):
		_enqueue_response(_Protocol.error(req_id, "unknown_cmd", "Unknown command: " + cmd))
		return

	if not _Commands.is_token_exempt(cmd):
		if token != _token:
			_enqueue_response(_Protocol.error(req_id, "bad_token", "Invalid or missing authentication token"))
			return

	var required_tier: int = _Commands.get_tier(cmd)
	if required_tier > _session_tier:
		_enqueue_response(_Protocol.error(req_id, "tier_denied",
			"Command '%s' requires tier %d, session tier is %d" % [cmd, required_tier, _session_tier],
			{"tier_required": required_tier}))
		return

	if cmd == "eval" and not _danger_enabled:
		_enqueue_response(_Protocol.error(req_id, "danger_disabled",
			"eval requires GDRB_ENABLE_DANGER=1 environment variable"))
		return

	# wait_for is async — handled separately
	if cmd == "wait_for":
		_start_wait_for(req_id, args)
		return

	_enqueue_response(_execute(cmd, args, req_id))


# ── Command execution (main thread only) ──

func _execute(cmd: String, args: Dictionary, req_id: String) -> Dictionary:
	match cmd:
		"ping":
			return _Protocol.ok(req_id, {"pong": true})
		"auth_info":
			return _Protocol.ok(req_id, {
				"proto": _Protocol.PROTO_VERSION,
				"tier": _session_tier,
				"danger_enabled": _danger_enabled,
			})
		"capabilities":
			return _Protocol.ok(req_id, {
				"tier": _session_tier,
				"commands": _Commands.get_commands_for_tier(_session_tier),
			})
		"screenshot":
			return _cmd_screenshot(req_id)
		"scene_tree":
			return _cmd_scene_tree(req_id, int(args.get("max_depth", 10)))
		"get_property":
			return _cmd_get_property(req_id, args)
		"set_property":
			return _cmd_set_property(req_id, args)
		"call_method":
			return _cmd_call_method(req_id, args)
		"runtime_info":
			return _cmd_runtime_info(req_id)
		"click":
			return _cmd_click(req_id, int(args.get("x", 0)), int(args.get("y", 0)))
		"key":
			return _cmd_key(req_id, args)
		"press_button":
			return _cmd_press_button(req_id, str(args.get("name", "")))
		"drag":
			return _cmd_drag(req_id, args)
		"scroll":
			return _cmd_scroll(req_id, args)
		"eval":
			return _cmd_eval(req_id, str(args.get("expr", "")))
		_:
			return _Protocol.error(req_id, "unknown_cmd", "Unhandled command: " + cmd)


# ── Tier 0: Observe ──

func _cmd_screenshot(req_id: String) -> Dictionary:
	var viewport: Viewport = get_tree().root.get_viewport()
	if viewport == null:
		return _Protocol.error(req_id, "internal_error", "No viewport")
	var tex: ViewportTexture = viewport.get_texture()
	if tex == null:
		return _Protocol.error(req_id, "internal_error", "No viewport texture")
	var img: Image = tex.get_image()
	if img == null:
		return _Protocol.error(req_id, "internal_error", "get_image failed")
	var png: PackedByteArray = img.save_png_to_buffer()
	var b64: String = Marshalls.raw_to_base64(png)
	return _Protocol.ok(req_id, {"width": img.get_width(), "height": img.get_height(), "png_base64": b64})


func _cmd_scene_tree(req_id: String, max_depth: int) -> Dictionary:
	return _Protocol.ok(req_id, {"scene": _node_to_dict(get_tree().root, 0, max_depth)})


func _node_to_dict(n: Node, depth: int, max_depth: int) -> Dictionary:
	var d: Dictionary = {"name": str(n.name), "type": n.get_class()}
	if depth >= max_depth:
		d["children"] = []
		return d
	var children: Array = []
	for i in range(n.get_child_count()):
		children.append(_node_to_dict(n.get_child(i), depth + 1, max_depth))
	d["children"] = children
	return d


func _cmd_get_property(req_id: String, args: Dictionary) -> Dictionary:
	var node_path: String = str(args.get("node", ""))
	var property: String = str(args.get("property", ""))
	if node_path == "" or property == "":
		return _Protocol.error(req_id, "bad_args", "Requires 'node' and 'property'")
	var node: Node = get_tree().root.get_node_or_null(NodePath(node_path))
	if node == null:
		return _Protocol.error(req_id, "not_found", "Node not found: " + node_path)
	return _Protocol.ok(req_id, {"value": _safe_serialize(node.get(property))})


func _cmd_runtime_info(req_id: String) -> Dictionary:
	var info := {
		"engine_version": Engine.get_version_info().get("string", "unknown"),
		"fps": Engine.get_frames_per_second(),
		"process_frames": Engine.get_process_frames(),
		"time_scale": Engine.time_scale,
		"current_scene": "",
		"node_count": get_tree().root.get_child_count(),
		"input_mode": _input_mode,
	}
	var scene: Node = get_tree().current_scene
	if scene:
		info["current_scene"] = str(scene.scene_file_path)
		info["current_scene_name"] = str(scene.name)
	return _Protocol.ok(req_id, info)


# ── Tier 0: wait_for (async, polled each frame on main thread) ──

func _start_wait_for(req_id: String, args: Dictionary) -> void:
	var node_path: String = str(args.get("node", ""))
	var property: String = str(args.get("property", ""))
	var expected: Variant = args.get("value")
	var timeout_ms: int = int(args.get("timeout_ms", 5000))

	if node_path == "" or property == "":
		_enqueue_response(_Protocol.error(req_id, "bad_args", "Requires 'node', 'property', 'value'"))
		return

	var node: Node = get_tree().root.get_node_or_null(NodePath(node_path))
	if node == null:
		_enqueue_response(_Protocol.error(req_id, "not_found", "Node not found: " + node_path))
		return

	_pending_waits.append({
		"req_id": req_id,
		"node": node,
		"property": property,
		"expected": expected,
		"timeout_ms": timeout_ms,
		"start_ms": Time.get_ticks_msec(),
	})


func _poll_pending_waits() -> void:
	var i: int = _pending_waits.size() - 1
	while i >= 0:
		var w: Dictionary = _pending_waits[i]
		var node: Node = w["node"]
		if not is_instance_valid(node):
			_enqueue_response(_Protocol.error(w["req_id"], "not_found", "Node was freed during wait"))
			_pending_waits.remove_at(i)
			i -= 1
			continue

		var current: Variant = node.get(w["property"])
		var elapsed: int = Time.get_ticks_msec() - int(w["start_ms"])

		if str(current) == str(w["expected"]):
			_enqueue_response(_Protocol.ok(w["req_id"], {"matched": true, "elapsed_ms": elapsed}))
			_pending_waits.remove_at(i)
		elif elapsed >= int(w["timeout_ms"]):
			_enqueue_response(_Protocol.ok(w["req_id"], {
				"matched": false, "elapsed_ms": elapsed,
				"last_value": _safe_serialize(current)}))
			_pending_waits.remove_at(i)
		i -= 1


# ── Tier 1: Input ──

func _cmd_click(req_id: String, x: int, y: int) -> Dictionary:
	var pos := Vector2(x, y)
	if _input_mode == "os":
		var motion := InputEventMouseMotion.new()
		motion.position = pos
		motion.global_position = pos
		Input.parse_input_event(motion)
		get_viewport().warp_mouse(pos)
	_inject_mouse_press(x, y, MOUSE_BUTTON_LEFT)
	_pending_release = true
	_release_pos = pos
	_release_button = MOUSE_BUTTON_LEFT
	return _Protocol.ok(req_id)


func _inject_mouse_press(x: int, y: int, button: int) -> void:
	var e := InputEventMouseButton.new()
	e.position = Vector2(x, y)
	e.global_position = Vector2(x, y)
	e.button_index = button
	e.button_mask = MOUSE_BUTTON_MASK_LEFT if button == MOUSE_BUTTON_LEFT else 0
	e.pressed = true
	_inject_event(e)


func _inject_mouse_release(pos: Vector2, button: int) -> void:
	var e := InputEventMouseButton.new()
	e.position = pos
	e.global_position = pos
	e.button_index = button
	e.button_mask = 0
	e.pressed = false
	_inject_event(e)


## Routes input events: synthetic mode uses push_input (viewport-local, no cursor
## movement), OS mode uses parse_input_event (global, moves cursor).
func _inject_event(event: InputEvent) -> void:
	event.set_meta("_grb", true)
	if _input_mode == "synthetic":
		get_viewport().push_input(event)
	else:
		Input.parse_input_event(event)


## In synthetic mode, block real device input so the game only responds to
## GRB-injected events. Events tagged with _grb meta are allowed through.
func _input(event: InputEvent) -> void:
	if not _active or _input_mode != "synthetic":
		return
	if event.has_meta("_grb"):
		return
	if event is InputEventMouse or event is InputEventKey:
		get_viewport().set_input_as_handled()


func _cmd_key(req_id: String, args: Dictionary) -> Dictionary:
	var action: String = str(args.get("action", ""))
	var keycode: int = int(args.get("keycode", -1))
	if action != "":
		var press := InputEventAction.new()
		press.action = action
		press.pressed = true
		_inject_event(press)
		var release := InputEventAction.new()
		release.action = action
		release.pressed = false
		_inject_event(release)
	elif keycode >= 0:
		var press := InputEventKey.new()
		press.keycode = keycode
		press.pressed = true
		_inject_event(press)
		var release := InputEventKey.new()
		release.keycode = keycode
		release.pressed = false
		_inject_event(release)
	else:
		return _Protocol.error(req_id, "bad_args", "Provide 'action' or 'keycode'")
	return _Protocol.ok(req_id)


func _cmd_press_button(req_id: String, node_name: String) -> Dictionary:
	if node_name == "":
		return _Protocol.error(req_id, "bad_args", "Missing 'name'")
	var node := _find_node_recursive(get_tree().root, node_name)
	if node == null:
		return _Protocol.error(req_id, "not_found", "Node not found: " + node_name)
	if node is BaseButton:
		node.emit_signal("pressed")
		return _Protocol.ok(req_id, {"node": str(node.get_path())})
	return _Protocol.error(req_id, "bad_args", "Node is not a button: " + node.get_class())


func _cmd_drag(req_id: String, args: Dictionary) -> Dictionary:
	var from_arr: Variant = args.get("from", [0, 0])
	var to_arr: Variant = args.get("to", [0, 0])
	if not from_arr is Array or not to_arr is Array or from_arr.size() < 2 or to_arr.size() < 2:
		return _Protocol.error(req_id, "bad_args", "'from' and 'to' must be [x, y] arrays with 2 elements")
	var from := Vector2(float(from_arr[0]), float(from_arr[1]))
	var to := Vector2(float(to_arr[0]), float(to_arr[1]))

	if _input_mode == "os":
		get_viewport().warp_mouse(from)
	var motion := InputEventMouseMotion.new()
	motion.position = from
	motion.global_position = from
	_inject_event(motion)

	_inject_mouse_press(int(from.x), int(from.y), MOUSE_BUTTON_LEFT)

	if _input_mode == "os":
		get_viewport().warp_mouse(to)
	var motion2 := InputEventMouseMotion.new()
	motion2.position = to
	motion2.global_position = to
	motion2.relative = to - from
	_inject_event(motion2)

	_pending_release = true
	_release_pos = to
	_release_button = MOUSE_BUTTON_LEFT
	return _Protocol.ok(req_id)


func _cmd_scroll(req_id: String, args: Dictionary) -> Dictionary:
	var x: int = int(args.get("x", 0))
	var y: int = int(args.get("y", 0))
	var delta: float = float(args.get("delta", -3.0))
	var pos := Vector2(x, y)

	if _input_mode == "os":
		get_viewport().warp_mouse(pos)
	var button: int = MOUSE_BUTTON_WHEEL_DOWN if delta < 0 else MOUSE_BUTTON_WHEEL_UP
	var press := InputEventMouseButton.new()
	press.position = pos
	press.global_position = pos
	press.button_index = button
	press.factor = absf(delta)
	press.pressed = true
	_inject_event(press)
	var release := InputEventMouseButton.new()
	release.position = pos
	release.global_position = pos
	release.button_index = button
	release.factor = absf(delta)
	release.pressed = false
	_inject_event(release)
	return _Protocol.ok(req_id)


# ── Tier 2: Control ──

func _cmd_set_property(req_id: String, args: Dictionary) -> Dictionary:
	var node_path: String = str(args.get("node", ""))
	var property: String = str(args.get("property", ""))
	var value: Variant = args.get("value")
	if node_path == "" or property == "":
		return _Protocol.error(req_id, "bad_args", "Requires 'node', 'property', and 'value'")
	var node: Node = get_tree().root.get_node_or_null(NodePath(node_path))
	if node == null:
		return _Protocol.error(req_id, "not_found", "Node not found: " + node_path)
	node.set(property, value)
	return _Protocol.ok(req_id)


func _cmd_call_method(req_id: String, args: Dictionary) -> Dictionary:
	var node_path: String = str(args.get("node", ""))
	var method_name: String = str(args.get("method", ""))
	var method_args: Array = []
	var raw_args: Variant = args.get("args", [])
	if raw_args is Array:
		method_args = raw_args
	if node_path == "" or method_name == "":
		return _Protocol.error(req_id, "bad_args", "Requires 'node' and 'method'")
	var node: Node = get_tree().root.get_node_or_null(NodePath(node_path))
	if node == null:
		return _Protocol.error(req_id, "not_found", "Node not found: " + node_path)
	if not node.has_method(method_name):
		return _Protocol.error(req_id, "not_found", "Method not found: " + method_name)
	var result: Variant = node.callv(method_name, method_args)
	return _Protocol.ok(req_id, {"result": _safe_serialize(result)})


# ── Tier 3: Danger ──

func _cmd_eval(req_id: String, expr_str: String) -> Dictionary:
	if expr_str == "":
		return _Protocol.error(req_id, "bad_args", "Missing 'expr'")
	var expr := Expression.new()
	var err := expr.parse(expr_str)
	if err != OK:
		return _Protocol.error(req_id, "internal_error", "Parse error: " + expr.get_error_text())
	var result: Variant = expr.execute([], get_tree().root)
	if expr.has_execute_failed():
		return _Protocol.error(req_id, "internal_error", "Exec error: " + expr.get_error_text())
	return _Protocol.ok(req_id, {"result": str(result)})


# ── Helpers ──

func _find_node_recursive(n: Node, target: String) -> Node:
	if n.name == target:
		return n
	for i in range(n.get_child_count()):
		var found := _find_node_recursive(n.get_child(i), target)
		if found != null:
			return found
	return null


func _safe_serialize(val: Variant) -> Variant:
	if val == null:
		return null
	if val is bool or val is int or val is float or val is String:
		return val
	if val is Array:
		var out: Array = []
		for item: Variant in val:
			out.append(_safe_serialize(item))
		return out
	if val is Dictionary:
		var out: Dictionary = {}
		for key: Variant in val:
			out[str(key)] = _safe_serialize(val[key])
		return out
	return str(val)
