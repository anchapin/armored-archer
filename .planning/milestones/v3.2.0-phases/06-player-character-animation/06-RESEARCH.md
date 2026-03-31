# Phase 06: Player Character Animation - Research

**Researched:** 2026-03-24
**Domain:** Godot 4.x GDScript Animation System
**Confidence:** HIGH

## Summary

Phase 06 requires creating player character sprite animations with full state machine integration. The player scene currently uses basic Sprite2D nodes (`scenes/player.tscn`) and needs to be converted to use AnimatedSprite2D with SpriteFrames. Key signals from GameManager (`health_changed`, `player_died`) need to be connected to trigger appropriate animations. The player script (`scripts/character_body_2d.gd`) already tracks `is_moving` and `is_aiming` states which can drive the animation state machine.

**Primary recommendation:** Convert player scene to use AnimatedSprite2D with SpriteFrames, create all required animations (idle, walk, attack, bow_draw, hit, death), and implement a state machine in the player script that responds to both input and GameManager signals.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Pixel-perfect rendering required (Nearest texture filter) — configured in Phase 05
- Use AnimatedSprite2D with SpriteFrames for animations
- 4-directional walk (not 8-directional)
- State machine driven by GameManager signals

### Claude's Discretion
- Sprite art style (consistent with pixel art aesthetic)
- Frame counts within specified ranges
- Animation timing and easing
- State machine implementation details
- How to wire GameManager signals to animations

### Deferred Ideas (OUT OF SCOPE)
- 8-directional animations (deferred to v2)
- Animation blending/transitions (deferred to v2)
- Bow charge level animations (deferred to v2)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-01 | Create player idle animation (4-8 frames) | AnimatedSprite2D with SpriteFrames, FPS control |
| PLAY-02 | Create player walk animation (4-8 frames, 4-directional) | 4 cardinal directions: up/down/left/right |
| PLAY-03 | Create player attack animation (6-8 frames) | animation_finished signal for one-shot animations |
| PLAY-04 | Create bow draw animation (6-8 frames) | Loops during aim, stops when released |
| PLAY-05 | Create player hit/damage animation (2-4 frames) | Connect to GameManager.health_changed signal |
| PLAY-06 | Create player death animation (6-8 frames) | Connect to GameManager.player_died signal |
| PLAY-07 | Implement AnimatedSprite2D with SpriteFrames for player | Replace existing Sprite2D nodes |
| PLAY-08 | Connect animation state machine to GameManager signals | Signal connection in _ready() |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Godot 4.x | 4.6+ | Game engine | Project requirement |
| AnimatedSprite2D | Built-in | Sprite animation | Recommended in Godot docs |
| SpriteFrames | Built-in | Animation data storage | Standard Godot resource |

### Implementation Approach
| Component | Approach | Rationale |
|-----------|----------|-----------|
| Animation node | AnimatedSprite2D | Simpler than AnimationPlayer for frame-based animation |
| Direction handling | 4 sprites (up/down/left/right) | Matches locked 4-directional decision |
| State management | Enum-based state machine | Clean, type-safe state transitions |
| Signal handling | Callable connect syntax | Modern Godot 4 pattern |

---

## Architecture Patterns

### Recommended Project Structure
```
assets/sprites/player/
├── idle/
│   ├── idle_down_0.png  (frame 0)
│   ├── idle_down_1.png  (frame 1)
│   └── ... (up to 8 frames)
├── walk/
│   ├── walk_down_0.png
│   └── ...
├── attack/
│   ├── attack_0.png
│   └── ...
├── bow_draw/
│   ├── draw_0.png
│   └── ...
├── hit/
│   ├── hit_0.png
│   └── ...
└── death/
    ├── death_0.png
    └── ...
```

