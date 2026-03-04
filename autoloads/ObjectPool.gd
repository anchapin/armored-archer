## Object Pool Manager for Efficient Object Reuse
## Reduces garbage collection pressure and improves performance on budget devices
## by recycling projectiles, enemies, and other frequently created/destroyed objects
##
## Usage:
##   ObjectPool.create_pool(scene_path, initial_size) - Create a new object pool
##   ObjectPool.get_object(pool_id) - Get an object from the pool
##   ObjectPool.return_object(pool_id, object) - Return an object to the pool
##   ObjectPool.get_pool_stats(pool_id) - Get statistics about a pool
##
extends Node

# --- Pool Configuration ---
const DEFAULT_POOL_SIZE: int = 20
const POOL_GROWTH_INCREMENT: int = 5
const MAX_POOL_SIZE: int = 100

# --- Pool Entry ---
class PoolEntry:
	var scene: PackedScene
	var available: Array[Node] = []
	var active: Array[Node] = []
	var pool_id: String

# --- Pool Storage ---
var _pools: Dictionary = {}  # pool_id -> PoolEntry
var _pool_order: Array = []  # For consistent iteration

# --- Statistics ---
var _total_objects_created: int = 0
var _total_objects_reused: int = 0

# --- Signals ---
signal object_pooled(pool_id: String, object: Node)
signal object_activated(pool_id: String, object: Node)
signal object_deactivated(pool_id: String, object: Node)
signal pool_created(pool_id: String, initial_size: int)
signal pool_exhausted(pool_id: String)

func _ready() -> void:
	print("[ObjectPool] Initialized")

## Create a new object pool
## Returns pool_id for later use
func create_pool(scene_path: String, initial_size: int = DEFAULT_POOL_SIZE, pool_id: String = "") -> String:
	# Generate pool_id from scene path if not provided
	if pool_id.is_empty():
		pool_id = _generate_pool_id(scene_path)
	
	# Return existing pool if already exists
	if _pools.has(pool_id):
		print("[ObjectPool] Pool already exists: %s" % pool_id)
		return pool_id
	
	var scene = load(scene_path)
	if scene == null:
		push_error("[ObjectPool] Failed to load scene: %s" % scene_path)
		return ""
	
	var entry = PoolEntry.new()
	entry.scene = scene
	entry.pool_id = pool_id
	
	# Pre-instantiate objects
	initial_size = clamp(initial_size, 1, MAX_POOL_SIZE)
	for i in range(initial_size):
		var obj = _create_new_object(entry)
		if obj:
			entry.available.append(obj)
	
	_pools[pool_id] = entry
	_pool_order.append(pool_id)
	_total_objects_created += initial_size
	
	pool_created.emit(pool_id, initial_size)
	print("[ObjectPool] Created pool '%s' with %d objects" % [pool_id, initial_size])
	
	return pool_id

## Get an object from the pool
## Returns null if pool doesn't exist and can't be created
func get_object(pool_id: String) -> Node:
	if not _pools.has(pool_id):
		push_error("[ObjectPool] Pool not found: %s" % pool_id)
		return null
	
	var entry = _pools[pool_id]
	var obj: Node = null
	
	# Try to get from available pool
	if entry.available.size() > 0:
		obj = entry.available.pop_back()
		_total_objects_reused += 1
	else:
		# Pool exhausted - create new if under max
		if entry.active.size() + entry.available.size() < MAX_POOL_SIZE:
			obj = _create_new_object(entry)
			_total_objects_created += 1
		else:
			pool_exhausted.emit(pool_id)
			return null
	
	# Activate and return object
	if obj:
		obj.reparent(get_tree().root)
		obj.visible = true
		entry.active.append(obj)
		object_activated.emit(pool_id, obj)
	
	return obj

## Return an object to the pool
func return_object(pool_id: String, object: Node) -> void:
	if not _pools.has(pool_id):
		push_error("[ObjectPool] Pool not found: %s" % pool_id)
		return
	
	if not is_instance_valid(object):
		return
	
	var entry = _pools[pool_id]
	
	# Remove from active list
	if object in entry.active:
		entry.active.erase(object)
	
	# Reset object state
	_reset_object(object)
	
	# Add to available pool
	entry.available.append(object)
	object_deactivated.emit(pool_id, object)

## Return all active objects to the pool
func return_all_objects(pool_id: String) -> void:
	if not _pools.has(pool_id):
		return
	
	var entry = _pools[pool_id]
	
	# Make a copy since we'll be modifying the array
	var active_copy = entry.active.duplicate()
	
	for obj in active_copy:
		return_object(pool_id, obj)

