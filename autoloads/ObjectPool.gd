## Object Pool Manager
## Provides efficient object pooling for frequently instantiated game objects
## to reduce memory allocation spikes and garbage collection pressure on budget devices
##
## Usage:
##   ObjectPool.get_arrow() - Get an arrow from pool or create new
##   ObjectPool.get_enemy() - Get an enemy from pool or create new
##   ObjectPool.get_hit_effect() - Get a hit effect from pool or create new
##   ObjectPool.get_death_effect() - Get a death effect from pool or create new
##   ObjectPool.get_crit_effect() / get_miss_effect / get_fire_effect / get_ice_effect / get_lightning_effect
##   ObjectPool.get_charge_effect() - Get a charge/power-up loop particle (issue #1136)
##   ObjectPool.get_damage_popup() - Get a floating damage label
##   ObjectPool.get_arrow_trail() - Get an arrow trail particle
##   ObjectPool.return_*(node) - Return matching pool
##   ObjectPool.prewarm_pools() - Construct all pools (issue #1110: wired into
##     GameManager.start_game() behind the stage load; also runs lazily on
##     first acquire if a caller beats the prewarm)
##
extends Node

# Pool sizes - can be adjusted based on device tier
const ARROW_POOL_SIZE: int = 20
const ENEMY_POOL_SIZE: int = 15
const HIT_EFFECT_POOL_SIZE: int = 10
const DEATH_EFFECT_POOL_SIZE: int = 5
const CRIT_EFFECT_POOL_SIZE: int = 8
const MISS_EFFECT_POOL_SIZE: int = 6
const FIRE_EFFECT_POOL_SIZE: int = 6
const ICE_EFFECT_POOL_SIZE: int = 6
const LIGHTNING_EFFECT_POOL_SIZE: int = 6
const CHARGE_EFFECT_POOL_SIZE: int = 6
const DAMAGE_POPUP_POOL_SIZE: int = 12
const ARROW_TRAIL_POOL_SIZE: int = 16

# Preloaded scenes
var _arrow_scene: PackedScene
var _enemy_scene: PackedScene
var _hit_effect_scene: PackedScene
var _death_effect_scene: PackedScene
var _crit_effect_scene: PackedScene
var _miss_effect_scene: PackedScene
var _fire_effect_scene: PackedScene
var _ice_effect_scene: PackedScene
var _lightning_effect_scene: PackedScene
var _charge_effect_scene: PackedScene
var _damage_popup_scene: PackedScene
var _arrow_trail_scene: PackedScene

# Object pools - Array of available (inactive) objects
var _arrow_pool: Array[Node] = []
var _enemy_pool: Array[Node] = []
var _hit_effect_pool: Array[Node] = []
var _death_effect_pool: Array[Node] = []
var _crit_effect_pool: Array[Node] = []
var _miss_effect_pool: Array[Node] = []
var _fire_effect_pool: Array[Node] = []
var _ice_effect_pool: Array[Node] = []
var _lightning_effect_pool: Array[Node] = []
var _charge_effect_pool: Array[Node] = []
var _damage_popup_pool: Array[Node] = []
var _arrow_trail_pool: Array[Node] = []

# Active objects tracking (for debugging/memory management)
var _active_arrows: Array[Node] = []
var _active_enemies: Array[Node] = []
var _active_hit_effects: Array[Node] = []
var _active_death_effects: Array[Node] = []
var _active_crit_effects: Array[Node] = []
var _active_miss_effects: Array[Node] = []
var _active_fire_effects: Array[Node] = []
var _active_ice_effects: Array[Node] = []
var _active_lightning_effects: Array[Node] = []
var _active_charge_effects: Array[Node] = []
var _active_damage_popups: Array[Node] = []
var _active_arrow_trails: Array[Node] = []

# Statistics
var _arrows_created: int = 0
var _arrows_reused: int = 0
var _enemies_created: int = 0
var _enemies_reused: int = 0
var _hit_effects_created: int = 0
var _hit_effects_reused: int = 0
var _death_effects_created: int = 0
var _death_effects_reused: int = 0
var _crit_effects_created: int = 0
var _crit_effects_reused: int = 0
var _miss_effects_created: int = 0
var _miss_effects_reused: int = 0
var _fire_effects_created: int = 0
var _fire_effects_reused: int = 0
var _ice_effects_created: int = 0
var _ice_effects_reused: int = 0
var _lightning_effects_created: int = 0
var _lightning_effects_reused: int = 0
var _charge_effects_created: int = 0
var _charge_effects_reused: int = 0
var _damage_popups_created: int = 0
var _damage_popups_reused: int = 0
var _arrow_trails_created: int = 0
var _arrow_trails_reused: int = 0

# Issue #1110: pools are no longer constructed synchronously in _ready()
# (that cost belongs behind the stage load, not engine boot). prewarm_pools()
# constructs them; getters lazily fall back if prewarm never ran.
var _pools_initialized: bool = false

# Autoload node names from project.godot — used to tell the outgoing current
# scene apart from always-loaded root children (issue #1110).
var _autoload_node_names: Array[StringName] = []

