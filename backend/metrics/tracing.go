// Package metrics provides OpenTelemetry tracing for the Armored Archer backend.
// This package implements distributed tracing using OpenTelemetry and Grafana Tempo.
package metrics

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

// TracingConfig holds tracing configuration.
type TracingConfig struct {
	// Enabled enables/disables tracing
	Enabled bool `json:"enabled" yaml:"enabled"`
	// ServiceName is the name of the service
	ServiceName string `json:"service_name" yaml:"service_name"`
	// ServiceVersion is the version of the service
	ServiceVersion string `json:"service_version" yaml:"service_version"`
	// OTLPEndpoint is the OTLP collector endpoint (host:port)
	OTLPEndpoint string `json:"otlp_endpoint" yaml:"otlp_endpoint"`
	// SamplingRate is the sampling rate (0.0-1.0)
	// For production, use 0.01 (1%) to reduce overhead
	// For development, use 1.0 (100%) for full tracing
	SamplingRate float64 `json:"sampling_rate" yaml:"sampling_rate"`
	// BatchTimeout is the timeout for batch exporting
	BatchTimeout time.Duration `json:"batch_timeout" yaml:"batch_timeout"`
	// MaxExportBatchSize is the maximum batch size for exporting
	MaxExportBatchSize int `json:"max_export_batch_size" yaml:"max_export_batch_size"`
	// Environment is the deployment environment
	Environment string `json:"environment" yaml:"environment"`
}

// DefaultTracingConfig returns default tracing configuration.
func DefaultTracingConfig() *TracingConfig {
	return &TracingConfig{
		Enabled:            true,
		ServiceName:        "armored-archer-backend",
		ServiceVersion:     "v2.1.0",
		OTLPEndpoint:       "otel-collector:4317",
		SamplingRate:       0.01, // 1% sampling for production
		BatchTimeout:       5 * time.Second,
		MaxExportBatchSize: 512,
		Environment:        getEnvOrDefault("ENVIRONMENT", "development"),
	}
}

// TracingProvider holds the tracing provider and related components.
type TracingProvider struct {
	config     *TracingConfig
	tp         trace.TracerProvider
	shutdownFn func(context.Context) error
	mu         sync.RWMutex
	tracer     trace.Tracer
}

// globalTracingProvider is the global tracing provider instance.
var globalTracingProvider *TracingProvider
var tracingOnce sync.Once

// GetTracingProvider returns the global tracing provider.
func GetTracingProvider() *TracingProvider {
	tracingOnce.Do(func() {
		globalTracingProvider = NewTracingProvider(DefaultTracingConfig())
	})
	return globalTracingProvider
}

// NewTracingProvider creates a new tracing provider.
func NewTracingProvider(config *TracingConfig) *TracingProvider {
	tp := &TracingProvider{
		config: config,
	}

	if config.Enabled {
		if err := tp.initialize(); err != nil {
			// Log error but continue with noop tracer
			fmt.Printf("Warning: Failed to initialize tracing: %v\n", err)
			tp.setupNoop()
		}
	} else {
		tp.setupNoop()
	}

	return tp
}

// initialize sets up the OpenTelemetry tracing provider.
func (tp *TracingProvider) initialize() error {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	// Create OTLP exporter
	exporter, err := otlptrace.New(
		context.Background(),
		otlptracegrpc.NewClient(
			otlptracegrpc.WithEndpoint(tp.config.OTLPEndpoint),
			otlptracegrpc.WithInsecure(), // Use TLS in production
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create resource with service attributes
	res, err := resource.New(
		context.Background(),
		semconv.ServiceName(tp.config.ServiceName),
		semconv.ServiceVersion(tp.config.ServiceVersion),
		semconv.DeploymentEnvironment(tp.config.Environment),
		attribute.String("service.instance.id", getInstanceID()),
		attribute.String("host.name", getHostname()),
	)
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	// Create sampler based on sampling rate
	sampler := sdktrace.ParentBased(
		sdktrace.TraceIDRatioBased(tp.config.SamplingRate),
	)

	// Create trace provider
	traceProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sampler),
		sdktrace.WithResource(res),
		sdktrace.WithBatcher(
			exporter,
			sdktrace.WithBatchTimeout(tp.config.BatchTimeout),
			sdktrace.WithMaxExportBatchSize(tp.config.MaxExportBatchSize),
		),
	)

	// Set global tracer provider
	otel.SetTracerProvider(traceProvider)

	// Set global propagator (W3C Trace Context + Baggage)
	otel.SetTextMapPropagator(
		propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{},
			propagation.Baggage{},
		),
	)

	tp.tp = traceProvider
	tp.tracer = traceProvider.Tracer(tp.config.ServiceName)
	tp.shutdownFn = func(ctx context.Context) error {
		return traceProvider.Shutdown(ctx)
	}

	fmt.Printf("Tracing initialized: service=%s, sampling_rate=%.2f%%, endpoint=%s\n",
		tp.config.ServiceName,
		tp.config.SamplingRate*100,
		tp.config.OTLPEndpoint,
	)

	return nil
}

