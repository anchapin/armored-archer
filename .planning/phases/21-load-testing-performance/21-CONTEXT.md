# Phase 21: Load Testing & Performance Benchmarking - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify and optimize system performance under realistic alpha-level load. Focus on backend scalability (1,000 CCU), database query optimization, and P99 latency targets. No user-facing feature changes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure/performance testing phase. Optimization targets, benchmarking approaches, and tool selection (k6, pprof, EXPLAIN ANALYZE) are left to technical judgment.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/tests/load/k6.conf.js` — Existing k6 configuration for load testing
- `backend/tests/load/scenarios/` — Placeholder for load test scenarios
- `backend/data/migrations/` — Migration infrastructure for database indexes
- `PERFORMANCE_REPORT.md` — Existing performance baseline documentation

### Established Patterns
- k6 for load testing with staged ramp-up configurations
- PostgreSQL migrations via SQL files applied through Docker exec
- pprof for Go CPU/memory profiling
- Docker Compose for service orchestration during testing

### Integration Points
- Backend RPC endpoints: All public-facing APIs subject to load testing
- PostgreSQL: Database performance optimization target
- Nakama runtime: Server metrics during load

</code_context>

<specifics>
## Specific Ideas

No specific requirements — performance optimization guided by profiling data and load test results.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
