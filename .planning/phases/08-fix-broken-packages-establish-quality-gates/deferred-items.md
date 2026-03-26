# Deferred Items - Phase 08, Plan 01

Items discovered during execution that are out of scope for the current plan.

## Pre-existing Compilation Errors (Out of Scope)

### logger package
- **File:** `internal/logger/logger.go:209:40`
- **Error:** `cannot use ctx (variable of interface type context.Context) as LogContext value in argument to ctxWithTrace.Error`
- **Impact:** Blocking `go build ./...` but NOT blocking notifications package compilation
- **Status:** Not in scope for plan 08-01 (fixing notifications package only)

### metrics package
- **File:** `metrics/tracing.go:384:25, 403:25, 421:25, 441:25`
- **Error:** `undefined: trace.StatusCodeError`
- **Impact:** Blocking `go build ./...` but NOT blocking notifications package compilation
- **Status:** Not in scope for plan 08-01 (fixing notifications package only)

## Rationale

These errors are in separate packages (logger and metrics) that are independent of the notifications package. The notifications package compiles successfully and does not depend on logger or metrics. According to deviation rules, only fix issues DIRECTLY caused by the current task's changes. These are pre-existing errors in unrelated packages.

## Recommendation

These issues should be addressed in a separate plan focused on fixing all remaining compilation errors across the backend packages.
