# Dead Code Detection

This document describes how dead code detection is implemented in the Armored Archer project.

## Overview

Dead code detection helps identify unused variables, functions, and arguments that accumulate over time, increasing maintenance costs and reducing code quality.

## Supported Languages

The project implements dead code detection for:

1. **GDScript** - Using [gdlint](https://github.com/plusne/gdlint) with the `unused-argument` rule
2. **Python** - Using [ruff](https://docs.astral.sh/ruff/) with rules F401 (unused imports) and F841 (unused variables)
3. **TypeScript** - Using ESLint with `@typescript-eslint/no-unused-vars` rule (in backend)

## Running Dead Code Detection Locally

### Quick Check (All Languages)

```bash
make dead-code-check
```

This will run dead code detection for all languages and display any findings.

### CI Mode (Strict)

```bash
make dead-code-check-ci
```

This mode will fail the build if any dead code is detected. Use this before committing.

### Individual Language Checks

#### GDScript (Godot Scripts)

```bash
# Install gdlint first
pip install gdtoolkit

# Run dead code detection
gdlint autoloads/ scripts/ scenes/
```

The gdlint configuration is in `gdlintrc`. Dead code detection uses the `unused-argument` rule.

#### Python (Scripts)

```bash
# Install ruff first
pip install ruff

# Check for unused imports and variables
ruff check scripts/ --select=F401,F841
```

#### TypeScript (Backend)

```bash
cd backend
npm run lint
```

The backend ESLint configuration already includes `@typescript-eslint/no-unused-vars` for detecting unused variables.

## CI Integration

Dead code detection is automatically run in the CI pipeline:

- **Job**: `dead-code-detection`
- **Trigger**: On every pull request and push to main/develop
- **Mode**: Strict (fails on findings)

See `.github/workflows/ci.yml` for the full configuration.

## Configuration Files

- `gdlintrc` - GDLint configuration for GDScript dead code detection
- `backend/.eslintrc.js` - ESLint configuration for TypeScript (includes no-unused-vars)
- `pyproject.toml` - Ruff configuration for Python linting

## Ignoring Dead Code

In rare cases, you may need to ignore dead code warnings:

### GDScript

Use an underscore prefix for intentionally unused arguments:

```gdscript
func on_signal(param_with_underscore: int) -> void:
    # The underscore prefix indicates the argument is intentionally unused
    pass
```

### Python

Use `# noqa: F401` or `# noqa: F841` to ignore specific warnings:

```python
import module  # noqa: F401
unused_var = 42  # noqa: F841
```

### TypeScript

Use `// eslint-disable-next-line @typescript-eslint/no-unused-vars` to disable warnings for specific lines.

## Best Practices

1. **Run before commits**: Always run `make dead-code-check-ci` before committing
2. **Fix promptly**: Address dead code findings promptly to prevent accumulation
3. **Use underscore prefix**: For callback arguments that are intentionally unused, prefix with underscore
4. **Review regularly**: Include dead code review in code review process
