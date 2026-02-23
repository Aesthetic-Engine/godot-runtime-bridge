extends Node2D
## Example node for testing the Godot Runtime Bridge.
## Attach this to a scene and use get_property/set_property/call_method
## via the bridge to interact with it.

@export var health: int = 100
@export var player_name: String = "Player"
@export var score: int = 0


func take_damage(amount: int) -> int:
	health = maxi(health - amount, 0)
	return health


func add_score(points: int) -> int:
	score += points
	return score


func get_status() -> String:
	return "%s: HP=%d Score=%d" % [player_name, health, score]
