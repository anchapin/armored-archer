# Automated Godot Project Fixes

## Overview

This guide documents automated methods for resolving common Godot project issues without manual Editor intervention.

## Available Automated Tools

### 1. Python Auto-Fixer (`scripts/godot_auto_fix.py`)

A comprehensive Python script that detects and fixes multiple issue types:

```bash
# Preview what would be fixed (dry-run)
python3 scripts/godot_auto_fix.py --dry-run

# Apply fixes
python3 scripts/godot_auto_fix.py
```

**What it fixes:**
- **Invalid UID references** in scene files (e.g., `uid://game_over_scene` → actual hash UID)
- **Missing .uid files** that cause autoload warnings
- **Potential GDScript syntax errors**

### 2. Bash UID Fixer (`scripts/fix_uid_references.sh`)

Lightweight bash script focused on UID references:

```bash
# Preview changes
./scripts/fix_uid_references.sh --dry-run

# Apply changes
./scripts/fix_uid_references.sh
```

### 3. Godot MCP Tools

When Godot Editor is connected via MCP server (port 6505), I can use:

| Tool | Command Pattern | Use Case |
|------|-----------------|----------|
| `read_scene` | Parse .tscn structure | Understand scene hierarchy |
| `modify_node_property` | Update node properties | Fix positions, scales, colors |
| `edit_script` | Surgical GDScript edits | Fix function signatures |
| `validate_script` | Check syntax | Verify GDScript validity |
| `get_errors` | Fetch editor errors | Diagnose issues |
| `rescan_filesystem` | Refresh file cache | After external edits |

## Common Issues and Automated Solutions

### Issue: Invalid UID References

**Symptom:** `WARNING: ext_resource, invalid UID: uid://game_over_scene`

**Cause:** Human-readable UIDs in scene references don't match actual file UIDs.

**Automated Fix:**
```bash
python3 scripts/godot_auto_fix.py
```

### Issue: Missing .uid Files

**Symptom:** Autoload warnings about missing UIDs

**Cause:** Godot 4 generates `.tscn.uid` and `.gd.uid` files for resource tracking.

**Automated Fix:**
```bash
# Generate all missing UID files
python3 scripts/godot_auto_fix.py
```

### Issue: GDScript Syntax Errors

**Symptom:** `Parse Error: Unexpected token in class body`

**Automated Fix:**
1. Run the auto-fixer to identify issues
2. For complex fixes, I can use `mcp__godot__edit_script` to make surgical changes
3. Validate with `mcp__godot__validate_script`

## Best Practices

### Before Applying Fixes

1. **Always run in dry-run mode first:**
   ```bash
   python3 scripts/godot_auto_fix.py --dry-run
   ```

2. **Commit your work:**
   ```bash
   git add -A && git commit -m "Before auto-fix"
   ```

### After Applying Fixes

1. **Rescan Godot filesystem:**
   - In Godot Editor: `Project > Tools > Rescan Files` (Ctrl+Shift+R)
   - Or restart Godot Editor

2. **Check the Output panel** for remaining errors

3. **Run tests:**
   ```bash
   godot --headless --script res://test/run_all_tests.gd
   ```

## Current Project Status

As of 2026-04-07, the auto-fixer detected:

| Issue Type | Count |
|------------|-------|
| Invalid UID references | 12 |
| Missing .uid files | 78 |
| Potential syntax errors | 22 |

## How I Can Make Changes Programmatically

### Direct File Editing (Recommended)
- I can directly edit `.tscn`, `.gd`, and project files
- No Godot Editor required
- Changes persist immediately

### Godot MCP Tools (When Connected)
- Scene structure manipulation
- Node property updates
- Script validation
- Error fetching

### Scripts + Godot CLI
```bash
# Validate all scripts
for f in $(find . -name "*.gd"); do
  godot --headless --check-only --script "$f"
done

# Rescan from CLI
godot --headless --rescan
```

## Troubleshooting

### MCP Server Timeout

If `get_errors` or other MCP tools timeout:
1. Check Godot Editor is running with MCP server enabled
2. Restart the MCP server in Godot
3. Use direct file editing as fallback

### Fixes Not Appearing in Editor

After running auto-fix:
1. Run `Project > Tools > Rescan Files` in Godot
2. Or restart Godot Editor entirely
3. Close and reopen scenes

## Adding New Auto-Fix Rules

Edit `scripts/godot_auto_fix.py` and add a new method:

```python
def fix_new_issue_type(self) -> List[Tuple[str, str]]:
    """Detect and fix a new issue type"""
    issues = []
    # Your detection logic here
    for file_path, fix_data in issues:
        # Your fix logic here
        self.fixes_applied += 1
    return issues
```

Then call it from `self.run()`.
