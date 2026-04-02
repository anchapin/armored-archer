#!/bin/bash
# AI-Assisted Refactoring Tool for Armored Archer
# Uses local Ollama instance for code refactoring

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
OLLAMA_HOST="${OLLAMA_HOST:-localhost:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-codellama:13b}"
TIMEOUT=30

# Usage function
usage() {
    echo "Usage: $0 <file_path> [refactor_type]"
    echo ""
    echo "Refactor types:"
    echo "  mobile   - Optimize for mobile performance"
    echo "  types    - Add explicit type hints"
    echo "  naming   - Fix naming conventions"
    echo "  full     - All of the above"
    echo ""
    echo "Examples:"
    echo "  $0 autoloads/GameManager.gd mobile"
    echo "  $0 scenes/enemies/Enemy.gd full"
    exit 1
}

# Check arguments
if [ $# -lt 1 ]; then
    usage
fi

FILE_PATH=$1
REFACTOR_TYPE="${2:-full}"

# Validate file exists
if [ ! -f "$FILE_PATH" ]; then
    echo -e "${RED}Error: File not found: $FILE_PATH${NC}"
    exit 1
fi

# Read file content
FILE_CONTENT=$(cat "$FILE_PATH")

# Build prompt based on refactor type
case "$REFACTOR_TYPE" in
    mobile)
        PROMPT="Refactor this Godot 4.6 code for mobile optimization:
1. Remove or amortize heavy logic in _process() or _physics_process() loops
2. Use distance_squared_to() instead of distance_to() for performance
3. Implement object pooling for frequently spawned objects
4. Consider frame rate caps for non-action content
5. Use @onready var pattern instead of runtime get_node() calls

Project conventions:
- Variables/functions: snake_case
- Classes/types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Private members: _prefix

Return only the refactored code, no explanation."
        ;;
    types)
        PROMPT="Refactor this Godot 4.6 code to add explicit type hints:
1. Add type annotations to all variable declarations (var name: Type = value)
2. Add return types to all functions (func name() -> ReturnType:)
3. Add parameter types (func name(param: Type) -> void:)
4. Use proper Godot types (Vector2, float, int, bool, String, etc.)

Project conventions from AGENTS.md:
- Already follows snake_case for variables/functions
- Use static typing throughout

Return only the refactored code, no explanation."
        ;;
    naming)
        PROMPT="Refactor this Godot 4.6 code to fix naming conventions:
1. Variables and functions must be snake_case (e.g., move_speed, handle_damage())
2. Classes and types must be PascalCase (e.g., CharacterBody2D, DamagePopup)
3. Constants must be UPPER_SNAKE_CASE (e.g., BASE_SPEED, MAX_HEALTH)
4. Private members must have _ prefix (e.g., _current_state, _cached_value)

Do not change variable names that would break external references.
Return only the refactored code, no explanation."
        ;;
    full)
        PROMPT="Refactor this Godot 4.6 code comprehensively:
1. Mobile Optimization:
   - Amortize heavy logic in _process() loops
   - Use distance_squared_to() instead of distance_to()
   - Implement object pooling where appropriate
   - Consider frame rate limits

2. Type Safety:
   - Add explicit type hints to all declarations
   - Add return types to functions
   - Add parameter types

3. Naming Conventions:
   - Variables/functions: snake_case
   - Classes/types: PascalCase
   - Constants: UPPER_SNAKE_CASE
   - Private members: _prefix

4. Godot 4.6 Syntax:
   - Use Callable syntax: method.call_deferred(args)
   - NOT call_deferred('method', args)
   - No manual signal disconnection in _exit_tree()

5. Project Integration:
   - Use @onready var for node references
   - Use project autoloads (GameManager, CombatManager, etc.)
   - Use ArcherDesignTokens for UI constants

Return only the refactored code, no explanation."
        ;;
    *)
        echo -e "${RED}Error: Unknown refactor type '$REFACTOR_TYPE'${NC}"
        usage
        exit 1
        ;;
esac

# Append file content to prompt
FULL_PROMPT="$PROMPT

---
Original code from: $FILE_PATH

$FILE_CONTENT"

echo -e "${GREEN}Sending refactor request to Ollama...${NC}"

# Make API request
RESPONSE=$(curl -s --max-time $TIMEOUT \
    -X POST "http://$OLLAMA_HOST/api/generate" \
    -H "Content-Type: application/json" \
    -d "{
        \"model\": \"$OLLAMA_MODEL\",
        \"prompt\": $(echo "$FULL_PROMPT" | jq -Rs .),
        \"stream\": false,
        \"options\": {
            \"temperature\": 0.3,
            \"top_p\": 0.9,
            \"num_predict\": 2048
        }
    }" 2>/dev/null)

# Check for errors
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to connect to Ollama${NC}"
    echo "Make sure Ollama is running: ollama serve"
    exit 1
fi

# Extract response
REFACTORED_CODE=$(echo "$RESPONSE" | jq -r '.response')

# Create backup
BACKUP_PATH="${FILE_PATH}.backup.$(date +%s)"
cp "$FILE_PATH" "$BACKUP_PATH"
echo -e "${GREEN}Backup created: $BACKUP_PATH${NC}"

# Write refactored code to file
echo "$REFACTORED_CODE" > "$FILE_PATH"

echo -e "${GREEN}Refactoring complete!${NC}"
echo -e "${YELLOW}Review the changes before committing:${NC}"
echo "  git diff $FILE_PATH"
echo ""
echo "To restore backup:"
echo "  mv $BACKUP_PATH $FILE_PATH"
