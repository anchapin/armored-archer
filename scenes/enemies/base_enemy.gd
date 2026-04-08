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
var collision_enabled: bool = false
var is_dead: bool = false

# --- Signals ---
signal died(xp_reward: int)
signal enemy_died(enemy: BaseEnemy)

# --- Node References ---
@onready var sprite: Sprite2D = $Sprite2D
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var hurt_area: Area2D = $HurtArea

func _ready() -> void:
	# Set collision layer FIRST before any other initialization
	collision_layer = 2
	collision_mask = 1
	current_health = max_health
	print("DEBUG: reset_pooled_state called for %s, current_health: %d, max_health: %d, collision_layer=%d" % [name, current_health, max_health, collision_layer])
	print("DEBUG: reset_for_spawn called for %s, current_health: %d, max_health: %d" % [name, current_health, max_health])
	print("DEBUG: After reset_for_spawn, health: %d/%d" % [current_health, max_health])
	print("DEBUG: After reset, health: %d/%d" % [current_health, max_health])
	add_to_group("Enemies")
	if hurt_area:
		var _err = hurt_area.body_entered.connect(_on_hurt_area_body_entered)

	# Register with auto-aim if available
	var aim_mgr = get_node_or_null("/root/AutoAimManager")
	if aim_mgr and aim_mgr.has_method("register_enemy"):
		aim_mgr.register_enemy(self)

# Reset enemy state for reuse from object pool
func reset_for_spawn() -> void:
	print("DEBUG: reset_for_spawn called for %s, setting health to %d" % [name, max_health])
	current_health = max_health
	is_dead = false
	collision_layer = 2
	collision_mask = 1
	var aim_mgr = get_node_or_null("/root/AutoAimManager")
	if aim_mgr and aim_mgr.has_method("register_enemy"):
		print("DEBUG: Calling aim_mgr.register_enemy for %s" % name)
		aim_mgr.register_enemy(self)

## Enable collision (for spawner after pooling)
func enable_collision() -> void:
	if collision_shape:
		print("DEBUG: enable_collision called for %s, collision_enabled=%s" % [name, collision_enabled])
		if collision_enabled:
			print("DEBUG: Collision already enabled for %s, skipping" % name)
			return
		collision_shape.disabled = false
		collision_enabled = true
		print("DEBUG: Collision enabled for %s" % name)

func take_damage(amount: int) -> void:
	# Prevent re-damage on already dead enemies
	if is_dead:
		print("DEBUG: Enemy %s is already dead, ignoring damage" % name)
		return
	print("DEBUG: Enemy %s taking %d damage, health: %d/%d" % [name, amount, current_health, max_health])
	current_health -= amount
	print("DEBUG: Enemy %s health after damage: %d/%d" % [name, current_health, max_health])
	if current_health <= 0:
		print("DEBUG: Enemy %s health <= 0, calling die()" % name)
		is_dead = true
		die()

func die() -> void:
	print("DEBUG: die() called for %s, health: %d/%d" % [name, current_health, max_health])
	var aim_mgr = get_node_or_null("/root/AutoAimManager")
	if aim_mgr and aim_mgr.has_method("unregister_enemy"):
		aim_mgr.unregister_enemy(self)

	# CRITICAL: Set is_dead flag immediately to prevent re-damage before deferred pool return
	is_dead = true

	# Trigger death VFX
	var vfx_manager: Node = get_node_or_null("/root/VFXManager")
	if vfx_manager and vfx_manager.has_method("play_death_effect"):
		vfx_manager.play_death_effect(global_position)

	# Emit death signals
	print("DEBUG: Emitting died signal for %s (%s)" % [name, str(get_instance_id())])
	died.emit(xp_reward)

	# CRITICAL: Directly notify spawner of enemy death (EnemySpawner is now an autoload)
	var spawner: Node = get_node_or_null("/root/EnemySpawner")
	if spawner and spawner.has_method("_on_enemy_exiting"):
		print("DEBUG: Directly calling spawner._on_enemy_exiting for %s" % name)
		spawner._on_enemy_exiting(self)
	else:
		print("DEBUG: Could not find spawner at /root/EnemySpawner")
		# Try emitting signal as fallback
		print("DEBUG: Emitting enemy_died signal for %s (%s)" % [name, str(get_instance_id())])
		print("DEBUG: enemy_died signal has %d connections: %s" % [get_signal_connection_list("enemy_died").size(), str(get_signal_connection_list("enemy_died"))])
		enemy_died.emit(self)

	# CRITICAL: Return enemy to pool via deferred call to ensure signals process first
	# This prevents race condition where signal handler can't execute due to immediate node removal
	call_deferred("_return_to_pool_deferred")

func _return_to_pool_deferred() -> void:
	var object_pool = get_node_or_null("/root/ObjectPool")
	if object_pool and object_pool.has_method("return_enemy"):
		object_pool.return_enemy(self)

func _on_hurt_area_body_entered(body: Node2D) -> void:
	if body and body.is_in_group("Player"):
		if body.has_method("take_damage"):
			body.take_damage(damage)

## Reset state when returning to pool - called by ObjectPool
func reset_pooled_state() -> void:
	# Note: Signals will be disconnected by the spawner when needed

	current_health = max_health
	collision_layer = 2
	collision_mask = 1
	is_dead = false
	collision_enabled = false
	position = Vector2.ZERO
	velocity = Vector2.ZERO

	# Disable collision
	if collision_shape:
		collision_shape.set_deferred("disabled", true)

	collision_layer = 2

	# Reset sprite
	if sprite:
		sprite.modulate = Color.WHITE

## Cleanup when enemy is freed
func _exit_tree() -> void:
	var aim_mgr = get_node_or_null("/root/AutoAimManager")
	if aim_mgr and aim_mgr.has_method("unregister_enemy"):
		aim_mgr.unregister_enemy(self)
