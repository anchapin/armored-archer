# AI Code Review Guidelines - Armored Archer

## Purpose

This document provides a comprehensive checklist for reviewing AI-generated code in Armored Archer, ensuring all contributions meet project quality standards, Godot 4.6 compatibility, and mobile performance requirements.

## Quick Reference Checklist

Use this as a rapid validation before integrating AI-generated code:

```
□ Godot 4.6 Syntax Compliance
□ Project Convention Adherence
□ Mobile Performance Considerations
□ Type Safety & Error Handling
□ Security & Input Validation
□ Test Coverage
```

## Detailed Review Criteria

### 1. Godot 4.6 Syntax Compliance

#### Callable Syntax (CRITICAL)
AI models may output deprecated Godot 3 string-based calls.

**❌ REJECT:**
```gdscript
# Godot 3 syntax - deprecated
call_deferred("method_name", args)
call_deferred_group("group", "method", args)
```

**✅ ACCEPT:**
```gdscript
# Godot 4.6 syntax - correct
method_name.call_deferred(args)
node.method_name.call_deferred(args)
group.call_deferred_group(method_name, args)
```

#### Signal Connection Patterns

**❌ REJECT:**
```gdscript
func _exit_tree():
    disconnect("signal_name", handler)  # Unnecessary in Godot 4.6
    if is_connected("other_signal"):
        disconnect("other_signal", other_handler)
```

**✅ ACCEPT:**
```gdscript
# Godot 4.6 handles signal cleanup automatically
# No _exit_tree() disconnection needed
# Just connect in _ready()
```

#### Type Hints (REQUIRED)

**❌ REJECT:**
```gdscript
var speed = 300
func get_position():
    return position
func set_value(val):
    value = val
```

**✅ ACCEPT:**
```gdscript
var speed: float = 300.0
func get_position() -> Vector2:
    return position
func set_value(val: float) -> void:
    value = val
```

### 2. Project Convention Adherence

#### Naming Conventions

| Element | Correct Format | Example |
|---------|---------------|---------|
| Variables | `snake_case` | `move_speed`, `target_angle`, `is_aiming` |
| Functions | `snake_case` | `handle_damage()`, `get_nearby_enemies()`, `_on_body_entered()` |
| Classes/Types | `PascalCase` | `PlayerController`, `EnemySpawner`, `DamagePopup` |
| Constants | `UPPER_SNAKE_CASE` | `BASE_SPEED`, `MAX_HEALTH`, `ARROW_SCENE` |
| Private Members | `_prefix` | `_current_state`, `_target_ref`, `_cached_value` |

#### Autoload Usage

**✅ CORRECT:**
```gdscript
@onready var game_manager: GameManager = $"/root/GameManager"
@onready var combat_manager: CombatManager = $"/root/CombatManager"

# Use autoloads for cross-scene data
GameManager.set_player_state(state)
var damage = CombatManager.calculate_damage(base, modifier)
```

**❌ INCORRECT:**
```gdscript
# Avoid get_node() calls at runtime
var game_manager = get_node("/root/GameManager")
```

#### Design Token Usage

**✅ CORRECT:**
```gdscript
# Use ArcherDesignTokens for all UI constants
var panel_color = ArcherDesignTokens.COLOR_SURFACE
var spacing = ArcherDesignTokens.SPACING_MD
var font_size = ArcherDesignTokens.FONT_SIZE_BASE

# Use helper functions for theme support
var bg_color = ArcherDesignTokens.get_background_color(ThemeManager.is_dark_mode)
```

### 3. Mobile Performance Considerations

#### Process Loop Usage

**❌ REJECT:**
```gdscript
func _process(delta):
    # Heavy calculation every frame
    for enemy in enemies:
        enemy.check_pathfinding()  # Expensive!
        enemy.calculate_line_of_sight()
        enemy.update_ai_state()
```

**✅ ACCEPT:**
```gdscript
func _process(delta):
    # Amortized updates - spread across frames
    var frame := Engine.get_process_frames() % 10
    if frame == 0:
        for enemy in enemies:
            enemy.check_pathfinding()  # Only every 10th frame
```

#### Distance Calculations

**❌ REJECT:**
```gdscript
# Square root is expensive
if position.distance_to(target) < 100:
```