## Clear a specific pool
func clear_pool(pool_id: String) -> void:
	if not _pools.has(pool_id):
		return
	
	var entry = _pools[pool_id]
	
	# Return all objects first
	return_all_objects(pool_id)
	
	# Free available objects
	for obj in entry.available:
		if is_instance_valid(obj):
			obj.queue_free()
	
	entry.available.clear()
	_pools.erase(pool_id)
	_pool_order.erase(pool_id)
	
	print("[ObjectPool] Cleared pool: %s" % pool_id)

## Clear all pools
func clear_all_pools() -> void:
	for pool_id in _pool_order:
		clear_pool(pool_id)
	
	_total_objects_created = 0
	_total_objects_reused = 0
	print("[ObjectPool] Cleared all pools")

## Get pool statistics
func get_pool_stats(pool_id: String) -> Dictionary:
	if not _pools.has(pool_id):
		return {}
	
	var entry = _pools[pool_id]
	return {
		"pool_id": pool_id,
		"active_count": entry.active.size(),
		"available_count": entry.available.size(),
		"total_count": entry.active.size() + entry.available.size(),
		"reuse_ratio": _calculate_reuse_ratio(entry)
	}

## Get all pool statistics
func get_all_stats() -> Dictionary:
	var stats: Dictionary = {
		"total_objects_created": _total_objects_created,
		"total_objects_reused": _total_objects_reused,
		"overall_reuse_ratio": _calculate_overall_reuse_ratio(),
		"pool_count": _pools.size(),
		"pools": {}
	}
	
	for pool_id in _pool_order:
		stats["pools"][pool_id] = get_pool_stats(pool_id)
	
	return stats

## Check if pool exists
func has_pool(pool_id: String) -> bool:
	return _pools.has(pool_id)

## Get pool size
func get_pool_size(pool_id: String) -> int:
	if not _pools.has(pool_id):
		return 0
	var entry = _pools[pool_id]
	return entry.active.size() + entry.available.size()

## Get number of active objects in pool
func get_active_count(pool_id: String) -> int:
	if not _pools.has(pool_id):
		return 0
	return _pools[pool_id].active.size()

## Get number of available objects in pool
func get_available_count(pool_id: String) -> int:
	if not _pools.has(pool_id):
		return 0
	return _pools[pool_id].available.size()

## Set pool size (grow or shrink)
func set_pool_size(pool_id: String, new_size: int) -> void:
	if not _pools.has(pool_id):
		return
	
	new_size = clamp(new_size, 1, MAX_POOL_SIZE)
	var entry = _pools[pool_id]
	var current_size = entry.active.size() + entry.available.size()
	
	if new_size > current_size:
		# Grow pool
		var to_create = new_size - current_size
		for i in range(to_create):
			var obj = _create_new_object(entry)
			if obj:
				entry.available.append(obj)
		_total_objects_created += to_create
	elif new_size < current_size:
		# Shrink pool - remove from available
		var to_remove = current_size - new_size
		for i in range(to_remove):
			if entry.available.size() > 0:
				var obj = entry.available.pop_back()
				if is_instance_valid(obj):
					obj.queue_free()

# --- Internal Methods ---

func _create_new_object(entry: PoolEntry) -> Node:
	var obj = entry.scene.instantiate()
	if obj:
		obj.reparent(self)
		obj.visible = false
		# Store pool_id on object for easy reference
		obj.set_meta("pool_id", entry.pool_id)
	return obj

func _reset_object(object: Node) -> void:
	# Hide object
	object.visible = false
	
	# Reset position off-screen or to pool location
	object.position = Vector2.ZERO
	
	# Call reset callback if implemented
	if object.has_method("_on_pool_reset"):
		object._on_pool_reset()

func _generate_pool_id(scene_path: String) -> String:
	# Generate a simple ID from the scene path
	var filename = scene_path.get_file()
	filename = filename.get_basename()
	return filename

func _calculate_reuse_ratio(entry: PoolEntry) -> float:
	var total = entry.active.size() + entry.available.size()
	if total == 0:
		return 0.0
	# Ratio of current available vs total ever created would require more tracking
	# For now, return active/available ratio
	if entry.available.size() == 0:
		return 1.0 if entry.active.size() > 0 else 0.0
	return float(entry.active.size()) / float(entry.available.size() + entry.active.size())

func _calculate_overall_reuse_ratio() -> float:
	if _total_objects_created == 0:
		return 0.0
	return float(_total_objects_reused) / float(_total_objects_created)

# --- Helper Functions ---

## Convenience function to get projectile from common pool
func get_projectile() -> Node:
	return get_object("projectile")

## Convenience function to return projectile to pool
func return_projectile(projectile: Node) -> void:
	return_object("projectile", projectile)

## Convenience function to get enemy from common pool
func get_enemy() -> Node:
	return get_object("enemy")

## Convenience function to return enemy to pool
func return_enemy(enemy: Node) -> void:
	return_object("enemy", enemy)
