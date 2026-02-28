extends CharacterBody2D

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

func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		die()

func die() -> void:
	AutoAimManager.unregister_enemy(self)
	died.emit(xp_reward)
	queue_free()

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body.is_in_group("Player"):
		body.take_damage(damage)
