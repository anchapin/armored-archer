# AI Integration Quick Start - Armored Archer

Get up and running with AI-assisted development in 5 minutes.

## Step 1: Choose Your AI Tool (1 min)

### Option A: Local Ollama (Recommended)
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull code model (7.5GB)
ollama pull codellama:13b

# Or smaller model (4GB)
ollama pull mistral:7b

# Start server
ollama serve

# Configure AI Assistant Hub in Godot:
# Project Settings → Plugins → AI Assistant Hub
# API URL: http://localhost:11434/api/chat
# Model: codellama:13b
```

### Option B: Cloud API (Faster)
- Use AI Assistant Hub with cloud model (Gemini, OpenAI, etc.)
- Requires API key from provider

### Option C: Godogen (Features)
- Uses built-in godogen system
- See `GODOGEN_SETUP.md` for details

## Step 2: Test AI Setup (2 min)

### Test Code Generation

In Godot Editor:
1. Open any script file
2. Use AI Assistant Hub sidebar
3. Select this function or place cursor
4. Enter prompt: "Generate a function that returns random int between min and max"
5. Review output for Godot 4.6 syntax

### Test Refactoring

In terminal:
```bash
# Test refactor script on existing file
./scripts/ai-refactor.sh autoloads/GameManager.gd naming
```

## Step 3: Generate Audio Assets (5 min)

```bash
# Run Foley batch generation
python3 scripts/generate-foley-batch.py

# Select category when prompted
# Recommended: start with "ui" for quick testing
```

After generation, import sounds in Godot:
1. Open FileSystem dock (bottom left)
2. Navigate to `res://audio/foley_ai/`
3. Right-click folder → Reimport
4. Test sounds in AudioManager

## Step 4: Review Your First AI Code (2 min)

Use the quick checklist from `AI_CODE_REVIEW.md`:

```
Quick Review:
□ Godot 4.6 syntax (Callable, not string calls)
□ Naming conventions (snake_case vars, PascalCase classes)
□ Type hints on all declarations
□ No heavy logic in _process() loops
□ Proper error handling (push_error, push_warning)
```

## Step 5: Commit with AI Attribution (1 min)

```bash
# Stage your changes
git add .

# Commit with AI attribution
git commit -m "[AI-assisted] feat: initial AI integration setup

- AI Tool: Ollama/Codellama-13b
- Human Review: Quick review performed, all checks passed"
```

## Common First Tasks

### Create a New UI Component

1. Open `AI_PROMPT_LIBRARY.md` → UI Components section
2. Copy "Button Component" template
3. Fill in your requirements (purpose, style, etc.)
4. Submit to AI Assistant Hub
5. Review using `AI_CODE_REVIEW.md` checklist
6. Test in editor
7. Commit with `[AI-assisted]` prefix

### Refactor Existing Code

```bash
# Mobile optimization
./scripts/ai-refactor.sh scenes/player/Player.gd mobile

# Type safety
./scripts/ai-refactor.sh autoloads/CombatManager.gd types

# Naming conventions
./scripts/ai-refactor.sh scenes/enemies/Enemy.gd naming
```

### Generate Combat Sounds

```bash
python3 scripts/generate-foley-batch.py
# Select "combat" category
# All 11 combat sounds generated automatically
```

### Add a New Enemy

```bash
/godogen Create a goblin enemy that:
- Chases player when in range
- Attacks with dagger swing
- Has 50 HP and drops loot on death
- Uses existing combat system
```

## Troubleshooting

### Ollama Not Connecting

```bash
# Check if running
curl http://localhost:11434/api/tags

# If error, start server:
ollama serve
```

### AI Output Has Godot 3 Syntax

**Problem:** AI generates `call_deferred("method", args)` instead of `method.call_deferred(args)`

**Fix:**
1. Update system prompt in AI Assistant Hub
2. Include in prompt: "Use Godot 4.6 syntax (NOT Godot 3)"
3. See `AI_CODE_REVIEW.md` → Common Issues section

### Audio Not Appearing

**Problem:** Generated sounds not in Godot

**Fix:**
1. Check `res://audio/foley_ai/` folder exists
2. Right-click folder → Reimport
3. Check file path in AudioManager.gd

## Next Steps

### Complete Setup (Today)
- [ ] Install Ollama or configure cloud API
- [ ] Test AI Assistant Hub in Godot
- [ ] Generate first set of audio assets
- [ ] Review and commit first AI-generated code

### Learn the System (This Week)
- [ ] Read `AI_INTEGRATION.md` for full workflow
- [ ] Review `AI_PROMPT_LIBRARY.md` for patterns
- [ ] Study `AI_CODE_REVIEW.md` for review criteria
- [ ] Practice with refactoring script on existing code

### Integrate into Workflow (Ongoing)
- [ ] Use AI for all new features
- [ ] Apply code review to all AI-generated changes
- [ ] Generate audio assets for new content
- [ ] Update prompt library with new patterns

## Resources

**For Immediate Help:**
- `AI_INTEGRATION_SUMMARY.md` - Overview and quick reference
- `AI_QUICKSTART.md` - This file
- `scripts/ai-refactor.sh --help` - Refactoring assistance

**For Deep Learning:**
- `AI_INTEGRATION.md` - Comprehensive guide
- `AI_CODE_REVIEW.md` - Detailed review checklist
- `AI_PROMPT_LIBRARY.md` - Prompt templates
- `ai-setup/README.md` - Local AI setup
- `FOLEY_AI_SETUP.md` - Audio generation

**Project References:**
- `AGENTS.md` - Full project conventions
- `GODOGEN_SETUP.md` - Godogen feature generation
- `CLAUDE.md` - Global Claude settings

---

**Estimated Setup Time:** 5-10 minutes
**Estimated First AI Task:** 10-15 minutes (including review)
