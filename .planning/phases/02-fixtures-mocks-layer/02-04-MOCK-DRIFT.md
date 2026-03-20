# Mock Drift Detection Strategy

**Phase:** 02-fixtures-mocks-layer
**Plan:** 02-04
**Created:** 2026-03-20

## Overview

Mock drift occurs when mock implementations diverge from real implementations, leading to tests that pass with mocks but fail in production. This document provides a comprehensive strategy for detecting, preventing, and fixing mock drift.

## What is Mock Drift?

Mock drift is the gradual divergence between mock behavior and real implementation behavior. It typically occurs when:

1. Real implementation changes but mocks are not updated
2. Mocks have special cases not present in real implementation
3. Mock expectations are over-specified (too rigid)
4. Interface methods are added/removed but mocks aren't regenerated

### Warning Signs of Mock Drift

**Behavioral Indicators:**
- Unit tests with mocks consistently pass, but integration tests fail
- Tests pass in CI but fail in staging/production
- Mock logic has conditional branches not in real implementation
- Mocks return hardcoded values that don't match real behavior

**Code Smells:**
```go
// BAD: Mock has special case not in real implementation
if input == "special_case" {
    return special_value
}

// BAD: Over-specified expectation
mock.EXPECT().
    Method(gomock.Eq("exact string"), gomock.Eq(123), gomock.Any()).
    Times(1)

// BAD: Mock returns hardcoded value
return &Result{value: 42}, nil
```

## Detection Strategy

### 1. Run Validation Tests

Execute mock validation tests to compare mock vs real behavior:

```bash
# Run all mock validation tests
go test ./backend/tests/integration/... -run TestMockValidation -v

# Run database-specific validation
go test ./backend/tests/integration/... -run TestDatabaseMockValidation -v

# Run Nakama runtime validation
go test ./backend/tests/integration/... -run TestNakamaRuntimeMockValidation -v
```

**What it checks:**
- Mock methods match real interface signatures
- Error handling matches real implementation
- Return value types are compatible
- Parameter matching works correctly

### 2. Compare Behavior for Critical Operations

For each critical operation, execute on both real and mock implementations:

```go
// Test with real database
realResult, realErr := realDB.ExecContext(ctx, "SELECT 1")

// Setup mock expectation with same result
mockDB.EXPECT().
    ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
    Return(realResult, realErr)

// Test with mock database
mockResult, mockErr := mockDB.ExecContext(ctx, "SELECT 1")

// Compare error states
assert.Equal(t, realErr != nil, mockErr != nil)
```

### 3. Review Mock Expectations Periodically

**Review Checklist:**
- [ ] Are expectations too specific? (use `gomock.Any()` instead of exact values)
- [ ] Are return values realistic? (avoid hardcoded values)
- [ ] Do error cases match real implementation?
- [ ] Are all interface methods covered?
- [ ] Are expectations flexible enough for refactoring?

### 4. Use Contract Tests

Contract tests verify that fixtures work with both real and mock implementations:

```bash
# Run fixture contract tests
go test ./backend/tests/integration/... -run TestPlayerFixture -v
go test ./backend/tests/integration/... -run TestGearFixture -v
go test ./backend/tests/integration/... -run TestMatchFixture -v
```

## Prevention Strategy

### 1. Regenerate Mocks After Interface Changes

When interfaces change, regenerate mocks:

```bash
# Regenerate database mock
mockgen -source=backend/internal/database/database.go \
  -destination=backend/tests/testhelpers/mocks/database_mock.go \
  -package=mocks

# Regenerate Nakama logger mock
mockgen -source=backend/internal/runtime/nakama.go \
  -destination=backend/tests/testhelpers/mocks/logger_mock.go \
  -package=mocks
```

### 2. Update Interfaces When Implementation Changes

If real implementation adds/changes methods:

1. Update the interface
2. Regenerate mocks
3. Update tests to use new methods
4. Run validation tests

**Example:**
```go
// Before
type Database interface {
    QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
}

// After adding new method
type Database interface {
    QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
    QueryWithRetry(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) // NEW
}
```

### 3. Avoid Over-Specified Expectations

**BAD:**
```go
mock.EXPECT().
    Method("exact string", 123, "another exact").
    Return(result, nil).
    Times(1)
```

**GOOD:**
```go
mock.EXPECT().
    Method(gomock.Any(), gomock.Any(), gomock.Any()).
    Return(result, nil)
```

### 4. Use Flexible Matchers

```go
// Match any string containing "player"
mock.EXPECT().
    Method(gomock.Any(), gomock.Contains("player"), gomock.Any()).
    Return(result, nil)

// Match any integer > 0
mock.EXPECT().
    Method(gomock.Any(), gomock.GreaterThan(0), gomock.Any()).
    Return(result, nil)
```

### 5. Run Validation in CI

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run mock validation tests
  run: |
    go test ./backend/tests/integration/... -run TestMockValidation -v

- name: Check for mock drift
  run: |
    go test ./backend/tests/integration/... -run TestDatabaseMockValidation -v
    go test ./backend/tests/integration/... -run TestNakamaRuntimeMockValidation -v
