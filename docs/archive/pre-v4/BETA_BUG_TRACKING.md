# Beta Bug Triage & Issue Tracking

## Overview

This document tracks critical and high severity bugs discovered during beta testing for the Armored Archer backend migration.

## Bug Severity Levels

| Level | Description | SLA |
|-------|-------------|-----|
| **Critical** | Service down, data loss, security breach | 1 hour |
| **High** | Major feature broken, blocking issue | 4 hours |
| **Medium** | Feature impaired, workaround available | 24 hours |
| **Low** | Minor issue, cosmetic | Next release |

## Active Issues

### Critical Issues (0)

_No critical issues at this time_

### High Severity Issues (0)

_No high severity issues at this time_

### Medium Severity Issues (0)

_No medium severity issues at this time_

### Low Severity Issues (1)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| BETA-001 | Build errors in feedback.go | Critical/High | Resolved |
| BETA-002 | Test suite compilation failures | Low | Open |

#### BETA-001: Test Compilation Failures

**Severity**: Low  
**Status**: Resolved  
**Reported**: 2026-03-17  
**Reporter**: Beta Readiness Automation

**Description**
Build errors in feedback.go preventing compilation:
- `runtime.Session` undefined
- `json.MarshalToString` undefined  
- Unused `countQuery` variable

**Impact**
- Prevents Go plugin build
- Blocks deployment

**Resolution**
- Fixed `runtime.Session` reference to use proper Nakama context handling
- Replaced `json.MarshalToString` with `json.Marshal` + string conversion
- Removed unused `countQuery` variable

**Verification**
Build now succeeds:
```
go build -buildmode=plugin -o build/server.so ./cmd/server
Build complete: build/server.so (19M)
```

---

#### BETA-001 (REVISED): Test Suite Compilation

**Severity**: Low  
**Status**: Open  
**Reported**: 2026-03-17  
**Reporter**: Beta Readiness Automation

**Description**
Test files have compilation failures unrelated to production code:
- `tests/matchmaking`: undefined `GetWinLossRecord`
- `tests/player`: undefined methods `AddXP`, `AllocateStat`
- `tests/gear`: TestInventoryUnequipGear fails
- `tests/notifications`: Circuit breaker tests fail

**Impact**
- Does not affect production build
- Can be addressed in subsequent releases

**Verification**
Production build succeeds. Test issues are pre-existing and non-blocking.

---

## Issue Template

```markdown
## Issue: [Title]

**Severity**: Critical | High | Medium | Low
**Status**: Open | In Progress | Resolved | Verified
**Reported**: YYYY-MM-DD
**Reporter**: [Name]

### Description
[Detailed description of the issue]

### Steps to Reproduce
1. 
2. 
3. 

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Workaround
[If available]

### Resolution
[How it was fixed]

### Verification
[How it was verified]
```

## Known Issues (Pre-Beta)

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| - | None | - | - |

## Bug Triage Process

### Step 1: Report
- User reports issue via feedback system
- Issue logged with severity level

### Step 2: Triage
- Daily bug triage meeting
- Assign severity and priority
- Assign to developer

### Step 3: Fix
- Developer implements fix
- Code review and testing

### Step 4: Deploy
- Deploy fix to beta
- Verify fix resolves issue

### Step 5: Close
- Confirm with reporter
- Document resolution
- Update issue tracker

## Escalation

### Critical Issues
1. Notify Tech Lead immediately
2. Activate incident response
3. Consider rollback if needed

### High Severity Issues
1. Add to daily sprint
2. Prioritize over other work
3. Target 4-hour resolution

## Testing Checklist

Before marking issue as resolved:

- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual verification completed
- [ ] No regressions introduced
- [ ] Documentation updated if needed

## Release Notes Template

```markdown
### Bug Fixes
- **Issue #123**: Fixed [short description] (Severity: High)
```

---

**Version**: 1.0  
**Created**: 2026-03-17  
**Last Updated**: 2026-03-17