// setupNoop sets up a no-op tracer for disabled tracing.
func (tp *TracingProvider) setupNoop() {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	tp.tp = noop.NewTracerProvider()
	tp.tracer = tp.tp.Tracer("noop")
	tp.shutdownFn = func(ctx context.Context) error { return nil }
}

// Tracer returns the tracer for the given name.
func (tp *TracingProvider) Tracer(name string) trace.Tracer {
	tp.mu.RLock()
	defer tp.mu.RUnlock()

	if name == "" {
		return tp.tracer
	}
	return tp.tp.Tracer(name)
}

// Shutdown gracefully shuts down the tracing provider.
func (tp *TracingProvider) Shutdown(ctx context.Context) error {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	if tp.shutdownFn != nil {
		return tp.shutdownFn(ctx)
	}
	return nil
}

// StartSpan starts a new span with the given name and options.
func (tp *TracingProvider) StartSpan(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	tp.mu.RLock()
	tracer := tp.tracer
	tp.mu.RUnlock()

	return tracer.Start(ctx, spanName, opts...)
}

// IsTracingEnabled returns whether tracing is enabled.
func (tp *TracingProvider) IsTracingEnabled() bool {
	return tp.config.Enabled
}

// GetConfig returns the tracing configuration.
func (tp *TracingProvider) GetConfig() *TracingConfig {
	return tp.config
}

// SpanTimer is a helper for timing spans.
type SpanTimer struct {
	ctx  context.Context
	span trace.Span
}

// Stop ends the span and records the duration.
func (st *SpanTimer) Stop() {
	if st.span != nil {
		st.span.End()
	}
}

// SetStatus sets the span status.
func (st *SpanTimer) SetStatus(code trace.StatusCode, description string) {
	if st.span != nil {
		st.span.SetStatus(code, description)
	}
}

// RecordError records an error in the span.
func (st *SpanTimer) RecordError(err error) {
	if st.span != nil {
		st.span.RecordError(err)
	}
}

// SetAttribute sets an attribute on the span.
func (st *SpanTimer) SetAttribute(key string, value interface{}) {
	if st.span != nil {
		switch v := value.(type) {
		case string:
			st.span.SetAttributes(attribute.String(key, v))
		case int:
			st.span.SetAttributes(attribute.Int(key, v))
		case int64:
			st.span.SetAttributes(attribute.Int64(key, v))
		case float64:
			st.span.SetAttributes(attribute.Float64(key, v))
		case bool:
			st.span.SetAttributes(attribute.Bool(key, v))
		case []string:
			st.span.SetAttributes(attribute.StringSlice(key, v))
		default:
			st.span.SetAttributes(attribute.String(key, fmt.Sprintf("%v", v)))
		}
	}
}

// StartTimedSpan starts a span and returns a timer for automatic duration tracking.
func (tp *TracingProvider) StartTimedSpan(ctx context.Context, spanName string) *SpanTimer {
	ctx, span := tp.StartSpan(ctx, spanName)
	return &SpanTimer{
		ctx:  ctx,
		span: span,
	}
}

// GetTraceID extracts the trace ID from the context.
func GetTraceID(ctx context.Context) string {
	spanContext := trace.SpanFromContext(ctx).SpanContext()
	if spanContext.HasTraceID() {
		return spanContext.TraceID().String()
	}
	return ""
}

// GetSpanID extracts the span ID from the context.
func GetSpanID(ctx context.Context) string {
	spanContext := trace.SpanFromContext(ctx).SpanContext()
	if spanContext.HasSpanID() {
		return spanContext.SpanID().String()
	}
	return ""
}

// IsSampled returns true if the current span is sampled.
func IsSampled(ctx context.Context) bool {
	return trace.SpanFromContext(ctx).SpanContext().IsSampled()
}

// Inject injects tracing context into a carrier (for outgoing requests).
func Inject(ctx context.Context, carrier propagation.TextMapCarrier) {
	otel.GetTextMapPropagator().Inject(ctx, carrier)
}

// Extract extracts tracing context from a carrier (for incoming requests).
func Extract(ctx context.Context, carrier propagation.TextMapCarrier) context.Context {
	return otel.GetTextMapPropagator().Extract(ctx, carrier)
}

// TextMapCarrier is a simple text map carrier for propagation.
type TextMapCarrier map[string]string

// Get returns a value from the carrier.
func (c TextMapCarrier) Get(key string) string {
	val, ok := c[key]
	if !ok {
		return ""
	}
	return val
}

// Set sets a value in the carrier.
func (c TextMapCarrier) Set(key string, value string) {
	c[key] = value
}

// Keys returns all keys in the carrier.
func (c TextMapCarrier) Keys() []string {
	keys := make([]string, 0, len(c))
	for k := range c {
		keys = append(keys, k)
	}
	return keys
}

