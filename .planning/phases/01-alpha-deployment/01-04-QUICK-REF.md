# Phase 1.4 Quick Reference - Smoke Testing

## Quick Start

```bash
cd backend

# Run all smoke tests
npm run test:smoke

# Run quick smoke tests (skip performance)
npm run test:smoke:quick

# Run with coverage
npm run test:smoke:coverage

# Generate coverage report
npm run test:coverage:report
```

## Test Suites

| Suite | Command | Tests | Description |
|-------|---------|-------|-------------|
| Authentication | `--suite auth` | 20+ | Auth, sessions, tokens |
| Player System | `--suite player` | 18+ | XP, levels, stats |
| Combat | `--suite combat` | 15+ | Combat actions, matches |
| Gear | `--suite gear` | 31+ | Inventory, equipment |
| Matchmaking | `--suite matchmaking` | 17+ | Match creation, listing |
| Season | `--suite season` | 23+ | Leaderboards, rewards |
| Store | `--suite store` | 24+ | Currency, purchases |
| Performance | `--suite performance` | 12+ | Response times, load |
| Errors | `--suite errors` | 47+ | Validation, error handling |

## Performance Targets

| Metric | Target |
|--------|--------|
| Average Response Time | < 100ms |
| P95 Response Time | < 200ms |
| P99 Response Time | < 500ms |
| Concurrent Users (10) | < 2s total |
| Memory Growth | < 50MB |

## Files Created

- `backend/scripts/run-smoke-tests.sh` - Smoke test runner
- `backend/scripts/test-coverage-report.ts` - Coverage reporter
- `backend/tests/integration/authentication.test.ts` - Auth tests
- `backend/tests/integration/error_handling.test.ts` - Error tests
- `backend/tests/integration/performance_smoke.test.ts` - Performance tests
- `.planning/phases/01-alpha-deployment/01-04-SUMMARY.md` - Full summary

## Verification Checklist

- [ ] All 10 test suites present
- [ ] 260+ total tests
- [ ] Pass rate > 95%
- [ ] Performance metrics within targets
- [ ] No critical errors in logs
- [ ] Coverage report generated

## Next Steps

1. Run smoke tests: `npm run test:smoke`
2. Review coverage: `cat reports/test-coverage-latest.md`
3. Verify in alpha environment
4. Proceed to Phase 1.5 (Rollback Verification)
