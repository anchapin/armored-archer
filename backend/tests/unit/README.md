# Unit Tests

Unit tests test individual functions and types in isolation. No external dependencies (database, network, file system). Fast execution (<1ms per test).

## Purpose

Unit tests verify the correctness of small, isolated pieces of code. They should:

- Test a single function or method
- Use mocks for external dependencies (database, network, file system)
- Run quickly (<1ms per test)
- Be deterministic (no random behavior)
- Test edge cases and error conditions

## Examples

```go
func TestCalculateDamage(t *testing.T) {
    // Test damage calculation logic with mocked inputs
    result := CalculateDamage(100, 0.5, 1.2)
    assert.Equal(t, 60.0, result)
}
```

## Guidelines

- No database connections
- No network calls
- No file system operations
- Use testify/mock or uber-go/mock for dependencies
- Test both success and failure paths
- Aim for >90% code coverage
