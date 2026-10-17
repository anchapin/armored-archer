# Milestone Proposal: v3.0.0 - Alpha Readiness

**Status**: Draft
**Target Date**: 2026-04-10
**Owner**: AI Agent
**Previous Milestone**: v2.6.0 Integration & Handler Coverage (73.5% overall coverage achieved)

---

## 🎯 Vision

The primary goal of Milestone v3.0.0 is to ensure the **Armored Archer** backend and client are fully prepared for a limited Alpha test. This involves transitioning from "code quality" (coverage) to "system quality" (performance, security, and stability).

By the end of this milestone, the project will have undergone rigorous load testing, a comprehensive security audit of all public-facing endpoints, and a final stability pass on the Godot-Nakama integration.

---

## 📈 Objectives & Key Results (OKRs)

### Objective 1: High Performance & Scalability
*   **KR1**: Backend handles **1,000+ concurrent players** with < 100ms P99 latency for critical RPCs.
*   **KR2**: Database connection pooling and query performance optimized for peak load.
*   **KR3**: Resource usage (CPU/RAM) remains within budget (2 vCPUs, 4GB RAM per instance).

### Objective 2: Secure & Robust API
*   **KR4**: 100% of RPC endpoints pass a security audit (input validation, rate limiting, authorization).
*   **KR5**: Anti-cheat measures (server-authoritative combat, loot generation) verified and hardened.
*   **KR6**: Zero critical or high-severity vulnerabilities in the backend codebase.

### Objective 3: Client-Server Stability
*   **KR7**: Godot client handles 100% of network edge cases (reconnects, timeouts, packet loss) gracefully.
*   **KR8**: Client-side performance (FPS) remains stable at 60 FPS on mid-range mobile devices.

---

## 🚀 Proposed Phases

### Phase 21: Load Testing & Performance Benchmarking

**Goal**: Verify and optimize the system's performance under realistic alpha-level load.

- [ ] Implement k6 load testing scripts for "Login -> Matchmake -> Combat -> Store" flows.
- [ ] Profile Go backend using `pprof` to identify CPU/memory bottlenecks.
- [ ] Optimize slow database queries and implement caching where necessary.
- [ ] Target: **1,000 CCU** with stable latencies.

### Phase 22: Security Audit & Hardening

**Goal**: Review and secure all public-facing APIs and data access patterns.

- [ ] Conduct a thorough security audit of all 40+ RPC endpoints.
- [ ] Implement robust input validation for all client-provided data.
- [ ] Add rate limiting to high-frequency or expensive RPC calls.
- [ ] Verify server-authoritative combat logic against common "client-side injection" attacks.

### Phase 23: Godot-Nakama Protocol Stability

**Goal**: Ensure the client-server integration is resilient to real-world network conditions.

- [ ] Implement comprehensive error handling and retry logic in the Godot client.
- [ ] Stress test the "Accept Match" and "Combat Results" synchronization.
- [ ] Add network simulation tests (packet loss, high latency) to the E2E suite.
- [ ] Finalize the "Reconnect" flow for interrupted matches.

### Phase 24: Alpha Infrastructure & Monitoring

**Goal**: Finalize the production-ready infrastructure and observability stack.

- [ ] Update Grafana dashboards with business-level KPIs (CCU, Match Rate, IAP Conversion).
- [ ] Configure Prometheus alerting for system health and performance regressions.
- [ ] Finalize auto-scaling rules for Nakama and PostgreSQL (if applicable).
- [ ] Document the alpha deployment and rollback procedures.

### Phase 25: Alpha Readiness Verification

**Goal**: Perform a final end-to-end verification and deploy to the Alpha environment.

- [ ] Execute a full "Smoke Test" of all MVP features.
- [ ] Verify 100% pass rate for all 300+ Go and 100+ Godot tests.
- [ ] Conduct a final "Alpha Readiness" review with all stakeholders.
- [ ] Deploy v3.0.0-alpha.1 to the production-like environment.

---

## ⚠️ Known Risks & Mitigation

- **Load Testing Bottlenecks**: Unexpected performance issues may arise at high CCU.
  - *Mitigation*: Start load testing early in Phase 21 and allocate time for iterative optimization.
- **Security Vulnerabilities**: Complex RPG logic may have hidden exploits.
  - *Mitigation*: Use automated security scanners (CodeQL) and manual peer reviews of critical paths.
- **Client Stability**: Real-world mobile networks are more unpredictable than local tests.
  - *Mitigation*: Use network link conditioners during Godot testing to simulate poor connections.

---

## 📅 Success Criteria

1. ✅ **1,000+ CCU** handled with stable performance.
2. ✅ **100% of RPCs** audited and secured.
3. ✅ **Zero critical bugs** in core gameplay loops.
4. ✅ **Full E2E automation** passes with 100% reliability.
5. ✅ **Alpha Environment** is live and monitored.

---

*Drafted: 2026-03-22*
*By: AI Agent (following v2.6.0 completion)*
