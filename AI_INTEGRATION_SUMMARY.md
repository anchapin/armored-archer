# AI Integration Summary - Armored Archer

## Overview

This document provides a quick reference guide for AI-assisted development in Armored Archer. All AI tools and documentation have been systematically integrated.

## Quick Start

**For Code Generation:**
```bash
# Use local Ollama for code generation
./scripts/ai-refactor.sh autoloads/GameManager.gd full

# Or use Godogen for feature generation
/godogen Create a new boss enemy with shield mechanics
```

**For Audio Assets:**
```bash
# Generate Foley sounds in batch
python3 scripts/generate-foley-batch.py
# Follow prompts to select category (combat, ui, movement, etc.)
```

## Documentation Map

| Document | Purpose | Location |
|----------|---------|----------|
| **AI_INTEGRATION.md** | Main AI workflow guide | `AI_INTEGRATION.md` |
| **AI_CODE_REVIEW.md** | Code review checklist | `AI_CODE_REVIEW.md` |
| **AI_PROMPT_LIBRARY.md** | Reusable prompt templates | `AI_PROMPT_LIBRARY.md` |
| **ai-setup/README.md** | Ollama local setup | `ai-setup/README.md` |
| **FOLEY_AI_SETUP.md** | Audio generation guide | `FOLEY_AI_SETUP.md` |
| **AGENTS.md** | Updated with AI references | `AGENTS.md` |
| **GODOGEN_SETUP.md** | Godogen feature generation | `GODOGEN_SETUP.md` |

## Tools Available

### 1. Local AI (Ollama)

**Purpose:** Offline code generation and refactoring

**Setup:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull codellama:13b

# Start server
ollama serve
```

**Usage:**
- Manual: Use AI Assistant Hub plugin in Godot
- Scripted: `./scripts/ai-refactor.sh <file> [type]`

**Model Recommendations:**
- `codellama:13b` - Best for code generation (7.5GB)
- `mistral:7b` - Fast iterations, lower memory (4GB)

### 2. Godogen

**Purpose:** Complete feature and scene generation

**Usage:**
```bash
# In Claude Code
/godogen Create a new enemy type: flying gargoyle
/godogen Add a fishing mini-game with inventory system
```

**Capabilities:**
- Generates complete Godot 4 scenes and scripts
- Creates 2D/3D assets (requires API keys)
- Performs visual QA via screenshots
- Respects project autoloads and conventions

### 3. Foley AI (Audio)

**Purpose:** Generate SFX using natural language prompts

**Setup:**
1. Install Foley AI plugin from Godot Asset Library
2. Configure ElevenLabs API key
3. Use batch generation script

**Usage:**
```bash
# Interactive batch generation
python3 scripts/generate-foley-batch.py
# Follow prompts to select category
```

**Categories:**
- Combat (bows, swords, impacts)
- UI (buttons, feedback, success/error)
- Movement (footsteps, jumps)
- Ambient (environments, atmospheres)
- Magic (spells, effects)
- VFX (screen shake, transitions)

### 4. AI Assistant Hub Plugin

**Purpose:** Native Godot editor integration with AI

**Configuration:**
- API URL: `http://localhost:11434/api/chat`
- Model: `codellama:13b`
- System Prompt: See `ai-setup/README.md`

## Code Review Workflow

### Before Integrating AI Code

1. **Run Quick Checklist:**
   - [ ] Godot 4.6 syntax compliance
   - [ ] Project convention adherence
   - [ ] Mobile performance optimization
   - [ ] Type safety & error handling
   - [ ] Security & input validation
   - [ ] Test coverage included

2. **Use AI_CODE_REVIEW.md:**
   - Detailed criteria for each category
   - Common issues and solutions
   - Review workflow steps

3. **Automated Validation:**
   ```bash
   # Lint GDScript
   gdlint autoloads/ scenes/ scripts/

   # Run tests
   godot --headless --script res://test/run_all_tests.gd
   ```

### Committing AI-Generated Code

```bash
git add .
git commit -m "[AI-assisted] feat: add new enemy type

- AI Tool: Ollama/Codellama-13b
- Human Review: Tested all combat interactions, balance verified"
```

## Prompt Templates

### Quick Access

**UI Components:** See `AI_PROMPT_LIBRARY.md` → UI Components section
**Autoloads:** See `AI_PROMPT_LIBRARY.md` → Autoload Managers section
**Combat:** See `AI_PROMPT_LIBRARY.md` → Combat Systems section
**Mobile Optimization:** See `AI_PROMPT_LIBRARY.md` → Mobile Optimization section

### Custom Template

```bash
# Use AI_INTEGRATION.md templates
# Or search AI_PROMPT_LIBRARY.md for pattern

cat AI_PROMPT_LIBRARY.md | grep -A 5 "### Function Template"
```

## Performance Benchmarks

