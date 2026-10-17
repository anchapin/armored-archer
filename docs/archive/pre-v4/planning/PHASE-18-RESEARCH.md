# Phase 18 Research: RPC Handler Testing Strategy

## Current State
- RPC handlers in `backend/internal/rpc/` are at 0.0% coverage.
- Handlers depend on `context.Context`, `runtime.Logger`, `sql.DB`, and `runtime.NakamaModule`.
- `getUserIDFromContext` is currently a placeholder returning `""`.
- `mockgen` fails to generate a full mock for `runtime.NakamaModule` due to unnamed struct parameters in some methods.

## Mocking Strategy

### 1. runtime.Logger
We can use the existing `MockNakamaLogger` in `backend/tests/testhelpers/mocks/nakama_logger_mock.go`.

### 2. runtime.NakamaModule
Since automated generation fails, we will implement a manual mock `TestNakamaModule` that embeds `runtime.NakamaModule`. This allows us to only implement the methods we actually use in our handlers.

**Location**: `backend/tests/testhelpers/mocks/nakama_module_mock.go`

**Used Methods to Implement**:
- `StorageRead`
- `StorageWrite`
- `AccountGet`
- `UsersGetId`
- `WalletUpdate`
- `NotificationsSend`

### 3. Session Context
We need a reliable way to simulate a Nakama session in the `context.Context` passed to handlers.

**Plan**:
- Update `getUserIDFromContext` to check for `session.SessionInfo` in the context first.
- Create a test helper `NewTestRPCContext(userID string)` that returns a context with the session info and logger.

## Proposed Implementation Steps

1.  **Shared Utils**: Create `backend/internal/rpc/utils.go` and move `getUserIDFromContext` there. Enhance it to support context-based session retrieval.
2.  **Nakama Mock**: Create `backend/tests/testhelpers/mocks/nakama_module_mock.go`.
3.  **RPC Test Suite**: Create `backend/tests/rpc/rpc_handler_test.go` for `rpc.go` handlers.
4.  **Feedback Test Suite**: Create `backend/tests/rpc/feedback_handler_test.go` for `feedback.go` handlers.

## Target Handlers for Phase 18
- `GetPlayerStats`
- `GetInventory`
- `SubmitFeedback`
- `ListFeedback`
- `VoteFeedback`

## Success Criteria
- [ ] Functional `TestNakamaModule` mock available.
- [ ] `getUserIDFromContext` supports test injection.
- [ ] At least 5 major RPC handlers covered by unit tests.
- [ ] `internal/rpc` package coverage > 50% (initial target).
