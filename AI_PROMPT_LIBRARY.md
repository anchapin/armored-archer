# AI Prompt Library - Armored Archer

## Quick Reference

This library contains reusable AI prompts for common Armored Archer development tasks. Use these as templates and customize as needed.

## Table of Contents

- [Godot 4.6 Code Generation](#godot-46-code-generation)
- [UI Components](#ui-components)
- [Autoload Managers](#autoload-managers)
- [Mobile Optimization](#mobile-optimization)
- [Backend RPC Handlers](#backend-rpc-handlers)
- [Combat Systems](#combat-systems)

---

## Godot 4.6 Code Generation

### Function Template

```
Generate a Godot 4.6 function with the following requirements:

Function: {function_name}({parameters}) -> {return_type}

Requirements:
- Use Godot 4.6 syntax (NOT Godot 3)
- Use explicit type hints for all parameters and return type
- Use snake_case for parameter names
- Handle null cases with is_instance_valid() checks
- Add error handling with push_error() for critical failures

{additional_requirements}

Return only the GDScript code, no explanation.
```

### Class Template

```
Generate a Godot 4.6 class with the following requirements:

Class: {ClassName} extending {BaseClass}

Requirements:
- Use Godot 4.6 syntax
- Follow project naming conventions:
  - Classes: PascalCase
  - Variables: snake_case
  - Functions: snake_case
  - Constants: UPPER_SNAKE_CASE
- Use @export for inspector-exposed variables with type hints
- Use @onready var node_path: Type = $NodePath for child references
- Define signals using past-tense verbs
- Add docstring comments for public methods

Node Structure:
- {node_hierarchy_description}

Return only the GDScript code, no explanation.
```

---

## UI Components

### Button Component

```
Generate a UI button component for Armored Archer following these patterns:

Purpose: {button_purpose}

Design Tokens:
- Use ArcherDesignTokens autoload for all colors, spacing, typography
- Use get_primary_color(state) for button states (default, hover, pressed, disabled)
- Use get_font_size() helper for text sizing

Mobile Requirements:
- Minimum touch target: 48x48 dp
- Use SafeAreaManager autoload for safe area handling
- Appropriate anchors for screen positioning

Code Structure:
- extends base_button.gd (if exists) or Control
- Connect to base signals: pressed, released, mouse_entered, mouse_exited
- Support both dark/light themes via ArcherDesignTokens helper functions

Return only the GDScript code, no explanation.
```

### Container Component

```
Generate a UI container component for Armored Archer:

Container Type: {VBoxContainer|HBoxContainer|GridContainer}

Requirements:
- Use ArcherDesignTokens for spacing (SPACING_XXS, SPACING_SM, etc.)
- Support theme switching via ThemeManager
- Handle safe area with SafeAreaManager
- Use appropriate anchors for responsive layout

Return only the GDScript code, no explanation.
```

---

## Autoload Managers

### New Autoload

```
Generate a Godot 4.6 autoload singleton:

Autoload Name: {autoload_name}
Purpose: {brief_description}

Requirements:
- Use Node as base class (or specific type if needed)
- Define constants with UPPER_SNAKE_CASE at top
- Define signals for state changes or events
- Use static functions for stateless helpers
- Use static typed properties for shared data

Pattern:
```gdscript
extends Node

signal state_changed(new_state: String)
signal resource_loaded(resource_name: String, data: Variant)

const MAX_VALUE: int = 100
const DEFAULT_TIMEOUT: float = 5.0

var _state: String = ""

static func get_state() -> String:
    return _state

static func set_state(new_state: String) -> void:
    _state = new_state
```

Node References:
- Use @onready var if accessing other autoloads
- Example: @onready var game_manager: GameManager = $"/root/GameManager"

Return only the GDScript code, no explanation.
```

---

## Mobile Optimization

### Physics Process Optimization

```
Optimize this Godot 4.6 code for mobile performance:

Requirements:
1. Amortize heavy calculations:
   - Move expensive logic out of _process() / _physics_process()
   - Use frame counting or timers for staggered updates
   - Example: Process pathfinding every 5th frame

2. Use distance_squared_to() instead of distance_to():
   - Square root operations are expensive
   - Compare squared distances instead

3. Use object pooling:
   - Pool frequently spawned objects (projectiles, effects, enemies)
   - Use ObjectPool autoload if available

4. Consider frame rate limits:
   - Non-action content can cap at 30 FPS
   - Use Engine.max_fps setting

5. Cache frequently accessed data:
   - Store node references in @onready variables
   - Avoid repeated get_node() calls

Return only the optimized GDScript code, no explanation.
```

### Shader Optimization

```
Generate an optimized 2D fragment shader for Godot 4.6:

Shader Purpose: {shader_purpose}

Mobile Optimization Requirements:
1. Simplified math: Use integer math where possible
2. Minimize branching: Avoid if/else in fragment shader
3. Reduce texture lookups: Cache sampled values
4. Use appropriate precision: mediump for most values, highp for colors
5. Avoid complex effects: Godrays, volumetrics, fractals

Godot 4.6 Shader Syntax:
- shader_type: canvas_item
- blend_mode: appropriate for effect (mix, add, sub, multiply)
- render_mode: unshaded if simple geometry

Return only the shader code, no explanation.
```

---

## Backend RPC Handlers

### RPC Handler Template

```
Generate a Nakama RPC handler for Armored Archer backend:

RPC Name: {rpc_name}
Purpose: {description}

Requirements:
1. Server-Authoritative Design:
   - Never trust client input values
   - Calculate results using stored server data
   - Validate all inputs using Zod schemas

2. TypeScript Strict Typing:
   - Use explicit interfaces for all data structures
   - Use enums for fixed value sets
   - Type all function parameters and returns

3. Error Handling:
   - Wrap operations in try-catch blocks
   - Return user-friendly error messages
   - Never expose sensitive data in errors

4. Async/Await Pattern:
   - Use async/await for all database operations
   - Use Nakama storage API for data persistence

Response Format:
```typescript
{
  success: boolean,
  data?: ResultType,
  error?: string,
  code?: number
}
```

Return only the TypeScript code, no explanation.
```

---

## Combat Systems

### Damage Calculation

```
Generate a Godot 4.6 damage calculation function for Armored Archer combat:

Function: calculate_damage({attacker_stats}, {defender_stats}, {attack_type})

Requirements:
- Use CombatManager autoload conventions
- Apply armor and damage reduction formulas
- Consider weapon type bonuses (bow, sword, magic)
- Apply critical hit chance if applicable
- Return minimum of 1 damage

Game Balance Constants (use ArcherDesignTokens or define):
- CRITICAL_HIT_CHANCE: float (0.15 default)
- ARMOR_REDUCTION_MULTIPLIER: float (0.5 default)
- BASE_DAMAGE: int based on weapon/level

Return only the GDScript code, no explanation.
```

### Projectile Spawning

```
Generate a projectile system for Armored Archer:

Projectile Type: {arrow|magic_missile|fireball}

Requirements:
1. Use ObjectPool autoload for memory efficiency
2. Set up collision detection with Area2D or collision layers
3. Auto-despawn after timeout (prevent memory leaks)
4. Use appropriate damage callback via signals
5. Follow projectile naming: {projectile_type}_{variant}

Collision Setup:
- Define collision layer for projectile
- Connect body_entered signal for hit detection
- Call CombatManager for damage calculation

Return only the GDScript code, no explanation.
```

### Enemy AI State Machine

```
Generate an enemy AI state machine for Armored Archer:

Enemy Type: {enemy_name}

States:
- IDLE: Waiting for player to enter range
- CHASE: Moving toward player
- ATTACK: Executing attack pattern
- HURT: Recovering from damage
- DEAD: Cleanup and drop loot

Requirements:
1. Use finite state machine pattern
2. State transitions based on:
   - Distance to player
   - Line of sight checks (amortized)
   - Health status
3. Use signals for state changes
4. Pool state references (don't create new instances)
5. Emit damage signal to CombatManager

Mobile Optimization:
- Amortize line-of-sight checks (every 5th frame)
- Use distance_squared_to() for range checks
- Pool frequently used state objects

Return only the GDScript code, no explanation.
```

---

## Quick Use Templates

### Common Function Patterns

**Signal Emission:**
```
Generate a Godot 4.6 function that emits a signal:

Signal: {signal_name}
Parameters: {parameter_list}

Requirements:
- Define signal at class level: signal {signal_name}({param_types})
- Emit with parameter types matching signal definition
- Use proper Godot 4.6 Callable syntax for connections

Return only the function code.
```

**Data Validation:**
```
Generate a Godot 4.6 data validation function:

Function: validate_{data_type}({data})

Requirements:
- Use is_instance_valid() for node references
- Check has_method() before calling dynamic methods
- Validate ranges: clamp values between min/max
- Return validated value or default if invalid
- Use push_warning() for validation failures

Return only the function code.
```

**Scene Transition:**
```
Generate a scene transition function for Armored Archer:

Transition Type: {fade|slide|zoom}

Requirements:
- Use AnimationPlayer for transitions
- Respect SafeAreaManager for mobile layouts
- Emit signals for transition start/complete
- Support both directions (in/out)
- Use ArcherDesignTokens for timing constants

Return only the function code.
```

## Prompt Customization Tips

### Specifying Godot 4.6 API

When requesting code that uses specific Godot methods, be explicit:

```
Use CharacterBody2D.move_and_slide() for physics movement
Use Callable.call_deferred() for delayed execution (NOT string-based)
Use Area2D.body_entered signal for collision detection
Use @onready var for node caching (NOT get_node())
```

### Defining Naming Conventions

Always include naming convention requirements in prompts:

```
Follow these naming conventions:
- Variables: snake_case (move_speed, target_angle, is_aiming)
- Functions: snake_case (calculate_damage(), handle_input(), _on_body_entered())
- Classes: PascalCase (PlayerController, EnemySpawner)
- Constants: UPPER_SNAKE_CASE (BASE_SPEED, MAX_HEALTH)
- Private members: _prefix (_current_state, _cached_value)
```

### Specifying Autoloads

Reference project autoloads explicitly:

```
Available autoloads:
- GameManager: Core game state and logic
- CombatManager: Combat calculations and effects
- NetworkManager: Nakama server connection and RPC
- GearManager: Equipment system
- PlayerStatsManager: Player statistics (level, XP, stats)
- AudioManager: Sound management
- VFXManager: Visual effects
- ObjectPool: Object pooling for performance
- ArcherDesignTokens: Design constants (colors, spacing, typography)
- ThemeManager: UI theme management
- SafeAreaManager: Mobile safe area handling
```

### Mobile-First Prompts

When code affects performance, emphasize mobile constraints:

```
Optimize for mobile constraints:
- Thermal throttling: Avoid continuous heavy calculations
- Battery life: Consider frame rate caps for non-action content
- Memory efficiency: Use object pooling and avoid leaks
- Touch targets: Ensure UI elements are at least 48x48 dp
```

## Usage Workflow

1. **Select Template**: Choose appropriate template from this library
2. **Customize**: Fill in {placeholders} with specific requirements
3. **Add Context**: Reference project autoloads, existing patterns
4. **Submit to AI**: Use with your preferred AI tool (Ollama, Claude, etc.)
5. **Review**: Apply code review checklist from AI_CODE_REVIEW.md
6. **Test**: Run relevant tests before integration
7. **Iterate**: Refine prompt if output needs adjustments

## Contributing

To add new prompt templates:

1. Identify common pattern in development
2. Create reusable template with clear placeholders
3. Add detailed requirements matching project conventions
4. Include example usage or expected output format
5. Update this file and add to table of contents

## Resources

- **AI Integration Guide**: AI_INTEGRATION.md
- **Code Review Checklist**: AI_CODE_REVIEW.md
- **Project Conventions**: AGENTS.md
- **Godot 4.6 Docs**: https://docs.godotengine.org/en/stable/