Based on Ryzen 7 5800X, 32GB RAM:

| Task | AI Tool | Time | Quality |
|------|----------|------|--------|
| Simple function | Ollama (Mistral 7B) | ~0.5s | Good |
| Complex class | Ollama (Codellama 13B) | ~2-3s | High |
| Feature generation | Godogen | ~30-60s | Production-ready |
| Audio batch (10 sounds) | Foley AI | ~15-20s | Excellent |

## Troubleshooting

### Ollama Issues

**Server not responding:**
```bash
# Check if running
curl http://localhost:11434/api/tags

# Restart
pkill ollama
ollama serve
```

**Memory issues:**
- Switch to smaller model (mistral:7b)
- Reduce prompt context
- Close other applications

### Code Generation Issues

**Wrong syntax (Godot 3):**
- Update system prompt in AI Assistant Hub
- Specify "Godot 4.6 syntax" in prompt
- See `AI_CODE_REVIEW.md` → Common Issues section

**Naming violations:**
- Reference `AI_PROMPT_LIBRARY.md` → Naming Conventions
- Use refactor script: `./scripts/ai-refactor.sh <file> naming`

### Audio Generation Issues

**API rate limits:**
- Use batch script (fewer API calls)
- Upgrade ElevenLabs tier if needed
- Cache generated sounds

**Poor quality:**
- Be more specific in prompts
- Include duration parameter
- Add descriptive keywords (metallic, organic, etc.)

## Best Practices

### Spec-Driven Development

1. **Define Requirements First:** Specify exact API methods, types, and patterns
2. **Use Project References:** Reference autoloads, design tokens by name
3. **Specify Godot 4.6:** Always mention "Godot 4.6" in prompts
4. **Mobile-First:** Emphasize performance, thermal constraints, touch targets

### Code Review

1. **Never Skip Review:** All AI code must pass review checklist
2. **Focus on Patterns:** Check for Godot 4.6 anti-patterns
3. **Verify Mobile:** Ensure no heavy loops, proper pooling
4. **Security First:** Validate inputs, no hardcoded secrets

### Asset Generation

1. **Batch Related Sounds:** Generate in groups for consistency
2. **Use Categories:** Organize by function (combat, ui, movement)
3. **Descriptive Prompts:** Include intensity, duration, material context
4. **Quality Check:** Test in context before using

## Integration with Existing Workflow

### Godot Editor

1. Open script editor
2. Use AI Assistant Hub plugin sidebar
3. Select code or place cursor
4. Enter prompt from `AI_PROMPT_LIBRARY.md`
5. Review and integrate output

### Terminal

```bash
# Refactor existing code
./scripts/ai-refactor.sh scenes/enemies/Enemy.gd mobile

# Generate audio assets
python3 scripts/generate-foley-batch.py

# Generate new feature
/godogen Create a new boss with phase mechanics
```

### Git Workflow

```bash
# Stage changes
git add autoloads/ scenes/ scripts/

# AI-assisted commit
git commit -m "[AI-assisted] feat: implement new feature

- AI Tool: Ollama/Codellama-13b
- Human Review: All tests passing, mobile performance verified
- Task: Feature implementation from AI_PROMPT_LIBRARY.md"

# Create PR
git push origin feature/new-feature
```

## Resources

### Internal Documentation
- `AI_INTEGRATION.md` - Comprehensive AI workflow guide
- `AI_CODE_REVIEW.md` - Detailed code review checklist
- `AI_PROMPT_LIBRARY.md` - Reusable prompt templates
- `ai-setup/README.md` - Local Ollama setup
- `FOLEY_AI_SETUP.md` - Audio generation guide
- `AGENTS.md` - Updated with AI references

### External Resources
- Ollama Docs: https://ollama.ai/docs
- ElevenLabs: https://elevenlabs.io/docs
- Godot AI Plugins: https://godotengine.org/asset-library/asset?category=tools&support=AI%20Assistant
- Godot 4.6 Docs: https://docs.godotengine.org/en/stable/

## Next Steps

### For New Team Members

1. Read `AI_INTEGRATION.md` for full workflow
2. Set up Ollama for local AI (see `ai-setup/README.md`)
3. Install Foley AI plugin for audio (see `FOLEY_AI_SETUP.md`)
4. Familiarize with prompt library (`AI_PROMPT_LIBRARY.md`)

### For Ongoing Development

1. Use AI refactoring script before committing
2. Apply code review checklist (`AI_CODE_REVIEW.md`) to AI-generated code
3. Generate related audio in batches for consistency
4. Document new prompt patterns in `AI_PROMPT_LIBRARY.md`

### For Feature Work

1. Use Godogen for complete feature scaffolding
2. Generate audio assets with Foley batch script
3. Use AI Assistant Hub for specific function implementation
4. Review all AI output against project conventions

---

**Last Updated:** 2026-04-02
**Version:** 1.0.0
