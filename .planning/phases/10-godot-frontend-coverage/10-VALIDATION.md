---
phase: 10
slug: godot-frontend-coverage
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GUT (Godot Unit Test) v9.6.0 |
| **Config file** | test/gut_config.gd |
| **Quick run command** | `godot4 --headless --script test/run_all_tests.gd` |
| **Full suite command** | `godot4 --headless --script test/run_all_tests.gd` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads`
- **After every plan wave:** Run full test suite and verify >95% pass rate
- **Before `/gsd:verify-work`:** Full suite must be green with >95% pass rate
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | GODOT-01 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_network_manager` | ✅ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | GODOT-01 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_network_manager` | ✅ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | GODOT-01 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_network_manager` | ✅ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | GODOT-01 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_network_manager` | ✅ W0 | ⬜ pending |
| 10-01-05 | 01 | 1 | GODOT-01 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_network_manager` | ✅ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | GODOT-02 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_combat_manager` | ✅ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | GODOT-02 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_combat_manager` | ✅ W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | GODOT-02 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_combat_manager` | ✅ W0 | ⬜ pending |
| 10-02-04 | 02 | 1 | GODOT-02 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_combat_manager` | ✅ W0 | ⬜ pending |
| 10-03-01 | 03 | 1 | GODOT-03 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_game_manager` | ✅ W0 | ⬜ pending |
| 10-03-02 | 03 | 1 | GODOT-03 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_game_manager` | ✅ W0 | ⬜ pending |
| 10-03-03 | 03 | 1 | GODOT-03 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_game_manager` | ✅ W0 | ⬜ pending |
| 10-03-04 | 03 | 1 | GODOT-03 | unit | `godot4 --headless --script test/run_all_tests.gd --select suites/autoloads --unit_test test_game_manager` | ✅ W0 | ⬜ pending |
| 10-04-01 | 04 | 2 | GODOT-04 | integration | `python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml` | ✅ W0 | ⬜ pending |
| 10-04-02 | 04 | 2 | GODOT-04 | integration | `python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml` | ✅ W0 | ⬜ pending |
| 10-04-03 | 04 | 2 | GODOT-04 | integration | `python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml` | ✅ W0 | ⬜ pending |
| 10-05-01 | 05 | 2 | GODOT-05 | integration | `python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml` | ✅ W0 | ⬜ pending |
| 10-05-02 | 05 | 2 | GODOT-05 | integration | `python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml` | ✅ W0 | ⬜ pending |
| 10-05-03 | 05 | 2 | GODOT-05 | integration | `python3 scripts/calculate_godot_coverage.py test/results/gut-results.xml` | ✅ W0 | ⬜ pending |
| 10-06-01 | 06 | 2 | GODOT-06 | manual | Review documentation | ❌ N/A | ⬜ pending |
| 10-06-02 | 06 | 2 | GODOT-06 | manual | Review documentation | ❌ N/A | ⬜ pending |
| 10-06-03 | 06 | 2 | GODOT-06 | manual | Review documentation | ❌ N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/suites/network/test_network_manager.gd` — existing tests cover GODOT-01 (to be replaced)
- [x] `test/suites/combat/test_combat_manager.gd` — existing tests cover GODOT-02 (to be replaced)
- [x] `test/suites/player/test_game_manager.gd` — existing tests cover GODOT-03 (to be replaced)
- [x] `scripts/calculate_godot_coverage.py` — existing infrastructure covers GODOT-05
- [x] GUT v9.6.0 already installed and configured in test/gut_config.gd

*Existing infrastructure covers all phase requirements. New test files will replace old-style tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Documentation review | GODOT-06 | Requires human judgment on clarity and completeness | Review created documentation file and verify ConfigFile dependency injection patterns are clearly documented with examples |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
