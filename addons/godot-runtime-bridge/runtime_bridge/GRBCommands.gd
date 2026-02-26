extends Node
## Custom command registry for game devs. Register callables that the GRB bridge
## can invoke remotely via the run_custom_command protocol command.
##
## Usage:
##   GRBCommands.register("spawn_boss_phase_2", func(): spawn_boss(2))
##   GRBCommands.register("toggle_debug_hud", _toggle_debug)
##   GRBCommands.unregister("spawn_boss_phase_2")
##
## Commands are invoked by the bridge when a client sends:
##   {"cmd":"run_custom_command","args":{"name":"spawn_boss_phase_2"}}

var _commands: Dictionary = {}


func register(name: String, callable: Callable) -> void:
	if name.is_empty():
		push_warning("GRBCommands: register() requires non-empty name")
		return
	if not callable.is_valid():
		push_warning("GRBCommands: register() requires valid Callable for '%s'" % name)
		return
	_commands[name] = callable


func unregister(name: String) -> void:
	_commands.erase(name)


func run(name: String, args: Array = []) -> Variant:
	if not _commands.has(name):
		return null
	var callable: Callable = _commands[name]
	if not callable.is_valid():
		_commands.erase(name)
		return null
	if args.is_empty():
		return callable.call()
	return callable.callv(args)


func has_command(name: String) -> bool:
	return _commands.has(name) and _commands[name].is_valid()


func list_commands() -> Array[String]:
	var out: Array[String] = []
	for key: String in _commands:
		if _commands[key].is_valid():
			out.append(key)
	out.sort()
	return out
