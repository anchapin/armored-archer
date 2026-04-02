# AI Assistant Hub - Local Ollama Setup

## Overview

This guide covers setting up Ollama for local AI-assisted development in Armored Archer, enabling offline code generation with your AI models.

## Prerequisites

- Godot 4.6.1+ installed
- Linux/macOS/Windows with WSL2 support
- Minimum 8GB RAM (16GB+ recommended for larger models)

## Installation

### 1. Install Ollama

**Linux/macOS:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows (WSL2):**
```powershell
# In PowerShell (Run as Administrator)
winget install ollama
```

**Verify Installation:**
```bash
ollama --version
```

### 2. Download AI Model

For code generation, recommended models:

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|
| codellama:13b | ~7.5GB | Fast | General code, quick iterations |
| deepseek-coder:6.7b | ~4GB | Very Fast | Rapid prototyping |
| mistral:7b | ~4.2GB | Fast | Balanced performance |
| llama3:8b | ~4.7GB | Fast | General purpose |

**Download Model:**
```bash
# Recommended for code generation
ollama pull codellama:13b

# Alternative for smaller memory footprint
ollama pull mistral:7b
```

### 3. Start Ollama Server

```bash
# Start server (default port: 11434)
ollama serve

# Run with GPU acceleration (if available)
CUDA_VISIBLE_DEVICES=0 ollama serve

# Run with specific model and port
OLLAMA_MODELS=codellama:13b ollama serve --port 11434
```

**Verify Server:**
```bash
curl http://localhost:11434/api/generate
```

### 4. Configure AI Assistant Hub Plugin

**In Godot Editor:**

1. Open Editor → Project → Project Settings → Plugins
2. Add "AI Assistant Hub" plugin (download from Asset Library)
3. Configure plugin settings:
   - API URL: `http://localhost:11434/api/chat`
   - Model: `codellama:13b`
   - System Prompt: See section below

## Project-Specific System Prompt

For Armored Archer development, use this system prompt in AI Assistant Hub:

```
You are a Godot 4.6 game development assistant for Armored Archer.

CORE RULES:
1. Always use Godot 4.6 syntax (NOT Godot 3)
2. Follow project conventions (see AGENTS.md):
   - Variables/functions: snake_case
   - Classes/types: PascalCase
   - Constants: UPPER_SNAKE_CASE
   - Private members: _prefix
3. Use explicit type hints for all declarations
4. Use @onready var pattern for node references
5. Use project autoloads: GameManager, CombatManager, NetworkManager, etc.
6. Use ArcherDesignTokens for all UI colors/spacing/typography

GODOT 4.6 SPECIFIC:
- Use Callable syntax: method.call_deferred(args), NOT call_deferred("method", args)
- Never manually disconnect signals in _exit_tree() (engine handles this)
- Use static typing: var name: Type = value, func name() -> Type:
- Use distance_squared_to() for performance, not distance_to()

MOBILE OPTIMIZATION:
- Avoid heavy logic in _process() loops
- Use amortized updates for expensive operations
- Use object pooling for frequently spawned objects

AUTLOADS AVAILABLE:
- GameManager: Core game state
- CombatManager: Combat calculations
- GearManager: Equipment system
- PlayerStatsManager: Player statistics
- NetworkManager: Nakama connection
- AudioManager: Sound management
- VFXManager: Visual effects
- ObjectPool: Object pooling

UI COMPONENTS:
- Use scenes/ui/components/ as reference
- Apply SafeAreaManager for mobile safe areas
- Use ArcherDesignTokens for all design constants

GENERATED CODE MUST:
- Include type hints
- Have proper error handling (push_error, push_warning)
- Not include hardcoded values (use ArcherDesignTokens)
- Not include debug print statements in production code
```

## Usage Workflow

### 1. Code Generation

In Godot script editor, select text or place cursor, then use AI Assistant Hub:

**Prompt Examples:**

```
Generate a function that:
1. Gets all enemies within radius of player position
2. Filters by alive status
3. Returns array of enemy references
Uses Godot 4.6 CharacterBody2D API and explicit type hints
```

### 2. Refactoring

Select code to refactor:

```
Refactor this code to:
1. Use Godot 4.6 Callable syntax
2. Add proper type hints
3. Use amortized updates instead of per-frame calculations
```

### 3. Debugging

```
Debug this function. It's not working correctly when:
- Player is at specific coordinates
- Multiple enemies are nearby
Suggest what might be wrong with Godot 4.6 collision detection
```

## Model-Specific Tips

### CodeLlama 13B

**Strengths:**
- Excellent at GDScript generation
- Good at following project conventions
- Fast inference time

**Use For:**
- Quick code generation
- Script refactoring
- Function implementation

**Prompt Tips:**
- Be specific about Godot 4.6 API methods
- Reference autoloads by name
- Mention mobile optimization needs

### Mistral 7B

**Strengths:**
- Very fast inference
- Good for small tasks
- Lower memory usage

**Use For:**
- Quick iterations
- Simple functions
- Pattern matching

## Troubleshooting

### Ollama Server Not Responding

```bash
# Check if server is running
curl http://localhost:11434/api/tags

# Restart server
pkill ollama
ollama serve

# Check logs
ollama logs
```

### Memory Issues

**Symptoms:** Slow responses, system freezes

**Solutions:**
1. Switch to smaller model (e.g., mistral:7b instead of codellama:13b)
2. Close other applications
3. Reduce context window in prompt

### GPU Not Being Used

```bash
# Check CUDA availability
nvidia-smi

# Force GPU usage
CUDA_VISIBLE_DEVICES=0 ollama serve

# Use GPU offloading if supported
OLLAMA_LLM_LIBRARY="/path/to/cuda" ollama serve
```

## Integration with Development Workflow

### IDE Integration

For VS Code:

```json
// settings.json
{
  "ollama.host": "localhost:11434",
  "ollama.model": "codellama:13b",
  "ollama.timeout": 30000
}
```

### Automated Scripts

Create helper scripts for common tasks:

```bash
#!/bin/bash
# scripts/ai-refactor.sh
# Usage: ./scripts/ai-refactor.sh <file_path>

PROMPT="Refactor this Godot 4.6 code:
- Apply project conventions from AGENTS.md
- Use explicit type hints
- Optimize for mobile (avoid heavy _process loops)
- Follow ArcherDesignTokens for any UI code

FILE=$(cat $1)
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"codellama:13b\",
    \"prompt\": \"$PROMPT\n\n$FILE\",
    \"stream\": false
  }"
```

## Performance Benchmarks

| Model | Response Time | Quality | Memory |
|-------|--------------|--------|--------|
| codellama:13b | ~2-3s | High | ~7.5GB |
| mistral:7b | ~0.5-1s | Medium | ~4GB |
| deepseek-coder:6.7b | ~0.5-1s | Good | ~4GB |

*Measured on Ryzen 7 5800X, 32GB RAM*

## Resources

- **Ollama Docs**: https://ollama.ai/docs
- **Model Library**: https://ollama.ai/library
- **Godot AI Plugins**: https://godotengine.org/asset-library/asset?category=tools&support=AI%20Assistant
- **Project AI Guide**: AI_INTEGRATION.md
