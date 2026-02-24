extends RefCounted
## GRBLogger — captures engine errors, warnings, and log messages into a
## thread-safe ring buffer.  Registered via OS.add_logger() so it receives
## every push_error / push_warning / script error / shader error.
##
## The buffer is capped at MAX_ENTRIES; oldest entries are dropped when full.
## Consumers read via get_errors(since_index) for incremental polling.

const MAX_ENTRIES := 500

const TYPE_ERROR   := "error"
const TYPE_WARNING := "warning"
const TYPE_SCRIPT  := "script"
const TYPE_SHADER  := "shader"
const TYPE_MESSAGE := "message"

var _entries: Array[Dictionary] = []
var _next_index: int = 0
var _mutex := Mutex.new()
var _logger: _InnerLogger
var _error_count: int = 0
var _warning_count: int = 0


class _InnerLogger extends Logger:
	var _owner: RefCounted

	func _init(owner: RefCounted) -> void:
		_owner = owner

	func _log_error(function: String, file: String, line: int, code: String,
			rationale: String, _editor_notify: bool, error_type: int,
			_script_backtraces: Array) -> void:
		var etype: String
		match error_type:
			0: etype = "error"
			1: etype = "warning"
			2: etype = "script"
			3: etype = "shader"
			_: etype = "error"
		_owner._push_entry({
			"type": etype,
			"file": file,
			"line": line,
			"function": function,
			"code": code,
			"rationale": rationale,
		})

	func _log_message(message: String, is_error: bool) -> void:
		if is_error:
			_owner._push_entry({
				"type": "message",
				"message": message,
			})


func _init() -> void:
	_logger = _InnerLogger.new(self)


func register() -> void:
	OS.add_logger(_logger)


func unregister() -> void:
	OS.remove_logger(_logger)


func _push_entry(entry: Dictionary) -> void:
	entry["timestamp_ms"] = Time.get_ticks_msec()
	entry["index"] = _next_index

	_mutex.lock()
	if entry.get("type", "") == TYPE_WARNING:
		_warning_count += 1
	else:
		_error_count += 1
	_entries.append(entry)
	_next_index += 1
	if _entries.size() > MAX_ENTRIES:
		_entries.remove_at(0)
	_mutex.unlock()


func get_errors(since_index: int = 0) -> Dictionary:
	_mutex.lock()
	var result: Array[Dictionary] = []
	for e: Dictionary in _entries:
		if e.get("index", 0) >= since_index:
			result.append(e)
	var ni: int = _next_index
	var ec: int = _error_count
	var wc: int = _warning_count
	_mutex.unlock()
	return {
		"errors": result,
		"next_index": ni,
		"error_count": ec,
		"warning_count": wc,
	}


func get_error_count() -> int:
	_mutex.lock()
	var c := _error_count
	_mutex.unlock()
	return c


func get_warning_count() -> int:
	_mutex.lock()
	var c := _warning_count
	_mutex.unlock()
	return c


func clear() -> void:
	_mutex.lock()
	_entries.clear()
	_error_count = 0
	_warning_count = 0
	_mutex.unlock()