### Pattern 1: AnimatedSprite2D with SpriteFrames
**What:** Replace Sprite2D with AnimatedSprite2D, configure SpriteFrames in editor
**When to use:** Frame-based pixel art animations
**Example:**
```gdscript
# Create SpriteFrames programmatically (or configure in editor)
var sprite_frames := SpriteFrames.new()
sprite_frames.add_animation("idle_down")
sprite_frames.set_animation_speed("idle_down", 8.0)  # 8 FPS
sprite_frames.set_animation_loop("idle_down", true)

# Add frames (load actual textures)
for i in range(6):
    var texture := load("res://assets/sprites/player/idle/idle_down_%d.png" % i)
    sprite_frames.add_frame("idle_down", texture)

# Assign to AnimatedSprite2D
$AnimatedSprite2D.sprite_frames = sprite_frames
$AnimatedSprite2D.play("idle_down")
```

### Pattern 2: Directional Animation State Machine
**What:** Map 4-directional input to animation suffixes
**When to use:** Character movement with directional sprites
**Example:**
```gdscript
enum Direction { DOWN, UP, LEFT, RIGHT }

func get_direction_suffix(direction: Vector2) -> String:
    if abs(direction.x) > abs(direction.y):
        return "right" if direction.x > 0 else "left"
    else:
        return "down" if direction.y > 0 else "up"

func update_animation() -> void:
    var suffix := get_direction_suffix(input_direction)
    
    if is_aiming:
        animated_sprite.play("bow_draw_" + suffix)
    elif is_moving:
        animated_sprite.play("walk_" + suffix)
    else:
        animated_sprite.play("idle_" + suffix)
```

### Pattern 3: GameManager Signal Connection
**What:** Connect GameManager signals to trigger damage/death animations
**When to use:** External state changes affecting character
**Example:**
```gdscript
func _ready() -> void:
    # Connect to GameManager signals
    GameManager.health_changed.connect(_on_health_changed)
    GameManager.player_died.connect(_on_player_died)

func _on_health_changed(new_health: int, max_health: int) -> void:
    if new_health < current_health:
        # Play hit animation
        play_animation("hit_down")
        current_health = new_health

func _on_player_died() -> void:
    # Play death animation, disable movement
    play_animation("death_down")
    set_physics_process(false)
```

### Pattern 4: Animation Finished Handling
**What:** Use animation_finished signal for one-shot animations
**When to use:** Attack, hit, and death animations that shouldn't loop
**Example:**
```gdscript
func _ready() -> void:
    animated_sprite.animation_finished.connect(_on_animation_finished)

func _on_animation_finished() -> void:
    var current_anim := animated_sprite.animation
    
    match current_anim:
        "attack_down", "attack_up", "attack_left", "attack_right":
            # Return to idle or movement
            update_animation()
        "hit_down", "hit_up", "hit_left", "hit_right":
            # Return to idle
            update_animation()
        "death_down", "death_up", "death_left", "death_right":
            # Stay dead - animation doesn't loop but stays on last frame
            pass
```

### Anti-Patterns to Avoid
- **Single animation for all directions:** Locked decision requires 4-directional
- **Using AnimationPlayer for frame animation:** AnimatedSprite2D is simpler for spritesheets
- **Not handling animation interrupts:** Hit should interrupt attack, death should interrupt everything
- **Forgetting centered=false for pixel art:** Causes deformation per Godot docs

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Direction calculation | Custom 4-way logic | Built-in Input.get_vector with angle comparisons | Already robust in player script |
| Frame timing | Custom timer-based animation | AnimatedSprite2D built-in FPS control | Optimized, handles delta automatically |
| Sprite sheet slicing | Manual region definition | Editor SpriteFrames import | Visual, less error-prone |
| Animation state transitions | Nested if/else chains | Enum-based state machine | Type-safe, readable |

---

## Common Pitfalls

### Pitfall 1: Animation State Conflicts
**What goes wrong:** Attack animation plays while moving, or hit animation doesn't play
**Why it happens:** No state hierarchy to prioritize animations
**How to avoid:** Use enum states with priority: death > hit > attack > bow_draw > (idle/walk)
**Warning signs:** Animation plays during wrong state, multiple animations overlap