func _ready() -> void:
	# Issue #1110: do NOT call _initialize_pools() here — pool construction
	# moved off the boot path. Prewarm happens behind the stage load via
	# GameManager.start_game() -> prewarm_pools(), or lazily on first acquire.
	_cache_autoload_names()
	get_tree().root.child_exiting_tree.connect(_on_root_child_exiting_tree)

func _initialize_pools() -> void:
	# Preload scenes. Use load() rather than preload() so a malformed scene
	# file (e.g. assets/particles/crit_effect.tscn's invalid inline comment)
	# returns null at runtime instead of hard-failing the autoload script.
	_arrow_scene = load("res://scenes/arrow.tscn") as PackedScene
	_enemy_scene = load("res://scenes/enemies/melee_enemy.tscn") as PackedScene
	_hit_effect_scene = load("res://assets/particles/hit_effect.tscn") as PackedScene
	_death_effect_scene = load("res://assets/particles/death_effect.tscn") as PackedScene
	_crit_effect_scene = load("res://assets/particles/crit_effect.tscn") as PackedScene
	_miss_effect_scene = load("res://assets/particles/miss_effect.tscn") as PackedScene
	_fire_effect_scene = load("res://assets/particles/fire_effect.tscn") as PackedScene
	_ice_effect_scene = load("res://assets/particles/ice_effect.tscn") as PackedScene
	_lightning_effect_scene = load("res://assets/particles/lightning_effect.tscn") as PackedScene
	_charge_effect_scene = load("res://assets/particles/charge_effect.tscn") as PackedScene
	_damage_popup_scene = load("res://scenes/damage_popup.tscn") as PackedScene
	_arrow_trail_scene = load("res://assets/particles/arrow_trail.tscn") as PackedScene

	# Adjust pool sizes based on device tier
	var pool_size_multiplier: float = 1.0
	if PerformanceProfiler.is_budget_device():
		pool_size_multiplier = 0.5  # Smaller pools on budget devices
	elif PerformanceProfiler.is_mid_range_device():
		pool_size_multiplier = 0.75

	var adjusted_arrow_pool = int(ARROW_POOL_SIZE * pool_size_multiplier)
	var adjusted_enemy_pool = int(ENEMY_POOL_SIZE * pool_size_multiplier)
	var adjusted_hit_pool = int(HIT_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_death_pool = int(DEATH_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_crit_pool = int(CRIT_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_miss_pool = int(MISS_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_fire_pool = int(FIRE_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_ice_pool = int(ICE_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_lightning_pool = int(LIGHTNING_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_charge_pool = int(CHARGE_EFFECT_POOL_SIZE * pool_size_multiplier)
	var adjusted_popup_pool = int(DAMAGE_POPUP_POOL_SIZE * pool_size_multiplier)
	var adjusted_trail_pool = int(ARROW_TRAIL_POOL_SIZE * pool_size_multiplier)

	# Create initial pools
	for i in range(max(adjusted_arrow_pool, 5)):
		var arrow = _arrow_scene.instantiate()
		arrow.set_process(false)
		arrow.set_physics_process(false)
		arrow.visible = false
		_arrow_pool.append(arrow)
		add_child(arrow)

	for i in range(max(adjusted_enemy_pool, 3)):
		var enemy = _enemy_scene.instantiate()
		enemy.set_process(false)
		enemy.set_physics_process(false)
		enemy.visible = false
		_enemy_pool.append(enemy)
		# CRITICAL: Don't add to scene yet - enemies added to scene during initialization
		# will exist and be hittable but not tracked by spawner.
		# They will be added to scene when actually spawned via get_enemy()

	for i in range(max(adjusted_hit_pool, 3)):
		var effect = _hit_effect_scene.instantiate()
		effect.set_process(false)
		effect.visible = false
		_hit_effect_pool.append(effect)
		add_child(effect)

	for i in range(max(adjusted_death_pool, 2)):
		var effect = _death_effect_scene.instantiate()
		effect.set_process(false)
		effect.visible = false
		_death_effect_pool.append(effect)
		add_child(effect)

	_prewarm_particle_pool(_crit_effect_pool, _crit_effect_scene, max(adjusted_crit_pool, 2))
	_prewarm_particle_pool(_miss_effect_pool, _miss_effect_scene, max(adjusted_miss_pool, 2))
	_prewarm_particle_pool(_fire_effect_pool, _fire_effect_scene, max(adjusted_fire_pool, 2))
	_prewarm_particle_pool(_ice_effect_pool, _ice_effect_scene, max(adjusted_ice_pool, 2))
	_prewarm_particle_pool(_lightning_effect_pool, _lightning_effect_scene, max(adjusted_lightning_pool, 2))
	_prewarm_particle_pool(_charge_effect_pool, _charge_effect_scene, max(adjusted_charge_pool, 2))

	# Damage popups are labels that float & fade; prewarm and stash as children
	if _damage_popup_scene != null:
		for i in range(max(adjusted_popup_pool, 3)):
			var popup: Label = _damage_popup_scene.instantiate()
			popup.set_process(false)
			popup.visible = false
			_damage_popup_pool.append(popup)
			add_child(popup)
	else:
		push_warning("[ObjectPool] Damage popup scene missing; pool skipped")

	# Arrow trails loop while attached to an arrow; prewarm and stash
	if _arrow_trail_scene != null:
		for i in range(max(adjusted_trail_pool, 4)):
			var trail = _arrow_trail_scene.instantiate()
			trail.set_process(false)
			trail.emitting = false
			trail.visible = false
			_arrow_trail_pool.append(trail)
			add_child(trail)
	else:
		push_warning("[ObjectPool] Arrow trail scene missing; pool skipped")

	_pools_initialized = true

## Lazily construct pools on first acquire if prewarm_pools() never ran
## (e.g. PvP flow or a fresh test instance). Cheap boolean check.
func _ensure_pools_initialized() -> void:
	if not _pools_initialized:
		_initialize_pools()

## Internal: instantiate a number of GPUParticles2D from a PackedScene and add
## them to a typed pool array. Mirrors the existing hit/death prewarm loop.
func _prewarm_particle_pool(target_pool: Array[Node], scene: PackedScene, count: int) -> void:
	if scene == null or count <= 0:
		return
	for i in range(count):
		var effect: GPUParticles2D = scene.instantiate()
		effect.set_process(false)
		effect.visible = false
		target_pool.append(effect)
		add_child(effect)

# --- Arrow Pool ---

## Get an arrow from the pool, or create a new one if pool is empty
func get_arrow() -> Node:
	_ensure_pools_initialized()
	var arrow: Node

	if _arrow_pool.size() > 0:
		arrow = _arrow_pool.pop_back()
		_arrows_reused += 1
	else:
		arrow = _arrow_scene.instantiate()
		_arrows_created += 1
		add_child(arrow)

	arrow.set_process(true)
	arrow.set_physics_process(true)
	arrow.visible = true
	_active_arrows.append(arrow)

	return arrow

## Return an arrow to the pool
func return_arrow(arrow: Node) -> void:
	if not is_instance_valid(arrow):
		return

	arrow.set_process(false)
	arrow.set_physics_process(false)
	arrow.visible = false

	# Reset arrow state if it has a setup method
	if arrow.has_method("reset_pooled_state"):
		arrow.reset_pooled_state()

	_arrow_pool.append(arrow)
	_active_arrows.erase(arrow)

# --- Enemy Pool ---

## Get an enemy from the pool, or create a new one if pool is empty
func get_enemy() -> Node:
	_ensure_pools_initialized()
	var enemy: Node

	if _enemy_pool.size() > 0:
		enemy = _enemy_pool.pop_back()
		_enemies_reused += 1
	else:
		enemy = _enemy_scene.instantiate()
		_enemies_created += 1
		add_child(enemy)

	enemy.set_process(true)
	enemy.set_physics_process(true)
	enemy.visible = true
	
	# CRITICAL: Add to scene if not parented (enemies without parents can't be hittable)
	# This handles both first-time pool use and re-parenting from scene
	if enemy.get_parent() == null:
		add_child(enemy)
	
	_active_enemies.append(enemy)

	return enemy

## Return an enemy to the pool
func return_enemy(enemy: Node) -> void:
	if not is_instance_valid(enemy):
		return

	enemy.set_process(false)
	enemy.set_physics_process(false)
	enemy.visible = false

	# Reset enemy state if it has a reset method
	if enemy.has_method("reset_pooled_state"):
		enemy.reset_pooled_state()

	_enemy_pool.append(enemy)
	_active_enemies.erase(enemy)

# --- Hit Effect Pool ---

## Get a hit effect from the pool, or create a new one if pool is empty
func get_hit_effect() -> Node:
	_ensure_pools_initialized()
	var effect: Node

	if _hit_effect_pool.size() > 0:
		effect = _hit_effect_pool.pop_back()
		_hit_effects_reused += 1
	else:
		effect = _hit_effect_scene.instantiate()
		_hit_effects_created += 1
		add_child(effect)

	effect.set_process(true)
	effect.visible = true
	_active_hit_effects.append(effect)

	return effect

## Return a hit effect to the pool
func return_hit_effect(effect: Node) -> void:
	if not is_instance_valid(effect):
		return

	effect.set_process(false)
	effect.visible = false

	# Reset effect state if it has a reset method
	if effect.has_method("reset_pooled_state"):
		effect.reset_pooled_state()

	_hit_effect_pool.append(effect)
	_active_hit_effects.erase(effect)

# --- Death Effect Pool ---

## Get a death effect from the pool, or create a new one if pool is empty
func get_death_effect() -> Node:
	_ensure_pools_initialized()
	var effect: Node

	if _death_effect_pool.size() > 0:
		effect = _death_effect_pool.pop_back()
		_death_effects_reused += 1
	else:
		effect = _death_effect_scene.instantiate()
		_death_effects_created += 1
		add_child(effect)

	effect.set_process(true)
	effect.visible = true
	_active_death_effects.append(effect)

	return effect

## Return a death effect to the pool
func return_death_effect(effect: Node) -> void:
	if not is_instance_valid(effect):
		return

	effect.set_process(false)
	effect.visible = false

	# Reset effect state if it has a reset method
	if effect.has_method("reset_pooled_state"):
		effect.reset_pooled_state()

	_death_effect_pool.append(effect)
	_active_death_effects.erase(effect)

# --- Elemental Particle Pools (issue #1090: route combat-juice through pool) ---

## Internal helper: pop from a typed particle pool or instantiate fresh.
## Mirrors get_hit_effect() / get_death_effect() but factored for reuse across
## crit/miss/fire/ice/lightning — they share identical lifecycle semantics.
func _get_particle_from(
		available: Array[Node],
		active: Array[Node],
		scene: PackedScene,
		created_counter: int,
		reused_counter: int,
		created_ref: Array, # [0] = ref to int (mutated in place)
		reused_ref: Array   # [0] = ref to int (mutated in place)
) -> GPUParticles2D:
	_ensure_pools_initialized()
	var effect: GPUParticles2D
	if available.size() > 0:
		effect = available.pop_back()
		reused_ref[0] = reused_ref[0] + 1
	else:
		effect = scene.instantiate()
		created_ref[0] = created_ref[0] + 1
		add_child(effect)

	effect.set_process(true)
	effect.emitting = true
	effect.visible = true
	active.append(effect)
	return effect

## Internal helper: return a GPUParticles2D to its typed pool.
func _return_particle_to(
		effect: Node,
		available: Array[Node],
		active: Array[Node]
) -> void:
	if not is_instance_valid(effect):
		return
	effect.set_process(false)
	effect.emitting = false
	effect.visible = false
	if effect.has_method("reset_pooled_state"):
		effect.reset_pooled_state()
	available.append(effect)
	active.erase(effect)

## Get a crit-hit particle effect from the pool.
func get_crit_effect() -> GPUParticles2D:
	var counters_created: Array = [_crit_effects_created]
	var counters_reused: Array = [_crit_effects_reused]
	var effect := _get_particle_from(
		_crit_effect_pool, _active_crit_effects, _crit_effect_scene,
		0, 0, counters_created, counters_reused
	)
	_crit_effects_created = counters_created[0]
	_crit_effects_reused = counters_reused[0]
	return effect

## Return a crit-hit effect to the pool.
func return_crit_effect(effect: Node) -> void:
	_return_particle_to(effect, _crit_effect_pool, _active_crit_effects)

## Get a miss-effect particle from the pool.
func get_miss_effect() -> GPUParticles2D:
	var counters_created: Array = [_miss_effects_created]
	var counters_reused: Array = [_miss_effects_reused]
	var effect := _get_particle_from(
		_miss_effect_pool, _active_miss_effects, _miss_effect_scene,
		0, 0, counters_created, counters_reused
	)
	_miss_effects_created = counters_created[0]
	_miss_effects_reused = counters_reused[0]
	return effect

## Return a miss-effect to the pool.
func return_miss_effect(effect: Node) -> void:
	_return_particle_to(effect, _miss_effect_pool, _active_miss_effects)

## Get a fire-element particle effect from the pool.
func get_fire_effect() -> GPUParticles2D:
	var counters_created: Array = [_fire_effects_created]
	var counters_reused: Array = [_fire_effects_reused]
	var effect := _get_particle_from(
		_fire_effect_pool, _active_fire_effects, _fire_effect_scene,
		0, 0, counters_created, counters_reused
	)
	_fire_effects_created = counters_created[0]
	_fire_effects_reused = counters_reused[0]
	return effect

## Return a fire-effect to the pool.
func return_fire_effect(effect: Node) -> void:
	_return_particle_to(effect, _fire_effect_pool, _active_fire_effects)

## Get an ice-element particle effect from the pool.
func get_ice_effect() -> GPUParticles2D:
	var counters_created: Array = [_ice_effects_created]
	var counters_reused: Array = [_ice_effects_reused]
	var effect := _get_particle_from(
		_ice_effect_pool, _active_ice_effects, _ice_effect_scene,
		0, 0, counters_created, counters_reused
	)
	_ice_effects_created = counters_created[0]
	_ice_effects_reused = counters_reused[0]
	return effect

## Return an ice-effect to the pool.
func return_ice_effect(effect: Node) -> void:
	_return_particle_to(effect, _ice_effect_pool, _active_ice_effects)

## Get a lightning-element particle effect from the pool.
func get_lightning_effect() -> GPUParticles2D:
	var counters_created: Array = [_lightning_effects_created]
	var counters_reused: Array = [_lightning_effects_reused]
	var effect := _get_particle_from(
		_lightning_effect_pool, _active_lightning_effects, _lightning_effect_scene,
		0, 0, counters_created, counters_reused
	)
	_lightning_effects_created = counters_created[0]
	_lightning_effects_reused = counters_reused[0]
	return effect

## Return a lightning-effect to the pool.
func return_lightning_effect(effect: Node) -> void:
	_return_particle_to(effect, _lightning_effect_pool, _active_lightning_effects)

## Get a charge/power-up particle effect from the pool (issue #1136: route
## the looping charge_effect.tscn paths through prewarm + device-tier budget).
func get_charge_effect() -> GPUParticles2D:
	var counters_created: Array = [_charge_effects_created]
	var counters_reused: Array = [_charge_effects_reused]
	var effect := _get_particle_from(
		_charge_effect_pool, _active_charge_effects, _charge_effect_scene,
		0, 0, counters_created, counters_reused
	)
	_charge_effects_created = counters_created[0]
	_charge_effects_reused = counters_reused[0]
	return effect

## Return a charge/power-up effect to the pool.
func return_charge_effect(effect: Node) -> void:
	_return_particle_to(effect, _charge_effect_pool, _active_charge_effects)

# --- Damage Popup Pool (issue #1090: route damage popups through pool) ---

## Get a damage-popup Label from the pool, or create a new one if pool is empty.
##
## Caller is responsible for:
##   * re-parenting the popup to the live scene tree (it lives under ObjectPool
##     by default), setting its global_position, and calling setup_damage().
##   * calling return_damage_popup() once the popup's lifetime expires
##     (e.g. via a tween callback) so it can be reused.
func get_damage_popup() -> Label:
	_ensure_pools_initialized()
	var popup: Label
	if _damage_popup_pool.size() > 0:
		popup = _damage_popup_pool.pop_back()
		_damage_popups_reused += 1
	else:
		popup = _damage_popup_scene.instantiate()
		_damage_popups_created += 1
		add_child(popup)

	popup.visible = true
	popup.set_process(true)
	_active_damage_popups.append(popup)
	return popup

## Return a damage-popup Label to the pool. Stops _process-driven lifetime
## ticking so the popup can be reused without re-instantiation.
func return_damage_popup(popup: Node) -> void:
	if not is_instance_valid(popup):
		return
	popup.set_process(false)
	popup.visible = false
	if popup.has_method("reset_pooled_state"):
		popup.reset_pooled_state()
	_damage_popup_pool.append(popup)
	_active_damage_popups.erase(popup)

# --- Arrow Trail Pool (issue #1090: route per-arrow trails through pool) ---

## Get an arrow-trail GPUParticles2D from the pool. Caller parents it to the
## arrow (or any moving node) and should call return_arrow_trail() when the
## arrow returns to the pool / is freed.
func get_arrow_trail() -> GPUParticles2D:
	_ensure_pools_initialized()
	var trail: GPUParticles2D
	if _arrow_trail_pool.size() > 0:
		trail = _arrow_trail_pool.pop_back()
		_arrow_trails_reused += 1
	else:
		trail = _arrow_trail_scene.instantiate()
		_arrow_trails_created += 1
		add_child(trail)

	trail.set_process(true)
	trail.emitting = true
	trail.visible = true
	# restart() so a recycled trail emits from the new parent's position
	trail.restart()
	_active_arrow_trails.append(trail)
	return trail

## Return an arrow-trail particle to the pool.
func return_arrow_trail(trail: Node) -> void:
	if not is_instance_valid(trail):
		return
	trail.set_process(false)
	trail.emitting = false
	trail.visible = false
	if trail.has_method("reset_pooled_state"):
		trail.reset_pooled_state()
	_arrow_trail_pool.append(trail)
	_active_arrow_trails.erase(trail)

# --- Statistics ---

## Get pool statistics
func get_statistics() -> Dictionary:
	return {
		"arrows": {
			"active": _active_arrows.size(),
			"available": _arrow_pool.size(),
			"created": _arrows_created,
			"reused": _arrows_reused,
			"reuse_rate": _get_reuse_rate(_arrows_created, _arrows_reused)
		},
		"enemies": {
			"active": _active_enemies.size(),
			"available": _enemy_pool.size(),
			"created": _enemies_created,
			"reused": _enemies_reused,
			"reuse_rate": _get_reuse_rate(_enemies_created, _enemies_reused)
		},
		"hit_effects": {
			"active": _active_hit_effects.size(),
			"available": _hit_effect_pool.size(),
			"created": _hit_effects_created,
			"reused": _hit_effects_reused,
			"reuse_rate": _get_reuse_rate(_hit_effects_created, _hit_effects_reused)
		},
		"death_effects": {
			"active": _active_death_effects.size(),
			"available": _death_effect_pool.size(),
			"created": _death_effects_created,
			"reused": _death_effects_reused,
			"reuse_rate": _get_reuse_rate(_death_effects_created, _death_effects_reused)
		},
		"crit_effects": {
			"active": _active_crit_effects.size(),
			"available": _crit_effect_pool.size(),
			"created": _crit_effects_created,
			"reused": _crit_effects_reused,
			"reuse_rate": _get_reuse_rate(_crit_effects_created, _crit_effects_reused)
		},
		"miss_effects": {
			"active": _active_miss_effects.size(),
			"available": _miss_effect_pool.size(),
			"created": _miss_effects_created,
			"reused": _miss_effects_reused,
			"reuse_rate": _get_reuse_rate(_miss_effects_created, _miss_effects_reused)
		},
		"fire_effects": {
			"active": _active_fire_effects.size(),
			"available": _fire_effect_pool.size(),
			"created": _fire_effects_created,
			"reused": _fire_effects_reused,
			"reuse_rate": _get_reuse_rate(_fire_effects_created, _fire_effects_reused)
		},
		"ice_effects": {
			"active": _active_ice_effects.size(),
			"available": _ice_effect_pool.size(),
			"created": _ice_effects_created,
			"reused": _ice_effects_reused,
			"reuse_rate": _get_reuse_rate(_ice_effects_created, _ice_effects_reused)
		},
		"lightning_effects": {
			"active": _active_lightning_effects.size(),
			"available": _lightning_effect_pool.size(),
			"created": _lightning_effects_created,
			"reused": _lightning_effects_reused,
			"reuse_rate": _get_reuse_rate(_lightning_effects_created, _lightning_effects_reused)
		},
		"charge_effects": {
			"active": _active_charge_effects.size(),
			"available": _charge_effect_pool.size(),
			"created": _charge_effects_created,
			"reused": _charge_effects_reused,
			"reuse_rate": _get_reuse_rate(_charge_effects_created, _charge_effects_reused)
		},
		"damage_popups": {
			"active": _active_damage_popups.size(),
			"available": _damage_popup_pool.size(),
			"created": _damage_popups_created,
			"reused": _damage_popups_reused,
			"reuse_rate": _get_reuse_rate(_damage_popups_created, _damage_popups_reused)
		},
		"arrow_trails": {
			"active": _active_arrow_trails.size(),
			"available": _arrow_trail_pool.size(),
			"created": _arrow_trails_created,
			"reused": _arrow_trails_reused,
			"reuse_rate": _get_reuse_rate(_arrow_trails_created, _arrow_trails_reused)
		}
	}

func _get_reuse_rate(created: int, reused: int) -> float:
	var total = created + reused
	if total == 0:
		return 0.0
	return float(reused) / float(total) * 100.0

## Log statistics to console
func log_statistics() -> void:
	var stats = get_statistics()
	push_warning("[ObjectPool] Arrows: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.arrows.active, stats.arrows.available, stats.arrows.created, stats.arrows.reused, stats.arrows.reuse_rate])
	push_warning("[ObjectPool] Enemies: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.enemies.active, stats.enemies.available, stats.enemies.created, stats.enemies.reused, stats.enemies.reuse_rate])
	push_warning("[ObjectPool] HitEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.hit_effects.active, stats.hit_effects.available, stats.hit_effects.created, stats.hit_effects.reused, stats.hit_effects.reuse_rate])
	push_warning("[ObjectPool] DeathEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.death_effects.active, stats.death_effects.available, stats.death_effects.created, stats.death_effects.reused, stats.death_effects.reuse_rate])
	push_warning("[ObjectPool] CritEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.crit_effects.active, stats.crit_effects.available, stats.crit_effects.created, stats.crit_effects.reused, stats.crit_effects.reuse_rate])
	push_warning("[ObjectPool] MissEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.miss_effects.active, stats.miss_effects.available, stats.miss_effects.created, stats.miss_effects.reused, stats.miss_effects.reuse_rate])
	push_warning("[ObjectPool] FireEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.fire_effects.active, stats.fire_effects.available, stats.fire_effects.created, stats.fire_effects.reused, stats.fire_effects.reuse_rate])
	push_warning("[ObjectPool] IceEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.ice_effects.active, stats.ice_effects.available, stats.ice_effects.created, stats.ice_effects.reused, stats.ice_effects.reuse_rate])
	push_warning("[ObjectPool] LightningEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.lightning_effects.active, stats.lightning_effects.available, stats.lightning_effects.created, stats.lightning_effects.reused, stats.lightning_effects.reuse_rate])
	push_warning("[ObjectPool] ChargeEffects: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.charge_effects.active, stats.charge_effects.available, stats.charge_effects.created, stats.charge_effects.reused, stats.charge_effects.reuse_rate])
	push_warning("[ObjectPool] DamagePopups: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.damage_popups.active, stats.damage_popups.available, stats.damage_popups.created, stats.damage_popups.reused, stats.damage_popups.reuse_rate])
	push_warning("[ObjectPool] ArrowTrails: %d active, %d available, %d created, %d reused (%.1f%% reuse rate)" %
		[stats.arrow_trails.active, stats.arrow_trails.available, stats.arrow_trails.created, stats.arrow_trails.reused, stats.arrow_trails.reuse_rate])

## Clean up invalid instances from active tracking arrays
func cleanup_invalid_instances() -> void:
	# Rebuild with only still-valid instances. Erasing freed objects from
	# typed arrays is unreliable in Godot 4.6 (freed objects are rejected
	# or auto-nulled in typed Array[Node] slots).
	# Clean up arrows
	var valid_arrows: Array[Node] = []
	for arrow in _active_arrows:
		if is_instance_valid(arrow):
			valid_arrows.append(arrow)
	_active_arrows = valid_arrows

	# Clean up enemies
	var valid_enemies: Array[Node] = []
	for enemy in _active_enemies:
		if is_instance_valid(enemy):
			valid_enemies.append(enemy)
	_active_enemies = valid_enemies

	# Clean up hit effects
	var valid_effects: Array[Node] = []
	for effect in _active_hit_effects:
		if is_instance_valid(effect):
			valid_effects.append(effect)
	_active_hit_effects = valid_effects

	# Clean up death effects
	var valid_death_effects: Array[Node] = []
	for effect in _active_death_effects:
		if is_instance_valid(effect):
			valid_death_effects.append(effect)
	_active_death_effects = valid_death_effects

	# Clean up crit effects
	var valid_crit_effects: Array[Node] = []
	for effect in _active_crit_effects:
		if is_instance_valid(effect):
			valid_crit_effects.append(effect)
	_active_crit_effects = valid_crit_effects

	# Clean up miss effects
	var valid_miss_effects: Array[Node] = []
	for effect in _active_miss_effects:
		if is_instance_valid(effect):
			valid_miss_effects.append(effect)
	_active_miss_effects = valid_miss_effects

	# Clean up fire effects
	var valid_fire_effects: Array[Node] = []
	for effect in _active_fire_effects:
		if is_instance_valid(effect):
			valid_fire_effects.append(effect)
	_active_fire_effects = valid_fire_effects

	# Clean up ice effects
	var valid_ice_effects: Array[Node] = []
	for effect in _active_ice_effects:
		if is_instance_valid(effect):
			valid_ice_effects.append(effect)
	_active_ice_effects = valid_ice_effects

	# Clean up lightning effects
	var valid_lightning_effects: Array[Node] = []
	for effect in _active_lightning_effects:
		if is_instance_valid(effect):
			valid_lightning_effects.append(effect)
	_active_lightning_effects = valid_lightning_effects

	# Clean up charge effects
	var valid_charge_effects: Array[Node] = []
	for effect in _active_charge_effects:
		if is_instance_valid(effect):
			valid_charge_effects.append(effect)
	_active_charge_effects = valid_charge_effects

	# Clean up damage popups
	var valid_popups: Array[Node] = []
	for popup in _active_damage_popups:
		if is_instance_valid(popup):
			valid_popups.append(popup)
	_active_damage_popups = valid_popups

	# Clean up arrow trails
	var valid_trails: Array[Node] = []
	for trail in _active_arrow_trails:
		if is_instance_valid(trail):
			valid_trails.append(trail)
	_active_arrow_trails = valid_trails

## Pre-warm pools — construct the full pool set behind the stage-load /
## loading screen (issue #1110: wired from GameManager.start_game(), which
## scenes/main.gd calls as the combat scene enters, covered by the
## campaign-map fade). Idempotent: a second call never double-fills.
func prewarm_pools() -> void:
	if _pools_initialized:
		return
	_initialize_pools()

# --- Scene-transition integration (issue #1110) ---

## Cache autoload node names from project.godot so root-child exits can be
## classified as "always-loaded autoload" vs "outgoing current scene".
func _cache_autoload_names() -> void:
	if not ProjectSettings.has_setting("autoload"):
		return
	for autoload_key in ProjectSettings.get_setting("autoload").keys():
		_autoload_node_names.append(StringName(String(autoload_key)))

func _is_autoload_node(node: Node) -> bool:
	return _autoload_node_names.has(node.name)

## Flush active pooled objects when the outgoing current scene exits the
## tree, so enemies/arrows/VFX never keep simulating across menus or PvP
## (issue #1110). Wired once to root's child_exiting_tree signal, which
## covers every change_scene_to_file/packed call site.
##
## Discriminators (verified against Godot 4.6 change_scene behavior):
##   * the engine nulls SceneTree.current_scene *before* the outgoing scene
##     exits, while a root-parented gameplay node freed mid-combat (e.g. a
##     boss from GameManager.spawn_boss) exits while current_scene is set;
##   * the outgoing scene is a .tscn instantiation (scene_file_path set),
##     unlike plain runtime nodes and script-only autoloads.
func _on_root_child_exiting_tree(node: Node) -> void:
	if node == self or not is_inside_tree():
		return
	var tree: SceneTree = get_tree()
	if tree == null or tree.current_scene != null:
		return
	if node.get_parent() != tree.root:
		return
	if node.scene_file_path.is_empty():
		return
	if _is_autoload_node(node):
		return
	prepare_for_scene_change()

## Clean up all pooled objects - call when game exits or needs full reset
func cleanup_all() -> void:
	# Clean up all arrows
	for arrow in _arrow_pool:
		if is_instance_valid(arrow):
			arrow.queue_free()
	_arrow_pool.clear()
	_active_arrows.clear()

	# Clean up all enemies
	for enemy in _enemy_pool:
		if is_instance_valid(enemy):
			enemy.queue_free()
	_enemy_pool.clear()
	_active_enemies.clear()

	# Clean up all hit effects
	for effect in _hit_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_hit_effect_pool.clear()
	_active_hit_effects.clear()

	# Clean up all death effects
	for effect in _death_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_death_effect_pool.clear()
	_active_death_effects.clear()

	# Clean up all crit effects
	for effect in _crit_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_crit_effect_pool.clear()
	_active_crit_effects.clear()

	# Clean up all miss effects
	for effect in _miss_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_miss_effect_pool.clear()
	_active_miss_effects.clear()

	# Clean up all fire effects
	for effect in _fire_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_fire_effect_pool.clear()
	_active_fire_effects.clear()

	# Clean up all ice effects
	for effect in _ice_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_ice_effect_pool.clear()
	_active_ice_effects.clear()

	# Clean up all lightning effects
	for effect in _lightning_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_lightning_effect_pool.clear()
	_active_lightning_effects.clear()

	# Clean up all charge effects
	for effect in _charge_effect_pool:
		if is_instance_valid(effect):
			effect.queue_free()
	_charge_effect_pool.clear()
	_active_charge_effects.clear()

	# Clean up all damage popups
	for popup in _damage_popup_pool:
		if is_instance_valid(popup):
			popup.queue_free()
	_damage_popup_pool.clear()
	_active_damage_popups.clear()

	# Clean up all arrow trails
	for trail in _arrow_trail_pool:
		if is_instance_valid(trail):
			trail.queue_free()
	_arrow_trail_pool.clear()
	_active_arrow_trails.clear()

## Prepare pools for scene transition - returns all active objects to pools
## Call this before changing scenes to prevent memory leaks
func prepare_for_scene_change() -> void:
	# Return all active arrows to pool
	for arrow in _active_arrows:
		if is_instance_valid(arrow):
			_disconnect_node_signals(arrow)
			arrow.set_process(false)
			arrow.set_physics_process(false)
			arrow.visible = false
			if arrow.has_method("reset_pooled_state"):
				arrow.reset_pooled_state()
			_arrow_pool.append(arrow)
	_active_arrows.clear()

	# Return all active enemies to pool
	for enemy in _active_enemies:
		if is_instance_valid(enemy):
			_disconnect_node_signals(enemy)
			enemy.set_process(false)
			enemy.set_physics_process(false)
			enemy.visible = false
			if enemy.has_method("reset_pooled_state"):
				enemy.reset_pooled_state()
			_enemy_pool.append(enemy)
	_active_enemies.clear()

	# Return all active hit effects to pool
	for effect in _active_hit_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_hit_effect_pool.append(effect)
	_active_hit_effects.clear()

	# Return all active death effects to pool
	for effect in _active_death_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_death_effect_pool.append(effect)
	_active_death_effects.clear()

	# Return all active crit effects to pool
	for effect in _active_crit_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_crit_effect_pool.append(effect)
	_active_crit_effects.clear()

	# Return all active miss effects to pool
	for effect in _active_miss_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_miss_effect_pool.append(effect)
	_active_miss_effects.clear()

	# Return all active fire effects to pool
	for effect in _active_fire_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_fire_effect_pool.append(effect)
	_active_fire_effects.clear()

	# Return all active ice effects to pool
	for effect in _active_ice_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_ice_effect_pool.append(effect)
	_active_ice_effects.clear()

	# Return all active lightning effects to pool
	for effect in _active_lightning_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_lightning_effect_pool.append(effect)
	_active_lightning_effects.clear()

	# Return all active charge effects to pool. Charge particles loop while
	# attached, so also stop emission (mirrors the arrow-trail block).
	for effect in _active_charge_effects:
		if is_instance_valid(effect):
			_disconnect_node_signals(effect)
			effect.set_process(false)
			effect.emitting = false
			effect.visible = false
			if effect.has_method("reset_pooled_state"):
				effect.reset_pooled_state()
			_charge_effect_pool.append(effect)
	_active_charge_effects.clear()

	# Return all active damage popups to pool
	for popup in _active_damage_popups:
		if is_instance_valid(popup):
			_disconnect_node_signals(popup)
			popup.set_process(false)
			popup.visible = false
			if popup.has_method("reset_pooled_state"):
				popup.reset_pooled_state()
			_damage_popup_pool.append(popup)
	_active_damage_popups.clear()

	# Return all active arrow trails to pool
	for trail in _active_arrow_trails:
		if is_instance_valid(trail):
			_disconnect_node_signals(trail)
			trail.set_process(false)
			trail.emitting = false
			trail.visible = false
			if trail.has_method("reset_pooled_state"):
				trail.reset_pooled_state()
			_arrow_trail_pool.append(trail)
	_active_arrow_trails.clear()

## Disconnect all signals from a node to prevent memory leaks
func _disconnect_node_signals(node: Node) -> void:
	if node == null or not is_instance_valid(node):
		return

	# Disconnect all connected signals
	for connection in node.get_signal_connection_list(""):
		# Skip built-in signals we want to keep
		pass

	# For child nodes, recursively disconnect
	for child in node.get_children():
		_disconnect_node_signals(child)

func _exit_tree() -> void:
	# Clean up all pooled objects when ObjectPool is freed
	cleanup_all()

	# Clear scene references to release memory
	_arrow_scene = null
	_enemy_scene = null
	_hit_effect_scene = null
	_death_effect_scene = null
	_crit_effect_scene = null
	_miss_effect_scene = null
	_fire_effect_scene = null
	_ice_effect_scene = null
	_lightning_effect_scene = null
	_charge_effect_scene = null
	_damage_popup_scene = null
	_arrow_trail_scene = null
