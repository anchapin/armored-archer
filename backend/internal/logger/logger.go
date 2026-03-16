// Package logger provides structured logging for the Armored Archer backend.
package logger

import (
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// LogLevel represents log severity levels.
type LogLevel int

const (
	DebugLevel LogLevel = iota
	InfoLevel
	WarnLevel
	ErrorLevel
)

func (l LogLevel) String() string {
	switch l {
	case DebugLevel:
		return "DEBUG"
	case InfoLevel:
		return "INFO"
	case WarnLevel:
		return "WARN"
	case ErrorLevel:
		return "ERROR"
	default:
		return "UNKNOWN"
	}
}

// LogContext provides additional context for log entries.
type LogContext map[string]interface{}

// StructuredLogger wraps Nakama's logger with structured logging capabilities.
type StructuredLogger struct {
	logger  runtime.Logger
	service string
	version string
	defaultFields LogContext
}

// NewStructuredLogger creates a new structured logger.
func NewStructuredLogger(logger runtime.Logger, service, version string) *StructuredLogger {
	return &StructuredLogger{
		logger:  logger,
		service: service,
		version: version,
		defaultFields: make(LogContext),
	}
}

// WithField adds a default field to all log entries.
func (l *StructuredLogger) WithField(key string, value interface{}) *StructuredLogger {
	l.defaultFields[key] = value
	return l
}

// WithFields adds multiple default fields to all log entries.
func (l *StructuredLogger) WithFields(fields LogContext) *StructuredLogger {
	for k, v := range fields {
		l.defaultFields[k] = v
	}
	return l
}

// formatMessage formats a log message with context.
func (l *StructuredLogger) formatMessage(level LogLevel, message string, ctx LogContext) string {
	timestamp := time.Now().Format(time.RFC3339)
	
	// Merge default fields with context
	fields := make(LogContext)
	for k, v := range l.defaultFields {
		fields[k] = v
	}
	for k, v := range ctx {
		fields[k] = v
	}

	// Build context string
	ctxStr := ""
	if len(fields) > 0 {
		ctxStr = " "
		for k, v := range fields {
			ctxStr += fmt.Sprintf("%s=%v ", k, v)
		}
	}

	return fmt.Sprintf("[%s] [%s] [%s] %s%s", 
		timestamp, 
		level.String(),
		l.service,
		message,
		ctxStr)
}

// Debug logs a debug message.
func (l *StructuredLogger) Debug(message string, ctx ...LogContext) {
	if l.logger != nil {
		c := mergeContexts(ctx...)
		l.logger.Debug(l.formatMessage(DebugLevel, message, c))
	}
}

// Info logs an info message.
func (l *StructuredLogger) Info(message string, ctx ...LogContext) {
	if l.logger != nil {
		c := mergeContexts(ctx...)
		l.logger.Info(l.formatMessage(InfoLevel, message, c))
	}
}

// Warn logs a warning message.
func (l *StructuredLogger) Warn(message string, ctx ...LogContext) {
	if l.logger != nil {
		c := mergeContexts(ctx...)
		l.logger.Warn(l.formatMessage(WarnLevel, message, c))
	}
}

// Error logs an error message.
func (l *StructuredLogger) Error(message string, ctx ...LogContext) {
	if l.logger != nil {
		c := mergeContexts(ctx...)
		l.logger.Error(l.formatMessage(ErrorLevel, message, c))
	}
}

// LogRpcEntry logs an RPC handler entry.
func (l *StructuredLogger) LogRpcEntry(rpcName, userID string, payloadSize int) {
	l.Debug("RPC entry", LogContext{
		"rpc_name":     rpcName,
		"user_id":      userID,
		"payload_size": payloadSize,
		"operation":    "rpc_entry",
	})
}

// LogRpcExit logs an RPC handler exit.
func (l *StructuredLogger) LogRpcExit(rpcName, userID string, durationMs int64, success bool) {
	ctx := LogContext{
		"rpc_name":   rpcName,
		"user_id":    userID,
		"duration_ms": durationMs,
		"operation":  "rpc_exit",
		"success":    success,
	}
	
	if success {
		l.Debug("RPC exit", ctx)
	} else {
		l.Warn("RPC exit with error", ctx)
	}
}

// LogRpcError logs an RPC handler error.
func (l *StructuredLogger) LogRpcError(rpcName, userID string, err error, durationMs int64) {
	l.Error("RPC error", LogContext{
		"rpc_name":    rpcName,
		"user_id":     userID,
		"error":       err.Error(),
		"duration_ms": durationMs,
		"operation":   "rpc_error",
	})
}

// LogCacheOperation logs a cache operation.
func (l *StructuredLogger) LogCacheOperation(operation, key string, hit bool, durationMs int64) {
	l.Debug("Cache operation", LogContext{
		"operation":   operation,
		"key":         key,
		"cache_hit":   hit,
		"duration_ms": durationMs,
	})
}

// LogDatabaseOperation logs a database operation.
func (l *StructuredLogger) LogDatabaseOperation(operation, query string, durationMs int64, err error) {
	ctx := LogContext{
		"operation":   operation,
		"query":       query,
		"duration_ms": durationMs,
	}
	
	if err != nil {
		ctx["error"] = err.Error()
		l.Error("Database error", ctx)
	} else {
		l.Debug("Database operation", ctx)
	}
}

// LogSystemEvent logs a system event.
func (l *StructuredLogger) LogSystemEvent(event, status string, details LogContext) {
	ctx := LogContext{
		"event":  event,
		"status": status,
	}
	mergeContextsInto(ctx, details)
	l.Info("System event", ctx)
}

// mergeContexts merges multiple contexts into one.
func mergeContexts(ctxs ...LogContext) LogContext {
	result := make(LogContext)
	for _, ctx := range ctxs {
		for k, v := range ctx {
			result[k] = v
		}
	}
	return result
}

// mergeContextsInto merges source context into destination.
func mergeContextsInto(dst, src LogContext) {
	for k, v := range src {
		dst[k] = v
	}
}

// CreateChildLogger creates a child logger with additional default fields.
func (l *StructuredLogger) CreateChildLogger(fields LogContext) *StructuredLogger {
	child := &StructuredLogger{
		logger:  l.logger,
		service: l.service,
		version: l.version,
		defaultFields: make(LogContext),
	}
	
	// Copy parent's default fields
	for k, v := range l.defaultFields {
		child.defaultFields[k] = v
	}
	
	// Add child-specific fields
	for k, v := range fields {
		child.defaultFields[k] = v
	}
	
	return child
}
