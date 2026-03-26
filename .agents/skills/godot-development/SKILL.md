---
keywords:
  - godot
  - gdscript
  - 2d-game
  - sprites
  - animation
  - scene
description: Guidelines for Godot 2D game development with this project, including quirks, workflows, and common pitfalls
---

# Godot Development Skill

Guidelines for developing the Armored Archer 2D game in Godot.

## Project Structure

- `scenes/` - Game scenes (.tscn files)
- `scripts/` - GDScript files (.gd)
- `assets/sprites/` - Sprite assets
- `autoloads/` - Singleton scripts
- `test/` - Test files

## Key Commands

```bash
# Validate project (check for parse errors)
godot4 --headless --quit

# Import new/modified assets (IMPORTANT - run after adding new sprites)
godot4 --headless --import

# Run tests
godot4 --headless --script res://test/run_all_tests.gd

# Quick syntax check
gdlint autoloads/*.gd scenes/**/*.gd scripts/*.gd test/*.gd
```

## Common Workflows

### Adding New Sprites/Assets

1. Add PNG files to `assets/sprites/`
2. Run `godot4 --headless --import` to generate .import files
3. Reference in SpriteFrames resource or TextureRect
4. Test in editor

### Creating New Scenes

1. Create scene with root node (e.g., Node2D, CharacterBody2D)
2. Add child nodes with proper types
3. Attach scripts to nodes
4. Save as .tscn in appropriate folder

### Running the Game

- Press F5 in Godot editor to run
- Default scene is defined in project.godot (runnable scene)

## Godot 2D Quirks & Pitfalls

### Type Inference Errors

```gdscript
# WRONG — load() returns Resource, which has no instantiate():
var scene := load("res://path/to/scene.tscn")
var instance = scene.instantiate()  # Error: Resource has no instantiate()

# CORRECT — type load() explicitly AND use = (not :=):
var scene: PackedScene = load("res://path/to/scene.tscn")
var instance = scene.instantiate()  # Works

# WRONG — := with array element access (returns Variant):
var item := my_array[i]  # Error: Cannot infer type

# CORRECT — explicit type or untyped:
var item: String = my_array[i]  # OK
var item = my_array[i]           # OK (untyped)
```

### Collision Layers (2D)

`collision_layer` and `collision_mask` are bitmasks, NOT UI layer numbers:
- UI Layer 1 = bitmask 1
- UI Layer 2 = bitmask 2
- UI Layer 3 = bitmask 4
- UI Layer 4 = bitmask 8 (powers of 2)

```gdscript
# Set collision on layers 1 and 3 (bitmask = 1 + 4 = 5)
collision_layer = 5
collision_mask = 5
```

### Camera2D

- No `current` property like Camera3D
- Use `make_current()` to activate
- Must be in scene tree before calling `make_current()`

### Node References

```gdscript
# WRONG — @onready with conditional:
@onready var node = $Node if has_node("Node") else null  # Unreliable

# CORRECT — resolve in _ready():
var node: Node2D = null

func _ready() -> void:
    node = get_node_or_null("Node")
```

### Signal Connections

```gdscript
# In _ready(), connect signals:
func _ready() -> void:
    $Area2D.body_entered.connect(_on_body_entered)

# Use callable for methods with parameters:
$Button.pressed.connect(_on_button_pressed.bind(extra_arg))
```

### AnimationPlayer/AnimatedSprite2D

- AnimatedSprite2D requires SpriteFrames resource
- Animation names must match exactly in code and resource
- Use `play("animation_name")` not `play_animation()`

### Scene Instantiation

```gdscript
# Load and instantiate scenes:
var scene: PackedScene = preload("res://scenes/enemy.tscn")
var enemy = scene.instantiate()
add_child(enemy)
enemy.position = Vector2(100, 200)
```

### Memory Management

- Use `queue_free()` for deferred cleanup (clean at end of frame)
- Use `free()` for immediate cleanup in tests
- Always set timers for projectiles to prevent memory leaks

### Input Handling

```gdscript
# Get input vector (handles diagonal normalization):
var direction = Input.get_vector("move_left", "move_right", "move_up", "move_down")

# Check deadzone for joysticks:
if input_vector.length() > 0.1:
    # Actual input
```

## Debugging Tips

```gdscript
# Print to console (remove in production):
print("Player position: ", position)

# Use Godot's debug system:
push_warning("This is a warning")
push_error("This is an error")  # Won't stop execution but logs error
```

## Common Issues

### Sprites Not Displaying

1. Check node is visible (`visible = true`)
2. Check texture is assigned
3. Check position is within camera view
4. Check z_index/layer
5. Run `godot4 --headless --import` after adding new assets

### Animations Not Playing

1. Check SpriteFrames resource is assigned
2. Check animation name matches exactly (case-sensitive)
3. Check animation is not set to "Reset" on loop end

### Scene Builder Issues

When generating .tscn via script:
- Remember to call `root.get_tree().quit()` at the end
- _ready() doesn't fire during script execution - call init methods manually