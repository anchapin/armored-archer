# Testing Infrastructure

This document describes the testing infrastructure for Armored Archer.

## Overview

The project uses multiple testing frameworks:
- **GUT (Godot Unit Test)** for GDScript tests
- **Jest** for TypeScript/Node.js backend tests (when applicable)

## Test Structure

```
test/
├── suites/              # Organized test suites
│   ├── autoloads/       # Tests for Godot autoloads (singletons)
│   ├── combat/          # Combat system tests
│   ├── gear/            # Gear/inventory tests
│   ├── network/        # Network/multiplayer tests
│   ├── player/          # Player-related tests
│   └── ...
├── results/             # Test output (JUnit XML)
└── addons/gut/          # GUT framework
```

## Running Tests

### Godot Tests (Local)
```bash
./scripts/local-godot-tests.sh --tests
```

### Godot Tests (Full with linting)
```bash
./scripts/local-godot-tests.sh --all
```

### Quick validation
```bash
./scripts/local-godot-tests.sh --quick
```

## Test Framework Migration

The codebase is migrating from legacy test frameworks to GUT. See `test/suites/MIGRATION_GUIDE.md` for details.

### Legacy (Deprecated)
- `test/test_framework.gd` - Old custom framework
- `test/gdscript_test_case.gd` - Base test case class

### Current (GUT)
Use GUT's `GutTest` as base class:
```gdscript
extends GutTest

func test_example():
    assert_true(true)
```

## Autoload Test Mapping

See `data/autoload-to-test-mapping.json` for the mapping of Godot autoloads to their test files.

## CI Integration

Tests run automatically on:
- Push to `main`/`develop` branches
- Pull requests to `main`/`develop`

See `.github/workflows/test.yml` for the CI configuration.

## Coverage

- Target: 80% coverage for critical systems
- Critical autoloads (NetworkManager, CombatManager, GameManager, etc.) must have tests

## Flaky Tests

Flaky tests are tracked in `data/flaky-test-quarantine.json`. If a test is consistently failing due to environmental issues rather than code bugs, add it to the quarantine to prevent CI noise.