**✅ ACCEPT:**
```gdscript
# Squared distance is much faster
if position.distance_squared_to(target) < 10000:  # 100²
```

#### Object Pooling

**✅ CORRECT:**
```gdscript
@onready var object_pool: ObjectPool = $"/root/ObjectPool"

func spawn_projectile():
    var proj = object_pool.get("arrow_projectile")
    # Configure and use
    # Auto-returns to pool via cleanup timer
```

**❌ INCORRECT:**
```gdscript
func spawn_projectile():
    var proj = ARROW_SCENE.instantiate()
    # Manual memory management - avoid when possible
```

### 4. Type Safety & Error Handling

#### Null Safety

**❌ REJECT:**
```gdscript
var enemy = get_node("/Enemy")
enemy.take_damage(10)  # Crashes if null!
```

**✅ ACCEPT:**
```gdscript
var enemy = get_node("/Enemy") as Node
if is_instance_valid(enemy):
    enemy.take_damage(10)

# Or use has_method check
if body and body.has_method("take_damage"):
    body.take_damage(10)
```

#### Error Reporting

**✅ CORRECT:**
```gdscript
if not is_instance_valid(player):
    push_error("Player reference is null - cannot process input")
    return

push_warning("Low health - showing critical warning")
```

### 5. Security & Input Validation

#### Server-Authoritative Design (Backend)

**❌ REJECT:**
```typescript
// Never trust client input!
export async function handleCombatRpc(ctx: RpcContext, payload: any) {
  // Client sends damage - DANGEROUS!
  const damage = payload.damage;
  // Apply directly without validation
  await updatePlayerHealth(userId, damage);
}
```

**✅ ACCEPT:**
```typescript
// Always validate and calculate server-side
export async function handleCombatRpc(ctx: RpcContext, payload: any) {
  const validated = z.object({
    damage: z.number(),
    targetId: z.string()
  }).parse(payload);

  // Use stored player stats, not client values
  const actualDamage = calculateDamage(validated.damage, playerStats);

  await updatePlayerHealth(userId, actualDamage);
}
```

### 6. Test Coverage Requirements

#### Generated Code Must Include Tests

For any AI-generated feature, verify:

**GDScript Tests:**
```gdscript
extends "res://test/test_framework.gd"

func test_new_feature():
    # Arrange
    var test_node = create_test_scenario()

    # Act
    test_node.perform_action()

    # Assert
    assert_true(test_node.expected_result, "Feature should work as expected")
    assert_eq(test_node.value, 100, "Value should be 100")

func create_test_scenario() -> Node:
    var node = FEATURE_SCENE.instantiate()
    get_tree().root.add_child(node)
    return node
```

**Backend Tests:**
```typescript
describe('NewFeature', () => {
  it('should validate input correctly', async () => {
    const result = await handleFeatureRpc(ctx, invalidPayload);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should work with valid input', async () => {
    const result = await handleFeatureRpc(ctx, validPayload);
    expect(result.success).toBe(true);
  });
});
```

## Review Workflow

1. **Initial Scan**: Run through Quick Reference Checklist
2. **Detailed Review**: Apply relevant sections from Detailed Review Criteria
3. **Automated Checks**: Run linting and tests
4. **Performance Validation**: Check for mobile optimization patterns
5. **Security Review**: Verify server-authoritative design for backend changes
6. **Approval Decision**: Approve, request revisions, or reject

## Common AI Issues & Solutions

| Issue | Detection | Fix |
|-------|-----------|-----|
| Godot 3 syntax | Look for `call_deferred("method")` | Convert to Callable |
| Missing types | Search for `var x =` without type hint | Add explicit types |
| Naming mismatch | Check variable/function names | Convert to snake_case |
| Heavy loops | `_process` with heavy logic | Amortize across frames |
| Manual cleanup | Signal disconnection in `_exit_tree` | Remove (engine handles) |
| No tests | Feature without test file | Request test generation |
| Unsafe operations | Null access without check | Add safety checks |

## Documentation Updates

When approving AI-generated code, ensure:
- [ ] AGENTS.md is updated if new patterns emerge
- [ ] CLAUDE.md is updated if project conventions change
- [ ] AI_INTEGRATION.md templates are refined if needed
- [ ] Feature documentation is created for complex systems
