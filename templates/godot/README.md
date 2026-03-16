# GDScript Templates

This directory contains template files for GDScript development. These templates are **not** meant to be compiled or run by Godot - they serve as starting points for creating new scripts.

## Available Templates

### scene-template.gd
Template for new 2D scene scripts (extends Node2D). Includes:
- Standard exports for configuration
- State variables
- Node references with `@onready`
- Common signals
- Basic methods (activate, deactivate, take_damage, heal)

### ui-template.gd
Template for new UI component scripts (extends Control). Includes:
- UI configuration exports
- Visibility state management
- Common UI signals
- Methods for showing/hiding UI
- Value management helpers

### autoload-template.gd
Template for autoload singleton scripts (extends Node). Includes:
- Configuration exports
- State management
- Dictionary-based data storage
- Signal-based state change notifications

## Usage

1. Copy the appropriate template to your target location
2. Rename the file to match your component
3. Replace placeholder names with your actual implementation
4. Remove any methods or signals you don't need

## Example: Creating a New Enemy

```bash
# Copy template
cp templates/godot/scene-template.gd scenes/enemies/new_enemy.gd

# Edit the file:
# 1. Change class name in comments
# 2. Update exports for enemy-specific values
# 3. Implement _process_movement with enemy AI
# 4. Add enemy-specific methods
```

## Note

The `.gdignore` file in this directory tells Godot to skip these files during compilation. This prevents "invalid syntax" errors from placeholder code and keeps the project clean.
