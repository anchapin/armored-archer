## Level of Detail (LOD) Manager for Budget Device Optimization
## Dynamically adjusts rendering and game complexity based on device performance
##
## Usage:
##   LODManager.set_quality_level(level) - Set quality (0=budget, 1=mid, 2=high)
##   LODManager.get_quality_level() - Get current quality level
##   LODManager.should_render_shadows() - Check if shadows should render
##   LODManager.should_use_particles() - Check if particles should render
##   LODManager.register_entity(entity) - Register entity for LOD management
##   LODManager.unregister_entity(entity) - Unregister entity
##
extends Node

# --- Quality Levels ---
enum QualityLevel { BUDGET = 0, MID_RANGE = 1, HIGH = 2 }

# --- LOD Settings per quality level ---
const LOD_SETTINGS: Dictionary = {
	QualityLevel.BUDGET: {
		"shadows_enabled": false,
		"particles_enabled": false,
		"max_visible_enemies": 10,
		"max_visible_projectiles": 5,
		"update_interval": 0.2,  # Update every 200ms
		"sprite_scale": 1.0,
		"effects_quality": 0.0,
		"physics_iterations": 1,
		"use_culling": true,
		"ui_complexity": "simple"
	},
	QualityLevel.MID_RANGE: {
		"shadows_enabled": true,
		"particles_enabled": true,
		"max_visible_enemies": 20,
		"max_visible_projectiles": 15,
		"update_interval": 0.1,
		"sprite_scale": 1.0,
		"effects_quality": 0.5,
		"physics_iterations": 2,
		"use_culling": true,
		"ui_complexity": "normal"
	},
	QualityLevel.HIGH: {
		"shadows_enabled": true,
		"particles_enabled": true,
		"max_visible_enemies": 50,
		"max_visible_projectiles": 50,
		"update_interval": 0.05,
		"sprite_scale": 1.0,
		"effects_quality": 1.0,
		"physics_iterations": 3,
		"use_culling": false,
		"ui_complexity": "full"
	}
}

# --- Current State ---
var _current_quality_level: QualityLevel = QualityLevel.HIGH
var _auto_adjust_enabled: bool = true
var _performance_check_timer: float = 0.0
var _performance_check_interval: float = 2.0  # Check every 2 seconds

# --- Registered Entities ---
var _registered_entities: Array[Node] = []
var _visible_entities: Array[Node] = []
var _entity_cull_distance: float = 1000.0  # Distance in pixels

# --- Signals ---
signal quality_level_changed(new_level: QualityLevel, old_level: QualityLevel)
signal entity_culled(entity: Node)
signal entity_shown(entity: Node)

func _ready() -> void:
	_initialize_lod()

func _initialize_lod() -> void:
	# Detect device tier and set initial quality
	_detect_and_apply_quality()
	print("[LODManager] Initialized - Quality Level: %s" % _get_quality_name())

func _process(delta: float) -> void:
	if not _auto_adjust_enabled:
		return
	
	_performance_check_timer += delta
	if _performance_check_timer >= _performance_check_interval:
		_performance_check_timer = 0.0
		_adjust_quality_if_needed()

func _detect_and_apply_quality() -> void:
	if not has_node("/root/PerformanceProfiler"):
		_current_quality_level = QualityLevel.HIGH
		return
	
	var profiler = get_node("/root/PerformanceProfiler")
	
	if profiler.is_budget_device():
		_current_quality_level = QualityLevel.BUDGET
	elif profiler.is_mid_range_device():
		_current_quality_level = QualityLevel.MID_RANGE
	else:
		_current_quality_level = QualityLevel.HIGH
	
	_apply_quality_settings()

func _adjust_quality_if_needed() -> void:
	if not has_node("/root/PerformanceProfiler"):
		return
	
	var profiler = get_node("/root/PerformanceProfiler")
	var current_fps = profiler.get_fps()
	var target_fps = profiler.get_target_fps()
	
	var old_level = _current_quality_level
	
	# Adjust quality based on FPS
	if current_fps < target_fps * 0.7:  # Below 70% of target
		_current_quality_level = max(QualityLevel.BUDGET, _current_quality_level - 1)
	elif current_fps >= target_fps * 0.95 and _current_quality_level < QualityLevel.HIGH:  # Above 95% of target
		_current_quality_level = min(QualityLevel.HIGH, _current_quality_level + 1)
	
	if old_level != _current_quality_level:
		_apply_quality_settings()
		quality_level_changed.emit(_current_quality_level, old_level)