```

## Fixing Mock Drift

### Step 1: Identify the Drift

Run validation tests and identify failing tests:

```bash
go test ./backend/tests/integration/... -run TestDatabaseMockValidation -v
```

**Common failures:**
- Type mismatches (mock returns wrong type)
- Missing methods (interface changed, mock not regenerated)
- Incorrect error handling (mock doesn't match real errors)

### Step 2: Determine Root Cause

**Case A: Interface Changed**
- Symptom: Mock doesn't have new method
- Fix: Regenerate mocks with `mockgen`

**Case B: Implementation Changed**
- Symptom: Mock returns different values than real implementation
- Fix: Update mock expectations to match real behavior

**Case C: Mock Too Rigid**
- Symptom: Tests fail when code is refactored
- Fix: Use `gomock.Any()` instead of exact matchers

### Step 3: Update and Verify

1. Regenerate mocks if interface changed
2. Update test expectations
3. Run validation tests
4. Run full test suite

```bash
# 1. Regenerate mocks
make generate-mocks

# 2. Run validation
go test ./backend/tests/integration/... -run TestMockValidation -v

# 3. Run full suite
go test ./backend/tests/... -v
```

## When to Run Validation

### Mandatory Validation Points

1. **After Interface Changes**
   - When adding/removing interface methods
   - When changing method signatures
   - After regenerating mocks

2. **After Implementation Changes**
   - When database query logic changes
   - When error handling changes
   - When return types change

3. **Before Releases**
   - In pre-release CI pipeline
   - During staging testing
   - Before production deployment

4. **Regular Intervals**
   - Weekly in CI (automated)
   - During code review (manual)
   - After major refactoring

### Automated Validation

Add to pre-commit hook:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run mock validation tests
go test ./backend/tests/integration/... -run TestMockValidation -v

# Check exit code
if [ $? -ne 0 ]; then
    echo "Mock validation failed. Please fix before committing."
    exit 1
fi
```

## Best Practices

### 1. Keep Mocks Simple

```go
// GOOD: Simple, flexible expectation
mock.EXPECT().
    QueryContext(gomock.Any(), gomock.Any(), gomock.Any()).
    Return(rows, nil)

// BAD: Complex, rigid expectation
mock.EXPECT().
    QueryContext(ctx, "SELECT * FROM players WHERE id = $1", playerID).
    Return(rows, nil).
    Times(1)
```

### 2. Use Realistic Return Values

```go
// GOOD: Realistic error
mock.EXPECT().
    ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
    Return(nil, sql.ErrConnDone)

// BAD: Hardcoded success
mock.EXPECT().
    ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
    Return(&Result{rowsAffected: 1}, nil)
```

### 3. Test Error Cases

```go
// Test both success and failure paths
t.Run("Success", func(t *testing.T) {
    mockDB.EXPECT().QueryContext(...).Return(rows, nil)
})

t.Run("Failure", func(t *testing.T) {
    mockDB.EXPECT().QueryContext(...).Return(nil, sql.ErrNoRows)
})
```

### 4. Document Expectations

```go
// Setup mock: simulate database connection error
mockDB.EXPECT().
    ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
    Return(nil, sql.ErrConnDone)
```

## Metrics and Monitoring

### Track Mock Health

**Key Metrics:**
- Mock validation test pass rate
- Time to detect mock drift
- Frequency of mock regeneration
- Test failure rate (unit vs integration)

**Example Dashboard:**
```
Mock Health Metrics
- Validation Tests: 98% passing
- Last Drift Detection: 2 days ago
- Mock Regeneration: Weekly
- Unit Test Pass Rate: 99%
- Integration Test Pass Rate: 97%
```

## Tools and Commands

### Mock Generation

```bash
# Generate all mocks
make generate-mocks

# Generate specific mock
mockgen -source=backend/internal/database/database.go \
  -destination=backend/tests/testhelpers/mocks/database_mock.go \
  -package=mocks
```

### Validation Commands

```bash
# Run all validation tests
go test ./backend/tests/integration/... -run TestMockValidation -v

# Run database validation
go test ./backend/tests/integration/... -run TestDatabaseMockValidation -v

# Run Nakama validation
go test ./backend/tests/integration/... -run TestNakamaRuntimeMockValidation -v

# Run fixture contract tests
go test ./backend/tests/integration/... -run "TestPlayerFixture|TestGearFixture|TestMatchFixture" -v
```

### Debugging

```bash
# Verbose mock output
go test ./backend/tests/integration/... -run TestMockValidation -v -gomock.debug

# Run specific test
go test ./backend/tests/integration/... -run TestDatabaseMockValidation/ExecContext -v
```

## Summary

Mock drift is a serious issue that can lead to false confidence in test coverage. By following this strategy:

1. **Detect** drift early with validation tests
2. **Prevent** drift with flexible expectations and regular regeneration
3. **Fix** drift quickly when identified
4. **Monitor** mock health with automated checks

**Key Takeaways:**
- Run validation tests after any interface/implementation change
- Keep mock expectations flexible with `gomock.Any()`
- Regenerate mocks when interfaces change
- Test both success and error paths
- Automate validation in CI pipeline

**Resources:**
- Mock validation tests: `backend/tests/integration/mocks_validation_test.go`
- Fixture contract tests: `backend/tests/integration/fixtures_test.go`
- Mock generation: `Makefile` target `generate-mocks`
- gomock documentation: https://github.com/golang/mock
