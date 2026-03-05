# GDScript Null Safety Patterns

This document outlines the null safety patterns and best practices implemented in the Armored Archer codebase to prevent null pointer errors, memory leaks, and ensure robust code quality.

## Table of Contents

1. [Null Safety Checks](#null-safety-checks)
2. [Signal Cleanup Pattern](#signal-cleanup-pattern)
3. [Type Hints](#type-hints)
4. [Best Practices](#best-practices)

---

## Null Safety Checks

### Using `is_instance_valid()` for Nodes

When working with nodes that may have been freed (e.g., from object pools), always validate before use:

```gdscript
# Check if an instance is still valid before accessing
for enemy in active_enemies:
    if is_instance_valid(enemy):
        enemy.take_damage(damage)
```

### Checking for Null Before Method Calls

Always verify a node exists before calling methods on it:

```gdscript
# Bad - may crash if player_ref is null
var direction = (player_ref.global_position - global_position).normalized()

# Good - null check before method call
if player_ref:
    var direction = (player_ref.global_position - global_position).normalized()
```

### Using `has_method()` for Dynamic Method Calls

When calling methods dynamically on unknown node types:

```gdscript
# Check if method exists before calling
if enemy_instance and enemy_instance.has_method("reset_for_spawn"):
    enemy_instance.reset_for_spawn()
```

### Using `has_signal()` Before Signal Connections

Verify signals exist before connecting:

```gdscript
# Validate signal exists before connecting
if enemy_instance and enemy_instance.has_signal("died"):
    var died_connection: Callable = enemy_instance.died.connect(_on_enemy_died)
    _signal_connections.append(died_connection)
```

### Using `get_node_or_null()` for Safe Node Retrieval

Instead of using `get_node()` which throws errors, use safe retrieval:

```gdscript
# Safe node retrieval - returns null if not found
@onready var network_manager: Node = get_node_or_null("/root/NetworkManager")

# Later, check before use
if not network_manager or not network_manager.is_connected:
    push_error("Not connected to server")
    return
```

---

## Signal Cleanup Pattern

### The Problem

Connected signals in Godot can cause:
- Memory leaks (callbacks to freed nodes)
- Ghost callbacks (signals firing on queued-for-deletion nodes)
- Duplicate connections on scene reloads

### The Solution: _exit_tree() Cleanup

Always implement `_exit_tree()` to clean up signal connections:

```gdscript
# --- Signal connections for cleanup ---
var _hurt_area_connection: Callable = Callable()

func _ready() -> void:
    if hurt_area:
        # Store Callable reference for later cleanup
        _hurt_area_connection = hurt_area.body_entered.connect(_on_hurt_area_body_entered)

func _exit_tree() -> void:
    # Clean up connected signals to prevent memory leaks
    if hurt_area and _hurt_area_connection.is_valid():
        if hurt_area.is_connected("body_entered", _on_hurt_area_body_entered):
            hurt_area.disconnect("body_entered", _hurt_area_connection)
```

### Multiple Signal Connections

For classes with multiple signal connections:

```gdscript
# --- Signal connections for cleanup ---
var _preview_mode_connection: Callable = Callable()
var _slot_selector_connection: Callable = Callable()
var _item_selector_connection: Callable = Callable()

func _setup_ui() -> void:
    _preview_mode_connection = preview_mode.item_selected.connect(_on_preview_mode_changed)
    _slot_selector_connection = slot_selector.item_selected.connect(_on_slot_changed)
    _item_selector_connection = item_selector.item_selected.connect(_on_item_changed)

func _exit_tree() -> void:
    _cleanup_signal_connection(preview_mode, "item_selected", _preview_mode_connection)
    _cleanup_signal_connection(slot_selector, "item_selected", _slot_selector_connection)
    _cleanup_signal_connection(item_selector, "item_selected", _item_selector_connection)

func _cleanup_signal_connection(node: Node, signal_name: String, connection: Callable) -> void:
    if node and connection.is_valid() and node.is_connected(signal_name, connection):
        node.disconnect(signal_name, connection)
```

### Timer Signal Cleanup

For timer signals specifically:

```gdscript
func _exit_tree() -> void:
    _cleanup_timer_signal(spawn_timer_node, _on_spawn_timer_timeout)
    _cleanup_timer_signal(wave_timer_node, _on_wave_timer_timeout)

func _cleanup_timer_signal(timer: Timer, callback: Callable) -> void:
    if timer and timer.is_connected("timeout", callback):
        timer.disconnect("timeout", callback)
```

---

## Type Hints

### Why Type Hints Matter

Type hints in GDScript 4.x provide:
- Compile-time error detection
- Better IDE autocompletion
- Self-documenting code

### Variable Declarations

```gdscript
# Explicit type hints
var current_health: int
var move_speed: float
var player_ref: CharacterBody2D = null
var active_enemies: Array[Node] = []
var spawn_position: Vector2 = Vector2.ZERO
```

### Function Return Types

Always specify return types:

```gdscript
# Bad
func get_random_spawn_position():
    return Vector2(randf(), randf())

# Good
func get_random_spawn_position() -> Vector2:
    return Vector2(randf(), randf())

func is_boss_alive() -> bool:
    var bosses: Array[Node] = get_tree().get_nodes_in_group("Boss")
    return bosses.size() > 0
```

### Type Casting

Use explicit casting for more precise type information:

```gdscript
# Get nodes from groups with proper typing
var players: Array[Node] = get_tree().get_nodes_in_group("Player")
if players.size() > 0:
    player_ref = players[0] as CharacterBody2D
```

### Dictionary Access

When accessing dictionary values, use bracket notation with null checks:

```gdscript
# Safe dictionary access
if response.has("error"):
    push_error("Failed: %s" % response["error"])

# Or use get() with defaults
my_health = current_match_state.get("creator_health", 100)
```

---

## Best Practices

### 1. @onready Assumptions

Never assume `@onready` nodes exist. Always validate:

```gdscript
@onready var sprite: Sprite2D = $Sprite2D

func chase_player() -> void:
    if not player_ref:
        return
    var direction: Vector2 = (player_ref.global_position - global_position).normalized()
    velocity = direction * move_speed
    if sprite:
        sprite.flip_h = direction.x < 0
```

### 2. Object Pool Safety

When using object pools, validate instances:

```gdscript
var enemy_instance: Node = ObjectPool.get_enemy()

# Validate before use
if enemy_instance:
    enemy_instance.global_position = spawn_position
```

### 3. Array Bounds Checking

Always check array bounds before access:

```gdscript
func _on_slot_changed(index: int) -> void:
    var slots: Array[String] = ["helm", "armor", "bow", "arrow"]
    if index >= 0 and index < slots.size():
        current_slot = slots[index]
```

### 4. Use Null Coalescing

GDScript supports null-safe operations:

```gdscript
# Null coalescing for Dictionary get
item_name = skin_data.skin_name if skin_data else item_id

# Using get() with defaults
var health: int = current_match_state.get("creator_health", 100)
```

### 5. Document Signal Cleanup

Always document cleanup requirements in class docstrings:

```gdscript
## Base enemy class for all enemy types.
## Provides common functionality for health, damage, and death handling.
##
## Usage:
## - Extend this class for custom enemy behavior
## - Override _ready(), _physics_process(), and take_damage() as needed
## - Call super._ready() in extended _ready() to ensure proper initialization
## - Implement _exit_tree() cleanup if overriding signal connections
```

---

## Summary

By following these patterns consistently:
1. **Prevent crashes** from null pointer dereferences
2. **Avoid memory leaks** from un-cleaned signals
3. **Improve code quality** with explicit type hints
4. **Make code self-documenting** with clear null checks

Remember: In GDScript, it's better to check for null explicitly than to rely on exceptions being thrown.
