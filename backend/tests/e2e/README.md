# E2E Tests

E2E tests test complete workflows from start to finish. Use real services (database, Nakama). Slow execution (>100ms per test). Use sparingly.

## Purpose

E2E tests verify that the entire system works end-to-end for critical user journeys. They should:

- Test complete workflows (e.g., player login → match → result)
- Use real services (PostgreSQL, Nakama, Redis)
- Test from client perspective (RPC calls, not internal functions)
- Run against staging/production-like environment
- Be minimal (only for critical paths)

## Examples

```go
func TestCompleteMatchFlowE2E(t *testing.T) {
    // Start real Nakama server with Docker Compose
    // Connect real Nakama client
    // Test: Login → Queue → Match → Complete → Update stats
    ctx := context.Background()

    // Connect to Nakama
    client := NewTestNakamaClient(ctx, t)
    defer client.Close()

    // Login
    session, err := client.AuthenticateDevice(ctx, "test-device-123")
    assert.NoError(t, err)

    // Join matchmaker
    match, err := client.JoinMatchmaker(ctx, session)
    assert.NoError(t, err)

    // Complete match flow...
    // Verify stats updated in database
}
```

## Guidelines

- Use real services (Docker Compose or staging environment)
- Test only critical user journeys (login, match, purchase)
- Keep test count low (10% or less of total tests)
- Tests are brittle and slow — use sparingly
- Focus on happy paths (error handling tested in integration)
- Document any environment setup requirements
- Use only for smoke testing before releases
