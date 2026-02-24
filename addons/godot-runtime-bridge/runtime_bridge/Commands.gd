extends RefCounted
## Command registry: dispatch table, tier map, and execution.

enum Tier { OBSERVE = 0, INPUT = 1, CONTROL = 2, DANGER = 3 }

const COMMAND_TIERS: Dictionary = {
	"ping":          Tier.OBSERVE,
	"auth_info":     Tier.OBSERVE,
	"capabilities":  Tier.OBSERVE,
	"screenshot":    Tier.OBSERVE,
	"scene_tree":    Tier.OBSERVE,
	"get_property":  Tier.OBSERVE,
	"runtime_info":  Tier.OBSERVE,
	"get_errors":    Tier.OBSERVE,
	"wait_for":      Tier.OBSERVE,

	"click":         Tier.INPUT,
	"key":           Tier.INPUT,
	"press_button":  Tier.INPUT,
	"drag":          Tier.INPUT,
	"scroll":        Tier.INPUT,

	"set_property":  Tier.CONTROL,
	"call_method":   Tier.CONTROL,

	"eval":          Tier.DANGER,
}

## Commands allowed without token authentication.
const TOKEN_EXEMPT: Array[String] = ["ping", "auth_info"]


static func get_tier(cmd: String) -> int:
	return COMMAND_TIERS.get(cmd, -1)


static func is_known(cmd: String) -> bool:
	return COMMAND_TIERS.has(cmd)


static func is_token_exempt(cmd: String) -> bool:
	return cmd in TOKEN_EXEMPT


static func get_commands_for_tier(max_tier: int) -> Array[String]:
	var result: Array[String] = []
	for cmd_name: String in COMMAND_TIERS:
		if COMMAND_TIERS[cmd_name] <= max_tier:
			result.append(cmd_name)
	result.sort()
	return result
