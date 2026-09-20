# Technical Debt Tracking

This document tracks technical debt items in the Armored Archer project. It serves as a central registry for identifying, documenting, and managing technical debt.

## Overview

Technical debt refers to the implied cost of additional rework caused by choosing an easy (limited) solution now instead of using a better approach that would take longer. This document helps track and manage technical debt to maintain code quality and system maintainability.

## Tracking Categories

Technical debt is categorized into:

- **Code Quality**: Issues affecting code maintainability, readability, or structure
- **Deprecated APIs**: Usage of deprecated functions or libraries that need updating
- **Performance**: Inefficient code patterns that may impact performance
- **Security**: Security concerns or improvements needed
- **Testing**: Missing tests or test coverage gaps
- **Documentation**: Missing or outdated documentation
- **Architecture**: Design decisions that may need refactoring

## Tech Debt Items

### Active Debt

| ID | Category | Title | Description | Severity | Status | Date Identified | Estimated Effort |
|----|----------|-------|-------------|----------|--------|-----------------|-----------------|
| TD-003 | Testing | Backend test coverage gaps | Some modules lack comprehensive unit tests | Medium | Resolved | 2024-03-09 | 8 hours |
| TD-004 | Architecture | Error Insight Pipeline optimization | The error_insight_pipeline module needs performance review | Low | Open | 2024-03-09 | 4 hours |
| TD-005 | Code Quality | Console logging usage | Multiple files use console.log/warn/error instead of proper logger | Low | Resolved | 2024-03-09 | 1 hour | Verified 2026-04-01: production code uses proper logger; console usage only in test files and docstring comments |
| TD-006 | Type Safety | Using `any` type | Multiple files use `any` type reducing type safety | Low | Resolved | 2024-03-09 | 4 hours | Verified 2026-04-01: zero `any` in production code; 94 occurrences only in `__tests__/` files (standard mock practice) |
| TD-007 | Architecture | Autoload sprawl — 56 singletons | Project.godot registers 56 autoloads including GUT-only tooling (GutCoverageTracker, UIAutomation) and combat spread across ~12 singletons. Target: <40 autoloads via consolidation. See issue #1088. | High | In Progress | 2026-09-20 | 16 hours |

### Resolved / No Longer Applicable

| ID | Category | Title | Resolution Date | Notes |
|----|----------|-------|-----------------|-------|
| TD-001 | Deprecated APIs | Deprecated error tracking functions | 2026-03-31 | No longer applicable - functions don't exist |
| TD-002 | Deprecated APIs | Deprecated logger function | 2026-03-31 | No longer applicable - logRpcError is current implementation |
| TD-003 | Testing | Backend test coverage gaps | 2026-04-01 | Coverage verified at 94.55% lines — well above 60% target |
| TD-005 | Code Quality | Console logging usage | 2026-04-01 | Production code uses proper logger; console only in test files |
| TD-006 | Type Safety | Using `any` type | 2026-04-01 | Zero `any` in production code; test files use standard mock patterns |

### Historical Debt (Resolved)

| ID | Category | Title | Resolution Date |
|----|----------|-------|-----------------|
| TD-100 | Dependency | Outdated TypeScript version | Resolved - Updated to TypeScript 5.2 (2024-03-07) |
| TD-101 | Security | Insecure dependency vulnerabilities | Resolved - Audit and fix completed (2024-03-06) |

## Automated Tech Debt Detection

The project includes automated tech debt detection through:

### 1. Deprecations Detection

Run the following to detect deprecated API usage:

```bash
# Backend - Check for deprecated functions
cd backend
npm run lint
```

### 2. Dependency Check

```bash
# Check for unused dependencies
cd backend
npm run depcheck
```

### 3. Tech Debt Report Generation

Generate a comprehensive tech debt report:

```bash
# Generate tech debt report
cd backend
npm run tech-debt:report

# Generate tech debt report (CI mode)
npm run tech-debt:report:ci
```

## Adding New Tech Debt Items

When identifying new technical debt:

1. **Document the issue**: Add a new entry to the table above with:
   - Unique ID (increment from last entry)
   - Category
   - Clear title and description
   - Severity (Critical/High/Medium/Low)
   - Status (Open/In Progress/Resolved)
   - Date identified
   - Estimated effort to fix

2. **Create tracking issue**: Create a GitHub issue referencing this tech debt ID

3. **Add to CI/CD**: If the debt can be detected automatically, add detection to the tech debt tracking script

## CI/CD Integration

Tech debt tracking is integrated into the CI pipeline. See `.github/workflows/ci.yml` for the `tech-debt-tracking` job.

### Running Tech Debt Checks Locally

```bash
# Run all tech debt checks
make tech-debt-check

# Run only deprecation checks
npm run lint

# Run dependency checks
npm run depcheck

# Generate full report
npm run tech-debt:report
```

## Severity Guidelines

- **Critical**: Must be addressed immediately - security vulnerability or system-breaking issue
- **High**: Should be addressed in current sprint - significant impact on development velocity
- **Medium**: Should be addressed soon - moderate impact on maintenance
- **Low**: Can be addressed when time permits - minor impact, nice to fix

## Status Definitions

- **Open**: Identified but not yet started
- **In Progress**: Currently being addressed
- **Resolved**: Fixed and verified
- **Acknowledged**: Accepted as debt with a plan to address
- **Deferred**: Will be addressed in a future phase

## References

- [AGENTS.md](AGENTS.md) - Development guidelines and conventions
- [DEPENDENCY_MANAGEMENT.md](DEPENDENCY_MANAGEMENT.md) - Dependency management strategy
- [.github/workflows/ci.yml](.github/workflows/ci.yml) - CI/CD configuration