### Pitfall 2: Sprite Deformation in Pixel Art
**What goes wrong:** Sprites appear stretched or blurry
**Why it happens:** AnimatedSprite2D defaults to centered=true, causing offset issues
**How to avoid:** Set `centered = false` on AnimatedSprite2D for pixel art
**Warning signs:** Subtle shape changes, especially at animation frame transitions

### Pitfall 3: Animation Not Looping/Playing Once
**What goes wrong:** Idle doesn't loop, attack plays once and stops
**Why it happens:** SpriteFrames animation_loop property not set correctly
**How to avoid:** Set `sprite_frames.set_animation_loop("idle", true)` for looping animations
**Warning signs:** Single-frame playback, animation stops unexpectedly

### Pitfall 4: Signal Connection Memory Leaks
**What goes wrong:** Multiple signal connections accumulate
**Why it happens:** Connecting signals in _ready without checking existing connections
**How to avoid:** Use CONNECT_ONE_SHOT or store connection reference
**Warning signs:** Multiple animation_finished calls per trigger

### Pitfall 5: Wrong Sprite Direction on Turn
**What goes wrong:** Sprite faces wrong direction while walking left
**Why it happens:** Not flipping sprite horizontally when direction changes
**How to avoid:** Use `animated_sprite.flip_h = direction.x < 0` or use directional sprites

---

## Code Examples

### Complete Animation State Machine
```gdscript
# Source: Godot 4.x documentation + best practices
extends CharacterBody2D
class_name PlayerAnimation

# Animation states
enum AnimState { IDLE, WALK, BOW_DRAW, ATTACK, HIT, DEATH }

# Current state
var current_state := AnimState.IDLE
var facing_direction := Vector2.DOWN

# Node references
@onready var animated_sprite: AnimatedSprite2D = $AnimatedSprite2D
@onready var body_sprite: Sprite2D = $BodySprite  # Placeholder to remove

# State priorities (higher = more urgent)
const STATE_PRIORITY := {
    AnimState.DEATH: 5,
    AnimState.HIT: 4,
    AnimState.ATTACK: 3,
    AnimState.BOW_DRAW: 2,
    AnimState.WALK: 1,
    AnimState.IDLE: 0,
}

func _ready() -> void:
    # Connect GameManager signals
    if GameManager:
        GameManager.health_changed.connect(_on_health_changed)
        GameManager.player_died.connect(_on_player_died)
    
    # Connect animation finished
    animated_sprite.animation_finished.connect(_on_animation_finished)
    
    # Hide old sprite
    body_sprite.visible = false

func _physics_process(delta: float) -> void:
    if current_state == AnimState.DEATH:
        return  # No movement when dead
    
    # Get input
    var input_dir := Input.get_vector("move_left", "move_right", "move_up", "move_down")
    
    # Update movement
    if input_dir != Vector2.ZERO:
        velocity = velocity.move_toward(input_dir * move_speed, acceleration * delta)
        facing_direction = input_dir
        _try_change_state(AnimState.WALK)
    else:
        velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
        if current_state == AnimState.WALK:
            _try_change_state(AnimState.IDLE)
    
    move_and_slide()
    _update_animation()

func _try_change_state(new_state: AnimState) -> void:
    # Only change if new state has higher priority
    if STATE_PRIORITY[new_state] >= STATE_PRIORITY[current_state]:
        _change_state(new_state)

func _change_state(new_state: AnimState) -> void:
    current_state = new_state
    _update_animation()

func _update_animation() -> void:
    var direction_suffix := _get_direction_suffix(facing_direction)
    var anim_name := ""
    
    match current_state:
        AnimState.IDLE:
            anim_name = "idle_" + direction_suffix
        AnimState.WALK:
            anim_name = "walk_" + direction_suffix
        AnimState.BOW_DRAW:
            anim_name = "bow_draw_" + direction_suffix
        AnimState.ATTACK:
            anim_name = "attack_" + direction_suffix
        AnimState.HIT:
            anim_name = "hit_" + direction_suffix
        AnimState.DEATH:
            anim_name = "death_" + direction_suffix
    
    if animated_sprite.sprite_frames and animated_sprite.sprite_frames.has_animation(anim_name):
        animated_sprite.play(anim_name)

func _get_direction_suffix(dir: Vector2) -> String:
    if abs(dir.x) > abs(dir.y):
        return "right" if dir.x > 0 else "left"
    else:
        return "down" if dir.y > 0 else "up"

# Signal handlers
func _on_health_changed(new_health: int, max_health: int) -> void:
    if new_health < current_health:
        _change_state(AnimState.HIT)
    current_health = new_health

func _on_player_died() -> void:
    _change_state(AnimState.DEATH)
    set_physics_process(false)

func _on_animation_finished() -> void:
    match current_state:
        AnimState.HIT:
            _change_state(AnimState.IDLE)
        AnimState.ATTACK:
            _change_state(AnimState.IDLE)
        AnimState.DEATH:
            animated_sprite.stop()  # Stay on last frame
```

