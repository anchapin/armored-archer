# Godogen Skills for Armored Archer

This directory contains the godogen AI game generation skills.

## Skills Overview

### godogen (Main Orchestrator)
- **Purpose**: Plan and execute complete game features from natural language
- **Usage**: `/godogen <description>`
- **Examples**:
  - "Add a goblin enemy that chases the player"
  - "Create a fishing mini-game with inventory"
  - "Generate a boss battle with phases"

### godot-task (Task Executor)
- **Purpose**: Execute individual development tasks with visual QA
- **Context**: Auto-forked for clean state
- **Usage**: Called automatically by godogen

## Skill Files

### godogen/
- `SKILL.md` - Main skill definition
- `visual-target.md` - Art direction generation
- `decomposer.md` - Task planning
- `scaffold.md` - Architecture design
- `asset-planner.md` - Asset budgeting
- `asset-gen.md` - Asset generation
- `tools/` - Helper scripts

### godot-task/
- `SKILL.md` - Task executor definition
- `gdscript.md` - GDScript reference
- `scene-generation.md` - Scene building
- `script-generation.md` - Script writing
- `capture.md` - Screenshot capture
- `visual-qa.md` - Visual verification
- `doc_api/` - Godot API reference (run `tools/ensure_doc_api.sh` to generate)
- `tools/` - Helper scripts

## Integration with Armored Archer

These skills are configured to work with your existing project:
- **Respects autoloads**: NetworkManager, GameManager, CombatManager, etc.
- **Follows conventions**: snake_case variables, PascalCase types
- **Uses design system**: DesignTokens for UI components
- **Integrates with backend**: Nakama RPCs and database schema

## Quick Test

Try this simple test:
```
/godogen Create a simple test scene with a player sprite that moves with WASD
```

This should:
1. Create PLAN.md with task breakdown
2. Generate scene structure
3. Write player controller script
4. Capture screenshots
5. Verify visually

## See Also

- `GODOGEN_SETUP.md` - Setup guide
- `CLAUDE.md` - Project documentation
