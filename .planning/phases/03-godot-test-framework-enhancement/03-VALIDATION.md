---
phase: 03
slug: godot-test-framework-enhancement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | GUT (Godot Unit Test) 9.5.x |
| **Config file** | `res://test/gut_config.gd` |
| **Quick run command** | `godot4 --headless --script res://test/run_all_tests.gd -gut_run_specific` |
| **Full suite command** | `godot4 --headless --script res://test/run_all_tests.gd` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `godot4 --headless --script res://test/run_all_tests.gd`
- **After every plan wave:** Run `godot4 --headless --script res://test/run_all_tests.gd`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ISO-04 | unit | `godot4 --headless -s test/run_all_tests.gd -gut_run_specific=test_autoload_isolation` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ISO-04 | unit | `godot4 --headless -s test/run_all_tests.gd -gut_run_specific=test_fresh_instances` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | MOCK-03 | unit | `godot4 --headless -s test/run_all_tests.gd -gut_run_specific=test_di_pattern` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | MOCK-03 | unit | `godot4 --headless -s test/run_all_tests.gd -gut_run_specific=test_autoload_mocking` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | ISO-04 | unit | `godot4 --headless -s test/run_all_tests.gd -gut_run_specific=test_signal_emission` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 1 | ISO-04 | unit | `godot4 --headless -s test/run_all_tests.gd -gut_run_specific=test_signal_payload` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | ISO-04 | integration | `godot4 --headless -s test/run_all_tests.gd` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 2 | MOCK-03 | integration | `godot4 --headless -s test/run_all_tests.gd` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `res://test/test_autoloader_isolation.gd` — autoload isolation test stubs for ISO-04
- [ ] `res://test/test_di_pattern.gd` — dependency injection test stubs for MOCK-03
- [ ] `res://test/test_signal_testing.gd` — signal testing test stubs for ISO-04
- [ ] `res://test/test_ci_consistency.gd` — CI consistency test stubs
- [ ] GUT 9.5.x framework installed and configured

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI consistency across platforms | ISO-04 | Requires different OS environments | Run tests on Linux, macOS, Windows and compare results |
| Visual inspection of test isolation | ISO-04 | Requires observing test execution | Run tests with verbose output and verify no cross-test pollution |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
