// Package errors provides error types and helpers for the Armored Archer backend.
package errors

import (
	"fmt"
)

// ErrorCode represents standard error codes.
type ErrorCode string

const (
	// ErrUnknown - Unknown error
	ErrUnknown ErrorCode = "UNKNOWN"
	// ErrNotFound - Resource not found
	ErrNotFound ErrorCode = "NOT_FOUND"
	// ErrInvalidArgument - Invalid argument provided
	ErrInvalidArgument ErrorCode = "INVALID_ARGUMENT"
	// ErrAlreadyExists - Resource already exists
	ErrAlreadyExists ErrorCode = "ALREADY_EXISTS"
	// ErrPermissionDenied - Permission denied
	ErrPermissionDenied ErrorCode = "PERMISSION_DENIED"
	// ErrUnauthenticated - Not authenticated
	ErrUnauthenticated ErrorCode = "NOT_AUTHENTICATED"
	// ErrInternal - Internal server error
	ErrInternal ErrorCode = "INTERNAL"
	// ErrUnavailable - Service unavailable
	ErrUnavailable ErrorCode = "UNAVAILABLE"
	// ErrValidation - Validation error
	ErrValidation ErrorCode = "VALIDATION"
)

// AppError represents an application error with context.
type AppError struct {
	Code       ErrorCode            `json:"code"`
	Message    string               `json:"message"`
	Details    map[string]string    `json:"details,omitempty"`
	StatusCode int                  `json:"-"`
	Err        error                `json:"-"`
}

// Error implements the error interface.
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the underlying error.
func (e *AppError) Unwrap() error {
	return e.Err
}

// New creates a new AppError.
func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Details: make(map[string]string),
	}
}

// Wrap wraps an existing error.
func Wrap(err error, code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
		Details: make(map[string]string),
	}
}

// WithDetail adds a detail to the error.
func (e *AppError) WithDetail(key, value string) *AppError {
	if e.Details == nil {
		e.Details = make(map[string]string)
	}
	e.Details[key] = value
	return e
}

// WithStatusCode sets the HTTP status code.
func (e *AppError) WithStatusCode(code int) *AppError {
	e.StatusCode = code
	return e
}

// Convenience functions for common errors

// NotFound creates a not found error.
func NotFound(resource, id string) *AppError {
	return New(ErrNotFound, fmt.Sprintf("%s not found: %s", resource, id))
}

// InvalidArgument creates an invalid argument error.
func InvalidArgument(field, reason string) *AppError {
	return New(ErrInvalidArgument, fmt.Sprintf("invalid %s: %s", field, reason))
}

// PermissionDenied creates a permission denied error.
func PermissionDenied(action string) *AppError {
	return New(ErrPermissionDenied, fmt.Sprintf("permission denied: %s", action))
}

// Unauthenticated creates an unauthenticated error.
func Unauthenticated() *AppError {
	return New(ErrUnauthenticated, "authentication required")
}

// Internal creates an internal server error.
func Internal(message string) *AppError {
	return New(ErrInternal, message)
}

// Validation creates a validation error.
func Validation(field, message string) *AppError {
	return New(ErrValidation, fmt.Sprintf("validation failed for %s: %s", field, message))
}

// IsAppError checks if an error is an AppError.
func IsAppError(err error) bool {
	_, ok := err.(*AppError)
	return ok
}

// IsNotFound checks if an error is a not found error.
func IsNotFound(err error) bool {
	appErr, ok := err.(*AppError)
	return ok && appErr.Code == ErrNotFound
}

// IsInvalidArgument checks if an error is an invalid argument error.
func IsInvalidArgument(err error) bool {
	appErr, ok := err.(*AppError)
	return ok && appErr.Code == ErrInvalidArgument
}

// IsUnauthenticated checks if an error is an unauthenticated error.
func IsUnauthenticated(err error) bool {
	appErr, ok := err.(*AppError)
	return ok && appErr.Code == ErrUnauthenticated
}
