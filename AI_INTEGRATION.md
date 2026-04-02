# AI Integration Guide - Armored Archer

## Overview

This guide outlines AI-assisted development practices for Armored Archer, ensuring high-quality code generation and efficient workflows using Godot 4.6.

## Spec-Driven Development Workflow

AI should be used as a **Technical Director** tool, not a "vibe coding" solution. All AI-generated code must follow project conventions and be reviewed before integration.

### AI Prompt Templates

These templates ensure AI generates Godot 4.6-compliant code that matches project architecture.

#### Template 1: Autoload Creation
```
Create a Godot 4.6 autoload singleton with the following requirements:

Name: {autoload_name}
Purpose: {brief description}

Requirements:
- Use Godot 4.6 syntax (no Godot 3 compatibility)
- Follow project GDScript conventions: snake_case for variables/functions, PascalCase for classes
- Use static type hints for all variables and function parameters
- Use @onready for node references, not get_node() calls
- Define signals using past-tense verbs (e.g., "state_changed", "resource_loaded")
- Use const with UPPER_SNAKE_CASE for constants

Node structure:
```

#### Template 2: UI Component Creation
```
Create a UI component following Armored Archer design system:

Component Type: {button|label|panel|container|icon|progress_bar}

Design Token Integration:
- Use ArcherDesignTokens autoload for all colors, spacing, typography
- Reference existing components in scenes/ui/components/ for patterns
- Support both dark/light themes using ArcherDesignTokens helper functions

Mobile Considerations:
- Use appropriate anchors (top_left, bottom_right, center, etc.)
- Ensure touch targets are minimum 48x48 dp
- Apply SafeAreaManager for safe area handling
- Use containers (VBoxContainer, HBoxContainer) for layout

Code Style:
- snake_case for variables/functions
- Type hints on all declarations
- Connect signals in _ready()
- Use @onready var node_path: Type = $NodePath pattern
```

#### Template 3: Scene-Based Enemy/Character
```
Create a new character/enemy scene for Armored Archer:

Character Type: {enemy_type}
Core Mechanic: {brief description (e.g., "chases player when in range")}

Requirements:
- Godot 4.6 CharacterBody2D or appropriate base class
- Physics-based movement using move_and_slide()
- Signal-based health system (emit "health_depleted" signal)
- Use CombatManager autoload for damage calculations
- Use ObjectPool autoload for pooled projectiles/effects
- Type hints on all properties (var health: int = 100)

Scene Structure:
```

#### Template 4: Backend RPC Integration
```
Create a Nakama RPC handler for Armored Archer backend:

RPC Name: {rpc_name}
Purpose: {description}

Requirements:
- Server-authoritative validation (never trust client input)
- Use TypeScript strict typing
- Zod schema validation for all inputs
- Async/await for database operations
- Proper error handling with user-friendly messages
- Database operations use nakama storage API

Response Format:
- Success: { success: true, data: object }
- Error: { success: false, error: string, code: number }

Type Safety:
- Define interfaces for all data structures
- Use enums for fixed values (gear_type, rarity, etc.)
```

## AI Code Quality Guardrails

### Mandatory Review Checklist

Before integrating AI-generated code, verify:

**Godot 4.6 Syntax:**
- [ ] Uses Callable syntax (not call_deferred with strings)
- [ ] No deprecated string-based deferred calls
- [ ] No manual signal disconnection in _exit_tree() (Godot 4 handles automatically)
- [ ] Proper @onready usage (not get_node() in _process)

**Project Conventions:**
- [ ] snake_case for variables/functions
- [ ] PascalCase for classes/types
- [ ] UPPER_SNAKE_CASE for constants
- [ ] Private members prefixed with _
- [ ] Explicit type hints on all declarations
- [ ] Uses project autoloads (NetworkManager, GameManager, etc.)

**Mobile Optimization:**
- [ ] No heavy logic in _process() or _physics_process() loops
- [ ] Uses distance_squared_to() instead of distance_to()
- [ ] Considers thermal throttling (amortized loads)
- [ ] Appropriate frame rate limits for non-action content

**Code Safety:**
- [ ] No exposed API keys or secrets
- [ ] Input validation on all user-facing code
- [ ] Proper error handling with push_error/push_warning
- [ ] Has method() checks before calling on dynamic nodes

## AI Tool Integration

### Recommended Tools

| Tool | Purpose | Integration Status |
|------|---------|------------------|
| **Ziva AI** | Native GD extension for code generation | ✗ Not configured |
| **AI Assistant Hub** | Open-source, local/cloud models | ✗ Not configured |
| **Foley AI** | Audio asset generation | ✗ Not configured |

### Godogen Integration

The project has `godogen` system documented in `GODOGEN_SETUP.md`. Use `/godogen` commands for:
- New feature generation
- UI component creation
- Mini-game development

### Local AI Development (Ollama)

For offline, private development:

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (e.g., CodeLlama 13B)
ollama pull codellama:13b

# Run Ollama server
ollama serve

# Configure AI Assistant Hub plugin in Godot to connect to:
# http://localhost:11434
```

### Audio Asset Generation (Foley AI)

Setup steps:
1. Install Foley AI plugin from Godot Asset Library
2. Configure ElevenLabs API key
3. Generate SFX using natural language prompts
4. Assets auto-organized to `res://audio/foley_ai/` with metadata

Example prompts:
- "heavy metallic footstep on wet concrete"
- "bow string release with echo in dungeon"
- "sword impact with metal clang, medium intensity"

## Commit Attribution

All AI-assisted changes must be marked:

```
[AI-assisted] <type>: <description>

- AI Tool: Ziva/Godogen/AI Assistant Hub/Manual
- Model: <model name if applicable>
- Human Review: Required for {balance/security/quality}
```

## Common AI Pitfalls

### Godot 3 vs 4.6 Syntax

AI models trained on older data may suggest:

**AVOID:**
```gdscript
# Godot 3 - outdated
node.call_deferred("method_name", args)
```

**USE:**
```gdscript
# Godot 4.6 - correct
node.method_name.call_deferred(args)
```

### Over-Engineering

AI may generate verbose code. Simplify:
- Remove redundant null checks on @onready nodes
- Delete unnecessary intermediate variables
- Collapse simple helper functions
- Remove excessive comments on obvious code

### Signal Anti-Patterns

**AVOID:**
```gdscript
func _exit_tree():
    disconnect("signal", handler)  # Godot 4.6 handles this automatically
```

**USE:**
```gdscript
# No manual disconnection needed in _exit_tree()
# Just connect in _ready() and let engine cleanup
```

## Performance Optimization Prompts

When requesting AI-generated code for performance:

```
Generate {feature} with mobile optimization requirements:

- Avoid logic in _process() loops
- Use amortized updates for calculations
- Prefer distance_squared_to() over distance_to()
- Use object pooling for frequently spawned objects
- Consider thermal throttling: cap frame rates for non-action content
- Batch operations where possible
```

## Resources

- **Godogen Setup**: `GODOGEN_SETUP.md`
- **Agent Guidelines**: `AGENTS.md`
- **Godot 4.6 Docs**: https://docs.godotengine.org/en/stable/
- **Godot AI Plugins**: https://godotengine.org/asset-library/asset?category=tools&support=AI%20Assistant