// Common attribute keys for tracing.
const (
	AttributeRPCName      = "rpc.name"
	AttributeRPCMethod    = "rpc.method"
	AttributeRPCSystem    = "rpc.system"
	AttributeUserID       = "user.id"
	AttributePlayerID     = "player.id"
	AttributeMatchID      = "match.id"
	AttributeMatchType    = "match.type"
	AttributeCombatAction = "combat.action"
	AttributeGearType     = "gear.type"
	AttributeGearRarity   = "gear.rarity"
	AttributeCurrencyType = "currency.type"
	AttributeSeason       = "season"
	AttributeErrorCode    = "error.code"
	AttributeErrorMessage = "error.message"
	AttributeDBQuery      = "db.query"
	AttributeDBSystem     = "db.system"
	AttributeCacheKey     = "cache.key"
	AttributeCacheHit     = "cache.hit"
	AttributeHTTPMethod   = "http.method"
	AttributeHTTPURL      = "http.url"
	AttributeHTTPStatus   = "http.status_code"
)

// TraceRPC wraps an RPC call with tracing.
func TraceRPC(ctx context.Context, rpcName string, userID string, fn func(context.Context) (string, error)) (string, error) {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, fmt.Sprintf("rpc/%s", rpcName))
	defer timer.Stop()

	// Set common attributes
	timer.SetAttribute(AttributeRPCName, rpcName)
	timer.SetAttribute(AttributeRPCSystem, "nakama")
	if userID != "" {
		timer.SetAttribute(AttributeUserID, userID)
	}

	// Execute the RPC
	result, err := fn(timer.ctx)

	// Record error if present
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
		timer.SetAttribute(AttributeErrorCode, "rpc_error")
	}

	return result, err
}

// TraceDatabase wraps a database operation with tracing.
func TraceDatabase(ctx context.Context, query string, fn func(context.Context) error) error {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, "db/query")
	defer timer.Stop()

	timer.SetAttribute(AttributeDBQuery, truncateString(query, 500))
	timer.SetAttribute(AttributeDBSystem, "postgresql")

	err := fn(timer.ctx)
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
	}

	return err
}

// TraceCache wraps a cache operation with tracing.
func TraceCache(ctx context.Context, operation string, key string, hit bool, fn func(context.Context) error) error {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, fmt.Sprintf("cache/%s", operation))
	defer timer.Stop()

	timer.SetAttribute(AttributeCacheKey, key)
	timer.SetAttribute(AttributeCacheHit, hit)

	err := fn(timer.ctx)
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
	}

	return err
}

// TraceMatch wraps a match operation with tracing.
func TraceMatch(ctx context.Context, matchType string, matchID string, fn func(context.Context) error) error {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, fmt.Sprintf("match/%s", matchType))
	defer timer.Stop()

	timer.SetAttribute(AttributeMatchType, matchType)
	if matchID != "" {
		timer.SetAttribute(AttributeMatchID, matchID)
	}

	err := fn(timer.ctx)
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
	}

	return err
}

// TraceCombat wraps a combat action with tracing.
func TraceCombat(ctx context.Context, actionType string, fn func(context.Context) error) error {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, fmt.Sprintf("combat/%s", actionType))
	defer timer.Stop()

	timer.SetAttribute(AttributeCombatAction, actionType)

	err := fn(timer.ctx)
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
	}

	return err
}

// TraceGear wraps a gear operation with tracing.
func TraceGear(ctx context.Context, operation string, gearType string, rarity string, fn func(context.Context) error) error {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, fmt.Sprintf("gear/%s", operation))
	defer timer.Stop()

	timer.SetAttribute(AttributeGearType, gearType)
	timer.SetAttribute(AttributeGearRarity, rarity)

	err := fn(timer.ctx)
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
	}

	return err
}

// TraceSeason wraps a season operation with tracing.
func TraceSeason(ctx context.Context, operation string, season string, fn func(context.Context) error) error {
	tp := GetTracingProvider()
	timer := tp.StartTimedSpan(ctx, fmt.Sprintf("season/%s", operation))
	defer timer.Stop()

	timer.SetAttribute(AttributeSeason, season)

	err := fn(timer.ctx)
	if err != nil {
		timer.RecordError(err)
		timer.SetStatus(trace.StatusCodeError, err.Error())
	}

	return err
}

// Helper functions

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getInstanceID() string {
	if id := os.Getenv("INSTANCE_ID"); id != "" {
		return id
	}
	if id := os.Getenv("HOSTNAME"); id != "" {
		return id
	}
	return "unknown"
}

func getHostname() string {
	if hostname := os.Getenv("HOSTNAME"); hostname != "" {
		return hostname
	}
	return "unknown"
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// InitializeTracing initializes the global tracing provider.
// Call this once at application startup.
func InitializeTracing(config *TracingConfig) error {
	if config == nil {
		config = DefaultTracingConfig()
	}

	// Override global provider
	globalTracingProvider = NewTracingProvider(config)
	return nil
}

// ShutdownTracing gracefully shuts down tracing.
// Call this at application shutdown.
func ShutdownTracing(ctx context.Context) error {
	if globalTracingProvider != nil {
		return globalTracingProvider.Shutdown(ctx)
	}
	return nil
}

// GetTracer returns the global tracer.
func GetTracer() trace.Tracer {
	return GetTracingProvider().Tracer("")
}
