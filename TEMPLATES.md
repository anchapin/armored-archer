# Code Snippets and Templates Guide

This guide explains how to use the VSCode snippets and templates for the Armored Archer project.

## VSCode Snippets

VSCode snippets are shortcuts that expand into code patterns. Type the prefix and press `Tab` to expand.

### TypeScript Snippets

Location: `.vscode/snippets/`

#### RPC Handler (`rpc`)
Expands into a complete RPC handler with registration function and implementation.

```
Prefix: rpc
```

#### TypeScript Interfaces

- `interface` - Basic TypeScript interface
- `gear-interface` - Gear item interface template
- `req-interface` - Request interface template
- `res-interface` - Response interface template

### GDScript Snippets

Location: `.vscode/snippets/`

#### GDScript Classes

- `class` - Generic GDScript class template
- `character` - CharacterBody2D class template with movement
- `area2d` - Area2D class template with collision detection

#### GDScript Signals

- `signal` - Basic signal declaration
- `signal-connect` - Signal with connection in _ready
- `on-signal` - Signal handler method
- `signal-dict` - Signal that passes a dictionary

## Templates

Templates are complete file skeletons that can be copied and modified for new features.

### Backend Templates

Location: `templates/backend/`

#### new-rpc-handler.ts

Complete RPC handler template with:
- Request/Response interfaces
- Registration function
- Error handling
- Logging

Usage:
1. Copy `templates/backend/new-rpc-handler.ts`
2. Rename and place in `backend/src/modules/`
3. Replace placeholders:
   - `${RequestName}` - Name of your RPC (e.g., `GetPlayerStats`)
   - `${rpc_name}` - RPC endpoint name (e.g., `get_player_stats`)

#### new-module.ts

Backend module template with:
- Data interfaces
- Configuration options
- CRUD operations
- Storage integration

Usage:
1. Copy `templates/backend/new-module.ts`
2. Rename and place in `backend/src/modules/`
3. Replace `${ModuleName}` with your module name
4. Implement business logic in the provided functions

#### new-type.ts

TypeScript type definition template with:
- Main type interface
- Request/Response interfaces

Usage:
1. Copy `templates/backend/new-type.ts`
2. Rename and place in `backend/src/types/` or `backend/src/modules/`
3. Replace `${TypeName}` with your type name

### Godot Templates

Location: `templates/godot/`

#### autoload-template.gd

Singleton/autoload manager template with:
- Configuration variables
- State management
- Signals for state changes
- Public API methods

Usage:
1. Copy `templates/godot/autoload-template.gd`
2. Rename and place in `autoloads/`
3. Register in Project Settings → AutoLoad
4. Replace placeholder names and implement functionality

#### scene-template.gd

Generic scene node template with:
- Configuration exports
- State management
- Health system
- Signals for lifecycle events
- Collision detection

Usage:
1. Copy `templates/godot/scene-template.gd`
2. Rename and attach to your scene root node
3. Set the base type (Node2D, CharacterBody2D, etc.)
4. Customize references and implement gameplay logic

#### ui-template.gd

UI control template with:
- Button and label references
- Visibility management
- Value handling
- Signals for UI events
- Animation hooks

Usage:
1. Copy `templates/godot/ui-template.gd`
2. Rename and attach to your UI scene root node
3. Update node references to match your scene structure
4. Implement UI-specific logic

## Quick Reference

### Creating a New RPC

1. Use snippet: Type `rpc` + Tab
2. Or copy template: `templates/backend/new-rpc-handler.ts`
3. Register in `backend/src/index.ts`:
   ```typescript
   import { registerRpcYourRpc } from "./modules/your_rpc";
   registerRpcYourRpc(initializer);
   ```

### Creating a New GDScript Class

1. Use snippet: Type `class` + Tab (or `character`, `area2d`)
2. Or copy template: `templates/godot/scene-template.gd`
3. Attach to scene in Godot Editor
4. Update node references in script

### Creating a New Signal

1. Use snippet: Type `signal` + Tab
2. Or type `signal-connect` + Tab for signal with handler
3. Connect in `_ready()`:
   ```gdscript
   signal_name.connect(_on_signal_name)
   ```

## Best Practices

### TypeScript
- Always use interfaces for request/response data
- Add error handling in all RPC handlers
- Use `logger.info/error` for debugging
- Validate input before processing

### GDScript
- Use `@export` for inspector-visible variables
- Use `@onready` for child node references
- Add type hints to all variables and functions
- Connect signals in `_ready()`
- Use sections with `# --- Section Name ---` comments

### File Organization
- Backend modules: `backend/src/modules/`
- Backend types: `backend/src/types/`
- Godot autoloads: `autoloads/`
- Godot scenes: `scenes/`
- UI scripts: `scenes/ui/`
