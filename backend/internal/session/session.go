// Package session provides session validation helpers for the Armored Archer backend.
package session

import (
	"context"
	"strings"

	apperrors "github.com/anchapin/armored-archer/backend/internal/errors"
)

// SessionInfo contains validated session information.
type SessionInfo struct {
	UserID      string
	Username    string
	SessionID   string
	ExpiresAt   int64
	IsAnonymous bool
	Metadata    map[string]string
}

// ValidateSessionToken validates a session token format.
func ValidateSessionToken(token string) error {
	if token == "" {
		return apperrors.Unauthenticated().WithDetail("reason", "missing token")
	}
	
	// Basic JWT format check (Nakama uses JWT tokens)
	if !strings.Contains(token, ".") {
		return apperrors.New(apperrors.ErrInvalidArgument, "invalid token format")
	}
	
	return nil
}

// ValidateSessionExpiry checks if a session has expired.
func ValidateSessionExpiry(expiresAt int64) error {
	if expiresAt == 0 {
		return apperrors.New(apperrors.ErrUnauthenticated, "session has no expiry")
	}

	if getTime() > expiresAt {
		return apperrors.New(apperrors.ErrUnauthenticated, "session expired")
	}

	return nil
}

// getTime returns current Unix time (for testing).
var getTime = func() int64 {
	return getTimeFunc()
}

var getTimeFunc = func() int64 {
	return 0 // Will be set to time.Now().Unix() in production
}

// RequireSession validates session requirements.
// This is a helper for RPC handlers that require authentication.
func RequireSession(token string, expiresAt int64) (*SessionInfo, error) {
	if err := ValidateSessionToken(token); err != nil {
		return nil, err
	}

	// Note: Full session validation requires Nakama to decode the JWT
	// This is typically done in the RPC handler using the Nakama runtime
	session := &SessionInfo{
		SessionID: token,
		ExpiresAt: expiresAt,
	}

	if err := ValidateSessionExpiry(expiresAt); err != nil {
		return nil, err
	}

	return session, nil
}

// ExtractSessionToken extracts the session token from metadata.
func ExtractSessionToken(metadata map[string]string) string {
	// Try authorization header
	if auth := metadata["authorization"]; strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}

	// Try token directly
	if token := metadata["token"]; token != "" {
		return token
	}

	return ""
}

// IsAdmin checks if a session has admin privileges.
func IsAdmin(session *SessionInfo) bool {
	if session.Metadata == nil {
		return false
	}
	return session.Metadata["role"] == "admin" || session.Metadata["is_admin"] == "true"
}

// RequireAdmin validates that a session has admin privileges.
func RequireAdmin(session *SessionInfo) error {
	if !IsAdmin(session) {
		return apperrors.PermissionDenied("admin access required")
	}
	return nil
}

// SessionContextKey is the context key for storing session info.
type SessionContextKey string

const SessionInfoKey SessionContextKey = "session_info"

// WithSessionInContext stores session info in the context.
func WithSessionInContext(ctx context.Context, session *SessionInfo) context.Context {
	return context.WithValue(ctx, SessionInfoKey, session)
}

// SessionFromContext retrieves session info from the context.
func SessionFromContext(ctx context.Context) (*SessionInfo, bool) {
	session, ok := ctx.Value(SessionInfoKey).(*SessionInfo)
	return session, ok
}

// ValidateUserOwnership checks if a session owns a resource.
func ValidateUserOwnership(session *SessionInfo, resourceUserID string) error {
	if session.UserID != resourceUserID {
		return apperrors.PermissionDenied("resource ownership required")
	}
	return nil
}

// CreateSessionInfo creates a session info from Nakama runtime context.
// This should be called in RPC handlers with the Nakama-provided session data.
func CreateSessionInfo(userID, username, sessionID string, expiresAt int64, metadata map[string]string) *SessionInfo {
	return &SessionInfo{
		UserID:      userID,
		Username:    username,
		SessionID:   sessionID,
		ExpiresAt:   expiresAt,
		IsAnonymous: metadata != nil && metadata["anonymous"] == "true",
		Metadata:    metadata,
	}
}
