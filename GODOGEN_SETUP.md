# Godogen Setup Guide

This guide explains how to use **godogen** - an AI-powered game generation system for Godot 4 - with your Armored Archer project.

## What is Godogen?

Godogen is a Claude Code skill system that:
- Generates complete Godot 4 games from natural language descriptions
- Creates 2D/3D assets using AI (Gemini, Tripo3D)
- Writes production-ready GDScript code
- Performs visual QA by capturing and analyzing screenshots
- Iterates automatically until the game works correctly

## Prerequisites

✅ **Already Installed:**
- Godot 4.6.1 (on PATH at `/home/alex/bin/godot`)
- Claude Code with skills support
- Python 3 with pip

🔑 **API Keys Required:**

1. **Google AI Studio API Key** (Required for image generation & visual QA)
   - Go to: https://makersuite.google.com/app/apikey
   - Create an API key
   - Set as environment variable: `export GOOGLE_API_KEY="your-key-here"`

2. **Tripo3D API Key** (Only needed for 3D games)
   - Go to: https://platform.tripo3d.ai/
   - Sign up and get API key
   - Set as environment variable: `export TRIPO3D_API_KEY="your-key-here"`

## Quick Start

### 1. Set up API keys

Add these to your `~/.zshrc` or `~/.bashrc`:

```bash
# Godogen API keys
export GOOGLE_API_KEY="your-google-api-key"
export TRIPO3D_API_KEY="your-tripo3d-api-key"  # Optional, for 3D games
```

Then reload your shell:
```bash
source ~/.zshrc
```

### 2. Verify Installation

The godogen skills are now in your project at:
```
.claude/skills/godogen/     # Main orchestrator
.claude/skills/godot-task/  # Task executor
```

### 3. Using Godogen

In Claude Code, you can now use godogen to:

**Generate new game features:**
```
/godogen Add a new enemy type: a flying gargoyle that throws stones
```

**Create UI components:**
```
/godogen Create a settings menu with audio sliders and resolution options
```

**Generate complete mini-games:**
```
/godogen Create a fishing mini-game with catch mechanics and inventory
```

## How It Works

1. **Planning**: Godogen breaks your request into tasks (PLAN.md)
2. **Architecture**: Designs scene structure and creates skeleton
3. **Asset Generation**: Creates 2D/3D assets using AI
4. **Task Execution**: Writes scenes and scripts via `godot-task`
5. **Visual QA**: Captures screenshots and verifies results
6. **Iteration**: Fixes issues automatically until it works

## Files Created

When godogen runs, it creates:
- `PLAN.md` - Development plan with tasks
- `STRUCTURE.md` - Architecture documentation
- `MEMORY.md` - Learnings and workarounds
- `ASSETS.md` - Asset catalog with prompts
- `screenshots/` - Visual evidence from tests
- `visual-qa/` - Automated QA reports

## Integration with Existing Project

Godogen works alongside your existing Armored Archer code:
- Respects your autoloads and architecture
- Follows your GDScript style conventions
- Creates new scenes/scripts without breaking existing ones
- Can extend existing systems (combat, gear, UI)

## Example Workflows

### Add a New Enemy
```
/godogen Create a goblin enemy that:
- Chases the player when in range
- Attacks with a dagger swing
- Has 50 HP and drops loot on death
- Uses the existing combat system
```

### Create a UI Screen
```
/godogen Create a character stats screen showing:
- Level, XP, and ability points
- Core stats (STR, DEX, INT)
- Equipment slots with icons
- Uses the existing DesignTokens system
```

### Generate a Mini-Game
```
/godogen Create a lockpicking mini-game where:
- Player rotates tumblers to match positions
- Has 3 difficulty levels
- Awards XP on success
- Can be triggered from inventory
```

## Troubleshooting

**API key errors:**
```bash
echo $GOOGLE_API_KEY  # Should show your key
```

**Godot not found:**
```bash
which godot  # Should show /home/alex/bin/godot
```

**Skill not found:**
```bash
ls ~/.claude/skills/  # Should show godogen/ and godot-task/
```

## Cost Considerations

- **Gemini API**: ~$0.001-0.01 per image generation
- **Tripo3D**: ~$0.05-0.20 per 3D model
- **Visual QA**: ~$0.0001 per screenshot analysis
- Set a budget in your request to control costs: `within $5 budget`

## Advanced Usage

See `.claude/skills/godogen/` for detailed capability documentation:
- `visual-target.md` - Art direction generation
- `decomposer.md` - Task planning
- `scaffold.md` - Architecture design
- `asset-planner.md` - Asset budgeting
- `asset-gen.md` - Asset generation

## Support

- Godogen repo: https://github.com/htdt/godogen
- Claude Code docs: https://docs.anthropic.com/en/docs/claude-code
- Tag issues with `godogen` label