### SpriteFrames Editor Setup (Conceptual)
```
1. Select AnimatedSprite2D in scene tree
2. In Inspector, click SpriteFrames property → New SpriteFrames
3. Click the new SpriteFrames to open bottom panel
4. For each animation:
   a. Click "+" to add new animation
   b. Rename to "idle_down", "walk_right", etc.
   c. Drag frame PNGs to the animation area
   d. Set FPS (8 for idle, 10-12 for walk)
   e. Check "Loop" for idle/walk, uncheck for attack/hit/death
5. Repeat for all 4 directions × 6 animation types = 24 animations
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sprite2D + manual frame switching | AnimatedSprite2D with SpriteFrames | Godot 2.x | Built-in animation management |
| AnimationPlayer for sprites | AnimatedSprite2D | Godot 2.x | Simpler API for frame-based |
| Hardcoded direction checks | Enum-based state machine | Modern best practice | Type-safe, maintainable |
| Connect in code only | Visual setup in editor | Godot 3.x+ | Faster iteration |

**Deprecated/outdated:**
- Sprite2D with manual timer-based frame switching: Use AnimatedSprite2D
- Nested if/else for state: Use enum-based state machine

---

## Open Questions

1. **How to handle attack input during other animations?**
   - Current approach: Attack has higher priority than movement, lower than hit/death
   - Need to verify: Should attack interrupt bow_draw?

2. **Should bow_draw animation loop or hold on last frame?**
   - Current approach: Loop during aim
   - Alternative: Hold on last frame, animate to release
   - Recommendation: Loop for continuous aiming feel

3. **Sprite art creation:**
   - Need to create actual pixel art or use placeholder sprites
   - CONTEXT says "Claude's discretion" - can use placeholder colored rectangles

---

## Sources

### Primary (HIGH confidence)
- Godot 4.5 Documentation: 2D Sprite Animation - https://docs.godotengine.org/en/4.5/tutorials/2d/2d_sprite_animation.html
- Godot 4.4 Documentation: AnimatedSprite2D class - https://docs.godotengine.org/en/4.4/classes/class_animatedsprite2d.html
- Godot 4.5 Documentation: SpriteFrames class - https://docs.godotengine.org/en/4.5/classes/class_spriteframes.html

### Secondary (MEDIUM confidence)
- KidsCanCode: AnimationTree State Machine - https://kidscancode.org/godot_recipes/4.x/animation/using_animation_sm/index.html
- I Love Sprites: Godot 2D Sprite Sheet Workflow - https://ilovesprites.com/blog/godot-2d-sprite-sheet-workflow

### Tertiary (LOW confidence)
- Project existing code analysis (GameManager.gd, player.tscn, character_body_2d.gd)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Godot 4.5 documentation is current and authoritative
- Architecture: HIGH - Patterns from Godot docs + verified project structure
- Pitfalls: MEDIUM - Based on Godot docs and general experience

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days for stable Godot 4.x API)
