# Milestone Proposal: v2.6.0 - Integration & Handler Coverage

**Status**: Draft
**Target Date**: 2026-03-25
**Owner**: AI Agent
**Previous Milestone**: v2.5.0 Advanced Testing Frameworks (48.7% overall coverage achieved)

---

## 🎯 Vision

The primary goal of Milestone v2.6.0 is to reach and surpass the **60.0% overall Go coverage target** (Requirement COV-01). To achieve this, we must address the two largest remaining coverage "blind spots": the **RPC Handler layer** and the **Analytics system**, both currently at 0.0% coverage.

By the end of this milestone, the project will have a fully enforced Stage 3 CI/CD gate at 60%, ensuring long-term code quality and preventing future regressions in critical handler logic.

---

## 📈 Current Coverage Gap Analysis

| Package | Code Weight | Current Coverage | Target Coverage | Impact on Overall % |
|---------|-------------|------------------|-----------------|---------------------|
| `rpc` | ~15.2% | 0.0% | 75.0% | +11.4% |
| `analytics` | ~4.1% | 0.0% | 80.0% | +3.3% |
| `session` | ~1.8% | 0.0% | 90.0% | +1.6% |
| `storage` | ~2.2% | 0.0% | 85.0% | +1.9% |
| **Total Potential** | - | - | - | **+18.2%** |

**Current Overall**: 48.7%
**Projected v2.6.0 Overall**: **66.9%** (Exceeding 60% threshold)

---

## 🚀 Proposed Phases

### Phase 18: RPC Handler Testing (Mocking Nakama Runtime)

**Goal**: Implement a robust mocking strategy for the `runtime.NakamaModule` and `runtime.Logger` to enable unit testing of RPC handlers without a full Nakama server.

- [ ] Define `MockNakamaModule` and `MockLogger` using `gomock` and `go.uber.org/mock`.
- [ ] Create test factories for RPC request contexts and session data.
- [ ] Implement coverage for all core RPC handlers (Matchmaking, Combat, Player, Store).
- [ ] Target: **75%+ coverage** for `internal/rpc` package.

### Phase 19: Analytics & Event Infrastructure Coverage

**Goal**: Increase coverage for the analytics and event tracking system, ensuring all gameplay events are correctly formatted and logged.

- [ ] Implement unit tests for `AlphaAnalyticsManager` and `AlphaEvent` structures.
- [ ] Test event sequence numbering and timestamp logic.
- [ ] Verify event-to-map and event-to-JSON serialization for all 40+ event types.
- [ ] Target: **80%+ coverage** for `internal/analytics` package.

### Phase 20: System E2E & 60% Coverage Enforcement

**Goal**: Finalize the coverage gap closure and activate the Stage 3 (60%) CI/CD enforcement gate.

- [ ] Bridge remaining gaps in `session`, `storage`, and `reports` packages.
- [ ] Implement cross-system E2E tests for "Join Queue -> Accept Match -> Complete Match" flow.
- [ ] Update `coverage_gates.sh` to enforce the 60% overall threshold.
- [ ] Finalize v2.6.0 Verification Report and Milestone Summary.

---

## ⚠️ Known Risks & Mitigation

- **Nakama Runtime Complexity**: RPC handlers rely heavily on Nakama-specific types.
  - *Mitigation*: Leverage the existing `nakama-common` interfaces and build high-fidelity mocks.
- **Database Dependency in RPCs**: Many handlers perform direct DB queries.
  - *Mitigation*: Continue using the established `testcontainers-go` database isolation for RPC integration tests.
- **Test Execution Time**: Adding 200+ more tests may slow down CI/CD.
  - *Mitigation*: Ensure tests use efficient database snapshots and parallel execution where safe.

---

## 📅 Success Criteria

1. ✅ Overall Go coverage reaches **60.0% or higher**.
2. ✅ `internal/rpc` package coverage exceeds **75.0%**.
3. ✅ `internal/analytics` package coverage exceeds **80.0%**.
4. ✅ Stage 3 CI/CD gate (60%) is **active and passing**.
5. ✅ All critical path systems (Combat, Matchmaking, RPG) maintain **90%+ coverage**.

---

*Drafted: 2026-03-22*
*By: AI Agent (following Phase 17 completion)*
