# Testing Setup for Armored Archer

## Overview

The Armored Archer project has two main testing components:
1. **Backend Tests** (TypeScript/Jest) - Nakama server code
2. **Godot Client Tests** (GDScript) - Game engine code

## Backend Tests

### Running Locally

Backend tests use Jest with PostgreSQL and Nakama services.

```bash
# Start required services
make backend-start

# Run all tests
make backend-test

# Run specific test file
npm test -- src/modules/__tests__/weapon_balance.test.ts

# Run with coverage
npm run test:coverage

# Stop services
make backend-stop
```

### Services Required

- **PostgreSQL**: Database for Nakama
- **Nakama**: Game server (heroiclabs/nakama:3.21.1)

### CI/CD

Backend tests run in GitHub Actions with service containers. See `.github/workflows/ci.yml` and `.github/workflows/test.yml`.

### Coverage Thresholds

Backend tests have 80% coverage thresholds configured in `jest.config.js` for critical modules:
- `combat_system.ts`
- `rpg_system.ts`
- `matchmaker.ts`
- `gear_system.ts`
- `analytics.ts`

## Godot Client Tests

### Important: Headless Testing Limitations

**Godot headless tests in GitHub Actions (act) require special handling.**

The headless test runner (`test/run_all_tests_headless.gd`) has limitations:

1. **No async/frame-based operations**: `await process_frame` doesn't work in headless mode
2. **GUT framework tests excluded**: Many tests extend `GutTest` and cannot run with the custom headless runner
3. **Scene-based tests excluded**: Tests requiring scene files (e.g., boss tests) cannot run in headless mode

### Running Locally

For proper testing, run Godot tests locally with the full engine:

```bash
# Run all tests
godot --headless --script test/run_all_tests.gd

# Run specific test (requires Godot 4.6+)
godot --headless --script test/test_combat_manager.gd

# Use local testing script
./scripts/local-godot-tests.sh
```

### GUT Framework Integration

The project includes the GUT (Godot Unit Test) framework in `addons/gut/`. GUT is the official Godot testing framework.

**To use GUT for CI:**

1. Convert tests to extend `GutTest` instead of `Node`
2. Use GUT's headless mode: `godot -s -d res://addons/gut/gut_cli.gd`
3. Configure GUT via `.gutconfig.json`

**Current status:**
- GUT is installed in `addons/gut/`
- 63 test files already extend `GutTest`
- However, these tests are excluded from CI (`run_all_tests_headless.gd`)
- A headless-compatible subset is used in CI

**GUT Test Pattern:**

```gdscript
extends GutTest

func test_basic_assertion():
    assert_true(true, "Basic assertion should pass")

func test_string_equality():
    var expected = "hello"
    var actual = "hello"
    assert_eq(expected, actual, "Strings should be equal")
```

**GUT Assertions Available:**
- `assert_eq(a, b, msg)` - Equality
- `assert_ne(a, b, msg)` - Inequality
- `assert_true(value, msg)` - Boolean true
- `assert_false(value, msg)` - Boolean false
- `assert_null(value, msg)` - Null check
- `assert_not_null(value, msg)` - Non-null check
- `assert_between(val, low, high, msg)` - Range check
- `assert_eq typeof(val), TYPE_INT, msg)` - Type checks

**Running GUT Tests:**

```bash
# Run all GUT tests
godot -s -d res://addons/gut/gut_cli.gd

# Run specific test
godot -s -d res://addons/gut/gut_cli.gd --gut-directory test/ --gut-test=test_gut_simple

# Run with coverage (requires GUT coverage plugin)
godot -s -d res://addons/gut/gut_cli.gd --gut-coverage
```

**GUT Coverage:**

GUT includes built-in code coverage functionality:

```bash
# Run tests with coverage
godot -s -d res://addons/gut/gut_cli.gd --gut-coverage

# Export coverage as JSON
godot -s -d res://addons/gut/gut_cli.gd --gut-coverage --gut-export=coverage.json
```

**Migration Path for CI:**

To fully integrate GUT for CI:

1. **Phase 1**: Enable GUT tests in CI
   - Update `test/run_all_tests_headless.gd` to use GUT CLI
   - Run: `godot -s -d res://addons/gut/gut_cli.gd --gut-directory test/`

2. **Phase 2**: Migrate remaining tests to GUT
   - Convert `Node`-based tests to `GutTest`
   - Replace custom assertions with GUT assertions

3. **Phase 3**: Add coverage reporting
   - Enable GUT coverage collection
   - Export coverage in CI-compatible format (JSON/LCOV)

**Example CI Integration:**

```yaml
- name: Run GUT Tests
  run: |
    godot4 -s -d res://addons/gut/gut_cli.gd \
      --gut-directory test/ \
      --gut-coverage \
      --gut-export=coverage.json \
      --gut-script=.gd \
      --gut-exclude="test/integration/**,test/visual/**"

- name: Upload Coverage
  uses: actions/upload-artifact@v4
  with:
    name: gut-coverage
    path: test/coverage.json
```

**Current Limitations:**

The current headless test runner (`test/run_all_tests_headless.gd`) has these limitations:

1. **Async/frame-based operations**: Cannot use `await process_frame`
2. **GUT tests excluded**: 63 GUT tests are not run in CI
3. **Scene-based tests excluded**: Boss tests and integration tests not supported
4. **No coverage reporting**: Custom runner doesn't collect coverage

**Recommendation:**

For production CI:
- **Short term**: Skip Godot tests in act (done) and document local testing requirements
- **Medium term**: Enable GUT CLI for existing GUT tests in CI
- **Long term**: Migrate all tests to GUT framework with coverage reporting

### CI Recommendations

**For now:**
- Skip Godot tests in GitHub Actions act (local testing)
- Run Godot tests locally with full engine
- Focus CI on backend tests and code quality checks

**Future improvements:**
- Migrate all tests to GUT framework
- Use GUT CLI for headless CI testing
- Generate coverage reports with GUT

## Test File Structure

```
test/
├── run_all_tests.gd           # Full test suite (async, requires Godot engine)
├── run_all_tests_headless.gd   # Headless-compatible subset
├── test_*.gd                   # Node-based tests
└── coverage/                    # Coverage reports (if GUT used)
```

## Common Issues

### Backend Test Failures

**Issue**: Tests fail with database connection errors
**Solution**: Ensure services are running: `make backend-start`

**Issue**: weapon_balance tests failing
**Solution**: Fixed - tests now use appropriate damage values that don't exceed tier caps

### Godot Test Failures

**Issue**: Headless tests timeout or fail with frame-related errors
**Solution**: Run tests locally with full Godot engine, not in CI

**Issue**: GUT tests not found
**Solution**: Ensure tests extend `GutTest` and use GUT CLI runner

## References

- [GUT Documentation](https://github.com/bitwes/Gut)
- [Godot Headless Mode](https://docs.godotengine.org/en/stable/tutorials/command_line_tutorial.html)
- [Jest Configuration](../backend/jest.config.js)