func _apply_quality_settings() -> void:
	var settings = LOD_SETTINGS[_current_quality_level]
	
	# Apply rendering settings
	_apply_rendering_settings(settings)
	
	# Update culling distance based on quality
	_entity_cull_distance = 800.0 if settings["use_culling"] else 10000.0
	
	print("[LODManager] Applied quality settings: %s (shadows: %s, particles: %s)" %
		[_get_quality_name(), settings["shadows_enabled"], settings["particles_enabled"]])

func _apply_rendering_settings(settings: Dictionary) -> void:
	# Shadow settings would be applied here
	# This is where we'd configure shadow quality in the rendering engine
	
	# Particle settings are informational - actual particle control happens elsewhere
	# The get_should_use_particles() method should be checked before spawning particles

# --- Public API ---

## Get current quality level (0=Budget, 1=Mid-Range, 2=High)
func get_quality_level() -> int:
	return _current_quality_level

## Set quality level manually (0=Budget, 1=Mid-Range, 2=High)
func set_quality_level(level: int) -> void:
	var new_level = clamp(level, QualityLevel.BUDGET, QualityLevel.HIGH)
	if new_level != _current_quality_level:
		var old_level = _current_quality_level
		_current_quality_level = new_level
		_apply_quality_settings()
		quality_level_changed.emit(_current_quality_level, old_level)

## Enable or disable auto quality adjustment
func set_auto_adjust(enabled: bool) -> void:
	_auto_adjust_enabled = enabled

## Check if shadows should be rendered
func should_render_shadows() -> bool:
	return LOD_SETTINGS[_current_quality_level]["shadows_enabled"]

## Check if particle effects should be rendered
func should_use_particles() -> bool:
	return LOD_SETTINGS[_current_quality_level]["particles_enabled"]

## Get maximum visible enemies for current quality
func get_max_visible_enemies() -> int:
	return LOD_SETTINGS[_current_quality_level]["max_visible_enemies"]

## Get maximum visible projectiles for current quality
func get_max_visible_projectiles() -> int:
	return LOD_SETTINGS[_current_quality_level]["max_visible_projectiles"]

## Get update interval for current quality
func get_update_interval() -> float:
	return LOD_SETTINGS[_current_quality_level]["update_interval"]

## Get effects quality (0.0 to 1.0)
func get_effects_quality() -> float:
	return LOD_SETTINGS[_current_quality_level]["effects_quality"]

## Get physics iterations for current quality
func get_physics_iterations() -> int:
	return LOD_SETTINGS[_current_quality_level]["physics_iterations"]

## Get UI complexity setting
func get_ui_complexity() -> String:
	return LOD_SETTINGS[_current_quality_level]["ui_complexity"]

## Register entity for LOD management (visibility culling)
func register_entity(entity: Node) -> void:
	if entity not in _registered_entities:
		_registered_entities.append(entity)

## Unregister entity from LOD management
func unregister_entity(entity: Node) -> void:
	if entity in _registered_entities:
		_registered_entities.erase(entity)
	if entity in _visible_entities:
		_visible_entities.erase(entity)

## Update visibility based on camera position
## Call this from camera or main scene to cull distant entities
func update_visibility(camera_position: Vector2) -> void:
	if not LOD_SETTINGS[_current_quality_level]["use_culling"]:
		# Show all entities if culling is disabled
		for entity in _registered_entities:
			if entity not in _visible_entities and is_instance_valid(entity):
				_visible_entities.append(entity)
				entity_shown.emit(entity)
		return
	
	var cull_distance_sq = _entity_cull_distance * _entity_cull_distance
	
	for entity in _registered_entities:
		if not is_instance_valid(entity):
			continue
		
		var entity_pos = entity.global_position
		var distance_sq = entity_pos.distance_squared_to(camera_position)
		
		if distance_sq > cull_distance_sq:
			# Entity is too far - cull it
			if entity in _visible_entities:
				_visible_entities.erase(entity)
				entity_culled.emit(entity)
			entity.visible = false
		else:
			# Entity is visible
			if entity not in _visible_entities:
				_visible_entities.append(entity)
				entity_shown.emit(entity)
			entity.visible = true

## Check if an entity is currently visible
func is_entity_visible(entity: Node) -> bool:
	return entity in _visible_entities

## Get count of visible entities
func get_visible_entity_count() -> int:
	return _visible_entities.size()

## Get count of registered entities
func get_registered_entity_count() -> int:
	return _registered_entities.size()

## Get LOD settings for current quality as dictionary
func get_current_settings() -> Dictionary:
	return LOD_SETTINGS[_current_quality_level].duplicate()

## Get quality level name
func _get_quality_name() -> String:
	match _current_quality_level:
		QualityLevel.BUDGET:
			return "Budget"
		QualityLevel.MID_RANGE:
			return "Mid-Range"
		_:
			return "High"

## Force refresh quality settings
func refresh_settings() -> void:
	_detect_and_apply_quality()
