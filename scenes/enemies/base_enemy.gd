class_name BaseEnemy
extends CharacterBody2D

## Base enemy class for all enemy types.
## Provides common functionality for health, damage, and death handling.
##
## Usage:
## - Extend this class for custom enemy behavior
## - Override _ready(), _physics_process(), and take_damage() as needed
## - Call super._ready() in extended _ready() to ensure proper initialization
## - Implement _exit_tree() cleanup if overriding signal connections

# --- Stats ---
@export var max_health: int = 100
@export var move_speed: float = 150.0
@export var damage: int = 10
@export var xp_reward: int = 25

# --- State ---
var current_health: int

# --- Signals ---
signal died(xp_reward: int)

# --- Node References ---
@onready var sprite: Sprite2D = $Sprite2D
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var hurt_area: Area2D = $HurtArea

func _ready() -> void:
	current_health = max_health
	add_to_group("Enemies")
	if hurt_area:
		hurt_area.body_entered.connect(_on_hurt_area_body_entered)
	
	AutoAimManager.register_enemy(self)

# Reset enemy state for reuse from object pool
func reset_for_spawn() -> void:
	current_health = max_health
	AutoAimManager.register_enemy(self)

func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		die()

func die() -> void:
	AutoAimManager.unregister_enemy(self)
	died.emit(xp_reward)
	# Return enemy to object pool for reuse
	ObjectPool.return_enemy(self)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)
