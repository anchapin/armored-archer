# Integration Tests

Integration tests test interactions between components. May use testcontainers for database, but test specific integration points. Medium execution time (<100ms per test).

## Purpose

Integration tests verify that different parts of the system work together correctly. They should:

- Test interactions between 2-3 components
- Use real database with testcontainers (not shared)
- Test specific integration points (e.g., RPC handler + database)
- Run in isolation (cleanup after each test)
- Be deterministic (seed data, no randomness)

## Examples

```go
func TestGetPlayerStatsIntegration(t *testing.T) {
    // Use testcontainers to spin up PostgreSQL
    // Test full RPC handler flow: request → database → response
    ctx := context.Background()
    suite := NewDatabaseTestSuite(t, ctx)
    defer suite.Teardown()

    // Seed test data
    playerID := suite.CreateTestPlayer()

    // Test RPC handler with real database
    stats, err := GetPlayerStats(ctx, suite.db, playerID)
    assert.NoError(t, err)
    assert.Equal(t, playerID, stats.PlayerID)
}
```

## Test Isolation

Integration tests use testcontainers for database isolation. Each test suite:
- Creates a fresh PostgreSQL container
- Restores database snapshot before each test
- Cleans up resources after tests complete

Tests are run with `-shuffle=on` flag to verify isolation. Database state is reset via snapshot/restore between tests.

### Best Practices
- Use ResetTestDB() before each test (via SetupTest)
- Don't modify shared database schema in tests
- Use transactions that roll back for test isolation

## Guidelines

- Use testcontainers-go for database isolation
- Cleanup data after each test
- Test real interactions (not mocks)
- Focus on critical paths (RPC handlers, database queries)
- Avoid testing third-party libraries (they have their own tests)
- Aim for 70-80% coverage of critical paths
