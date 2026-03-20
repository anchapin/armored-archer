// Package runtime provides interface wrappers for Nakama runtime components.
// This enables mocking for unit tests.
package runtime

import (
	"github.com/heroiclabs/nakama-common/runtime"
)

// Logger defines the logging interface used in RPC handlers.
type Logger interface {
	Info(format string, args ...interface{})
	Debug(format string, args ...interface{})
	Warn(format string, args ...interface{})
	Error(format string, args ...interface{})
}

// NakamaLogger wraps the Nakama runtime.Logger to implement our Logger interface.
type NakamaLogger struct {
	logger runtime.Logger
}

// NewNakamaLogger creates a new wrapper around Nakama's runtime.Logger.
func NewNakamaLogger(logger runtime.Logger) Logger {
	return &NakamaLogger{logger: logger}
}

// Info logs an info message.
func (l *NakamaLogger) Info(format string, args ...interface{}) {
	l.logger.Info(format, args...)
}

// Debug logs a debug message.
func (l *NakamaLogger) Debug(format string, args ...interface{}) {
	l.logger.Debug(format, args...)
}

// Warn logs a warning message.
func (l *NakamaLogger) Warn(format string, args ...interface{}) {
	l.logger.Warn(format, args...)
}

// Error logs an error message.
func (l *NakamaLogger) Error(format string, args ...interface{}) {
	l.logger.Error(format, args...)
}

// Ensure NakamaLogger implements Logger interface
var _ Logger = (*NakamaLogger)(nil)
