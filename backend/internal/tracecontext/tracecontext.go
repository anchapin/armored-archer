// Package tracecontext provides trace context extraction for log correlation.
// This package bridges OpenTelemetry tracing with structured logging.
package tracecontext

import (
	"context"

	"go.opentelemetry.io/otel/trace"
)

// TraceContext holds trace context information for log correlation.
type TraceContext struct {
	// TraceID is the unique identifier for the trace
	TraceID string
	// SpanID is the unique identifier for the span
	SpanID string
	// IsSampled indicates if the trace is sampled
	IsSampled bool
}

// ExtractFromContext extracts trace context from a Go context.
// Returns an empty TraceContext if no tracing information is available.
func ExtractFromContext(ctx context.Context) TraceContext {
	if ctx == nil {
		return TraceContext{}
	}

	spanContext := trace.SpanContextFromContext(ctx)
	if !spanContext.IsValid() {
		return TraceContext{}
	}

	return TraceContext{
		TraceID:    spanContext.TraceID().String(),
		SpanID:     spanContext.SpanID().String(),
		IsSampled:  spanContext.IsSampled(),
	}
}

// IsValid returns true if the trace context contains valid trace information.
func (tc TraceContext) IsValid() bool {
	return tc.TraceID != "" && tc.SpanID != ""
}

// ToMap converts the trace context to a map for logging.
func (tc TraceContext) ToMap() map[string]interface{} {
	if !tc.IsValid() {
		return map[string]interface{}{}
	}

	return map[string]interface{}{
		"trace_id":      tc.TraceID,
		"span_id":       tc.SpanID,
		"trace_sampled": tc.IsSampled,
	}
}

// InjectIntoContext injects trace context into a Go context.
func (tc TraceContext) InjectIntoContext(ctx context.Context) context.Context {
	if !tc.IsValid() {
		return ctx
	}

	traceID, err := trace.TraceIDFromHex(tc.TraceID)
	if err != nil {
		return ctx
	}

	spanID, err := trace.SpanIDFromHex(tc.SpanID)
	if err != nil {
		return ctx
	}

	spanContext := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID: traceID,
		SpanID:  spanID,
	})

	return trace.ContextWithSpanContext(ctx, spanContext)
}

// FromMap creates a TraceContext from a map.
func FromMap(m map[string]interface{}) TraceContext {
	tc := TraceContext{}

	if traceID, ok := m["trace_id"].(string); ok {
		tc.TraceID = traceID
	}

	if spanID, ok := m["span_id"].(string); ok {
		tc.SpanID = spanID
	}

	if sampled, ok := m["trace_sampled"].(bool); ok {
		tc.IsSampled = sampled
	}

	return tc
}
