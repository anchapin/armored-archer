// Package observability provides metrics, health checks, and monitoring for the Armored Archer backend.
package observability

import (
	"encoding/json"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/anchapin/armored-archer/backend/metrics"
)

// Health status constants
const (
	HealthStatusHealthy   = "healthy"
	HealthStatusDegraded  = "degraded"
	HealthStatusUnhealthy = "unhealthy"
)

// Service names
const (
	ServiceDatabase    = "database"
	ServiceCache       = "cache"
	ServiceStorage     = "storage"
	ServiceMatchmaking = "matchmaking"
	ServiceNotifications = "notifications"
)

// Metric types
const (
	MetricTypeCounter   = "counter"
	MetricTypeGauge     = "gauge"
	MetricTypeHistogram = "histogram"
)

// HealthCheckResult represents the result of a health check.
type HealthCheckResult struct {
	Status    string            `json:"status"`
	Timestamp int64             `json:"timestamp"`
	Services  map[string]*ServiceHealth `json:"services"`
	Version   string            `json:"version"`
	Uptime    int64             `json:"uptime_seconds"`
}

// ServiceHealth represents the health of a single service.
type ServiceHealth struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	Latency int64  `json:"latency_ms,omitempty"`
}

// Metric represents a single metric value.
type Metric struct {
	Name      string                 `json:"name"`
	Type      string                 `json:"type"`
	Value     float64                `json:"value"`
	Labels    map[string]string      `json:"labels,omitempty"`
	Timestamp int64                  `json:"timestamp"`
}

// MetricsRegistry holds all registered metrics.
type MetricsRegistry struct {
	metrics map[string]*Metric
	mu      sync.RWMutex
	startTime time.Time
}

// Alert represents an alert.
type Alert struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Severity  string            `json:"severity"` // "critical", "warning", "info"
	Status    string            `json:"status"`   // "firing", "resolved"
	Message   string            `json:"message"`
	Labels    map[string]string `json:"labels,omitempty"`
	Value     float64           `json:"value,omitempty"`
	Threshold float64           `json:"threshold"`
	Timestamp int64             `json:"timestamp"`
}

// ErrorInsight represents an error insight.
type ErrorInsight struct {
	ID           string            `json:"id"`
	ErrorType    string            `json:"error_type"`
	Message      string            `json:"message"`
	StackTrace   string            `json:"stack_trace,omitempty"`
	Count        int               `json:"count"`
	FirstSeen    int64             `json:"first_seen"`
	LastSeen     int64             `json:"last_seen"`
	AffectedUsers []string         `json:"affected_users,omitempty"`
	Context      map[string]string `json:"context,omitempty"`
	Severity     string            `json:"severity"`
}

// ProfilingData represents profiling data.
type ProfilingData struct {
	Goroutines  int       `json:"goroutines"`
	Threads     int       `json:"threads"`
	HeapAlloc   uint64    `json:"heap_alloc_bytes"`
	HeapSys     uint64    `json:"heap_sys_bytes"`
	HeapObjects uint64    `json:"heap_objects"`
	GCPauses    uint64    `json:"gc_pauses_total"`
	GCDuration  float64   `json:"gc_duration_fraction"`
	Timestamp   time.Time `json:"timestamp"`
}

// NewMetricsRegistry creates a new metrics registry.
func NewMetricsRegistry() *MetricsRegistry {
	return &MetricsRegistry{
		metrics:   make(map[string]*Metric),
		startTime: time.Now(),
	}
}

// Global metrics registry
var globalRegistry = NewMetricsRegistry()

// GetMetricsRegistry returns the global metrics registry.
func GetMetricsRegistry() *MetricsRegistry {
	return globalRegistry
}

// RegisterCounter registers a counter metric.
func (r *MetricsRegistry) RegisterCounter(name string, labels map[string]string, value float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	key := r.getMetricKey(name, labels)
	r.metrics[key] = &Metric{
		Name:      name,
		Type:      MetricTypeCounter,
		Value:     value,
		Labels:    labels,
		Timestamp: time.Now().UnixMilli(),
	}
}

// IncrementCounter increments a counter metric.
func (r *MetricsRegistry) IncrementCounter(name string, labels map[string]string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	key := r.getMetricKey(name, labels)
	if existing, ok := r.metrics[key]; ok {
		existing.Value++
		existing.Timestamp = time.Now().UnixMilli()
	} else {
		r.metrics[key] = &Metric{
			Name:      name,
			Type:      MetricTypeCounter,
			Value:     1,
			Labels:    labels,
			Timestamp: time.Now().UnixMilli(),
		}
	}
}

// RegisterGauge registers a gauge metric.
func (r *MetricsRegistry) RegisterGauge(name string, labels map[string]string, value float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	key := r.getMetricKey(name, labels)
	r.metrics[key] = &Metric{
		Name:      name,
		Type:      MetricTypeGauge,
		Value:     value,
		Labels:    labels,
		Timestamp: time.Now().UnixMilli(),
	}
}

// SetGauge sets a gauge metric value.
func (r *MetricsRegistry) SetGauge(name string, labels map[string]string, value float64) {
	r.RegisterGauge(name, labels, value)
}

// RegisterHistogram registers a histogram metric.
func (r *MetricsRegistry) RegisterHistogram(name string, labels map[string]string, value float64) {
	// For simplicity, we store the value directly
	// In production, you would use proper histogram buckets
	r.RegisterGauge(name+"_bucket", labels, value)
}

// ObserveHistogram observes a value in a histogram.
func (r *MetricsRegistry) ObserveHistogram(name string, labels map[string]string, value float64) {
	r.RegisterHistogram(name, labels, value)
}

// GetMetrics returns all registered metrics.
func (r *MetricsRegistry) GetMetrics() []*Metric {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	metrics := make([]*Metric, 0, len(r.metrics))
	for _, m := range r.metrics {
		metrics = append(metrics, m)
	}
	return metrics
}

// GetUptime returns the uptime in seconds.
func (r *MetricsRegistry) GetUptime() int64 {
	return int64(time.Since(r.startTime).Seconds())
}

func (r *MetricsRegistry) getMetricKey(name string, labels map[string]string) string {
	key := name
	for k, v := range labels {
		key += fmt.Sprintf("|%s=%s", k, v)
	}
	return key
}

// CheckHealth performs a health check.
func CheckHealth(version string) *HealthCheckResult {
	result := &HealthCheckResult{
		Status:    HealthStatusHealthy,
		Timestamp: time.Now().UnixMilli(),
		Services:  make(map[string]*ServiceHealth),
		Version:   version,
		Uptime:    globalRegistry.GetUptime(),
	}
	
	// Check database health (placeholder)
	result.Services[ServiceDatabase] = &ServiceHealth{
		Status:  HealthStatusHealthy,
		Message: "Database connection OK",
	}
	
	// Check cache health (placeholder)
	result.Services[ServiceCache] = &ServiceHealth{
		Status:  HealthStatusHealthy,
		Message: "Cache connection OK",
	}
	
	// Check storage health (placeholder)
	result.Services[ServiceStorage] = &ServiceHealth{
		Status:  HealthStatusHealthy,
		Message: "Storage connection OK",
	}
	
	return result
}

// CheckServiceHealth checks the health of a specific service.
func CheckServiceHealth(serviceName string) *ServiceHealth {
	// Placeholder implementation
	// In production, this would actually check the service
	return &ServiceHealth{
		Status:  HealthStatusHealthy,
		Message: fmt.Sprintf("%s OK", serviceName),
		Latency: 1, // 1ms placeholder
	}
}

// RecordRPCMetrics records metrics for an RPC call.
func RecordRPCMetrics(rpcName string, durationMs int64, success bool, errorCode string) {
	// Increment total RPC calls
	globalRegistry.IncrementCounter("rpc_calls_total", map[string]string{
		"rpc": rpcName,
	})
	
	// Record duration
	globalRegistry.ObserveHistogram("rpc_duration_seconds", map[string]string{
		"rpc": rpcName,
	}, float64(durationMs)/1000.0)
	
	// Record errors
	if !success {
		globalRegistry.IncrementCounter("rpc_errors_total", map[string]string{
			"rpc":       rpcName,
			"error_type": errorCode,
		})
	}
}

// RecordMatchMetrics records metrics for a match.
func RecordMatchMetrics(matchType string, event string, value float64) {
	switch event {
	case "created":
		globalRegistry.IncrementCounter("matches_created_total", map[string]string{
			"match_type": matchType,
		})
	case "completed":
		globalRegistry.IncrementCounter("matches_completed_total", map[string]string{
			"match_type": matchType,
			"result":     "completed",
		})
	case "queue_size":
		globalRegistry.SetGauge("match_queue_size", map[string]string{
			"match_type": matchType,
		}, value)
	}
}

// RecordCombatMetrics records metrics for combat actions.
func RecordCombatMetrics(actionType string, result string, damage float64) {
	globalRegistry.IncrementCounter("combat_actions_total", map[string]string{
		"action_type": actionType,
		"result":      result,
	})
	
	if damage > 0 {
		globalRegistry.ObserveHistogram("combat_damage_dealt", map[string]string{}, damage)
	}
}

// RecordPurchaseMetrics records metrics for purchases.
func RecordPurchaseMetrics(productType string, status string, amount float64, currency string) {
	globalRegistry.IncrementCounter("purchases_total", map[string]string{
		"product_type": productType,
		"status":       status,
	})
	
	if status == "success" && amount > 0 {
		globalRegistry.IncrementCounter("purchase_revenue_total", map[string]string{
			"currency":     currency,
			"product_type": productType,
		})
	}
}

// RecordCurrencyMetrics records metrics for currency operations.
func RecordCurrencyMetrics(currencyType string, operation string, amount float64, reason string) {
	if operation == "spent" {
		globalRegistry.IncrementCounter("currency_spent_total", map[string]string{
			"currency_type": currencyType,
			"reason":        reason,
		})
	} else if operation == "earned" {
		globalRegistry.IncrementCounter("currency_earned_total", map[string]string{
			"currency_type": currencyType,
			"source":        reason,
		})
	}
}

// GetProfilingData collects profiling data.
func GetProfilingData() *ProfilingData {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	
	return &ProfilingData{
		Goroutines:  runtime.NumGoroutine(),
		Threads:     0, // Not directly available in Go
		HeapAlloc:   memStats.HeapAlloc,
		HeapSys:     memStats.HeapSys,
		HeapObjects: memStats.HeapObjects,
		GCPauses:    memStats.PauseTotalNs,
		GCDuration:  memStats.GCCPUFraction,
		Timestamp:   time.Now(),
	}
}

// CreateErrorInsight creates an error insight from an error.
func CreateErrorInsight(err error, userID string, context map[string]string) *ErrorInsight {
	now := time.Now().UnixMilli()
	
	return &ErrorInsight{
		ID:        fmt.Sprintf("err_%d", now),
		ErrorType: fmt.Sprintf("%T", err),
		Message:   err.Error(),
		Count:     1,
		FirstSeen: now,
		LastSeen:  now,
		AffectedUsers: []string{userID},
		Context:   context,
		Severity:  "error",
	}
}

// AlertRegistry holds all active alerts.
type AlertRegistry struct {
	alerts map[string]*Alert
	mu     sync.RWMutex
}

// NewAlertRegistry creates a new alert registry.
func NewAlertRegistry() *AlertRegistry {
	return &AlertRegistry{
		alerts: make(map[string]*Alert),
	}
}

// Global alert registry
var globalAlerts = NewAlertRegistry()

// CreateAlert creates a new alert.
func (r *AlertRegistry) CreateAlert(name, severity, message string, value, threshold float64, labels map[string]string) *Alert {
	alert := &Alert{
		ID:        fmt.Sprintf("alert_%d", time.Now().UnixMilli()),
		Name:      name,
		Severity:  severity,
		Status:    "firing",
		Message:   message,
		Value:     value,
		Threshold: threshold,
		Labels:    labels,
		Timestamp: time.Now().UnixMilli(),
	}
	
	r.mu.Lock()
	defer r.mu.Unlock()
	r.alerts[alert.ID] = alert
	
	return alert
}

// ResolveAlert resolves an alert.
func (r *AlertRegistry) ResolveAlert(alertID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	
	if alert, ok := r.alerts[alertID]; ok {
		alert.Status = "resolved"
	}
}

// GetActiveAlerts returns all active (firing) alerts.
func (r *AlertRegistry) GetActiveAlerts() []*Alert {
	r.mu.RLock()
	defer r.mu.RUnlock()
	
	alerts := make([]*Alert, 0)
	for _, a := range r.alerts {
		if a.Status == "firing" {
			alerts = append(alerts, a)
		}
	}
	return alerts
}

// CheckAlertThresholds checks if any metrics exceed alert thresholds.
func CheckAlertThresholds() []*Alert {
	alerts := make([]*Alert, 0)
	
	// Example: Check for high error rate
	// In production, this would query actual metrics
	
	return alerts
}

// JSON serialization helpers

// HealthCheckResultToJSON converts a health check result to JSON.
func HealthCheckResultToJSON(result *HealthCheckResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal health check result: %w", err)
	}
	return string(jsonBytes), nil
}

// MetricsToJSON converts metrics to JSON.
func MetricsToJSON(metrics []*Metric) (string, error) {
	jsonBytes, err := json.Marshal(metrics)
	if err != nil {
		return "", fmt.Errorf("failed to marshal metrics: %w", err)
	}
	return string(jsonBytes), nil
}

// AlertsToJSON converts alerts to JSON.
func AlertsToJSON(alerts []*Alert) (string, error) {
	jsonBytes, err := json.Marshal(alerts)
	if err != nil {
		return "", fmt.Errorf("failed to marshal alerts: %w", err)
	}
	return string(jsonBytes), nil
}

// ErrorInsightsToJSON converts error insights to JSON.
func ErrorInsightsToJSON(insights []*ErrorInsight) (string, error) {
	jsonBytes, err := json.Marshal(insights)
	if err != nil {
		return "", fmt.Errorf("failed to marshal error insights: %w", err)
	}
	return string(jsonBytes), nil
}

// ProfilingDataToJSON converts profiling data to JSON.
func ProfilingDataToJSON(data *ProfilingData) (string, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal profiling data: %w", err)
	}
	return string(jsonBytes), nil
}

// GetSystemInfo returns system information.
func GetSystemInfo() map[string]interface{} {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	return map[string]interface{}{
		"go_version":      runtime.Version(),
		"go_os":           runtime.GOOS,
		"go_arch":         runtime.GOARCH,
		"num_cpu":         runtime.NumCPU(),
		"num_goroutine":   runtime.NumGoroutine(),
		"heap_alloc":      memStats.HeapAlloc,
		"heap_sys":        memStats.HeapSys,
		"heap_objects":    memStats.HeapObjects,
		"gc_pause_total":  memStats.PauseTotalNs,
		"uptime_seconds":  globalRegistry.GetUptime(),
		"timestamp":       time.Now().UnixMilli(),
	}
}

// ============================================================================
// Prometheus Metrics Integration
// ============================================================================
// Integration with backend/metrics/prometheus_metrics.go for Prometheus export

// RecordRPCMetricsWithPrometheus records RPC metrics to both internal registry and Prometheus.
// This function bridges the internal metrics system with Prometheus metrics.
func RecordRPCMetricsWithPrometheus(rpcName string, durationMs int64, success bool, errorCode string) {
	// Record to internal registry (existing behavior)
	RecordRPCMetrics(rpcName, durationMs, success, errorCode)

	// Record to Prometheus metrics
	if success {
		metrics.RecordRPCRequest(rpcName, "rpc")
	} else {
		metrics.RecordRPCError(rpcName, errorCode)
	}
	metrics.RecordRPCDuration(rpcName, time.Duration(durationMs)*time.Millisecond)
}

// RecordMatchMetricsWithPrometheus records match metrics to both internal registry and Prometheus.
func RecordMatchMetricsWithPrometheus(matchType string, event string, value float64) {
	// Record to internal registry (existing behavior)
	RecordMatchMetrics(matchType, event, value)

	// Record to Prometheus metrics
	switch event {
	case "created":
		metrics.RecordMatchCreated(matchType)
	case "completed":
		metrics.RecordMatchCompleted(matchType, "completed")
	case "queue_size":
		metrics.SetMatchmakingQueueSize(value, matchType)
	}
}

// RecordCombatMetricsWithPrometheus records combat metrics to Prometheus.
func RecordCombatMetricsWithPrometheus(actionType string, result string, damage float64) {
	// Record to internal registry (existing behavior)
	RecordCombatMetrics(actionType, result, damage)

	// Record to Prometheus metrics
	metrics.RecordCombatAction(actionType, result)
}

// RecordPurchaseMetricsWithPrometheus records purchase metrics to both internal registry and Prometheus.
func RecordPurchaseMetricsWithPrometheus(productType string, status string, amount float64, currency string) {
	// Record to internal registry (existing behavior)
	RecordPurchaseMetrics(productType, status, amount, currency)

	// Record to Prometheus metrics
	metrics.RecordPurchase(status, currency)
	if status == "success" && amount > 0 {
		metrics.RecordRevenue(amount, currency)
	}
}

// RecordCurrencyMetricsWithPrometheus records currency metrics to Prometheus.
func RecordCurrencyMetricsWithPrometheus(currencyType string, operation string, amount float64, reason string) {
	// Record to internal registry (existing behavior)
	RecordCurrencyMetrics(currencyType, operation, amount, reason)

	// Record to Prometheus metrics
	switch operation {
	case "spent":
		metrics.RecordCurrencySpent(currencyType, reason, amount)
	case "earned":
		metrics.RecordCurrencyEarned(currencyType, reason, amount)
	}
}

// UpdateSystemMetricsWithPrometheus updates system metrics in Prometheus.
func UpdateSystemMetricsWithPrometheus() {
	// Update Prometheus system metrics
	metrics.UpdateSystemMetrics()
}

// SetActivePlayersWithPrometheus sets active player count in both internal registry and Prometheus.
func SetActivePlayersWithPrometheus(count float64, region string) {
	metrics.SetActivePlayers(count, region)
}

// RecordSessionMetricsWithPrometheus records session metrics to Prometheus.
func RecordSessionMetricsWithPrometheus(method string, duration time.Duration) {
	metrics.RecordSessionCreated(method)
	metrics.RecordSessionDuration(duration)
}

// RecordDatabaseMetricsWithPrometheus records database metrics to Prometheus.
func RecordDatabaseMetricsWithPrometheus(endpoint string, database string, duration time.Duration, success bool, errorCode string) {
	metrics.RecordDBQueryDuration(endpoint, database, duration)
	if !success {
		metrics.RecordDBError(endpoint, errorCode)
	}
}

// RecordCacheMetricsWithPrometheus records cache metrics to Prometheus.
func RecordCacheMetricsWithPrometheus(cache string, hit bool, sizeBytes float64) {
	if hit {
		metrics.RecordCacheHit(cache)
	} else {
		metrics.RecordCacheMiss(cache)
	}
	metrics.SetCacheSize(sizeBytes, cache)
}

// RecordGearMetricsWithPrometheus records gear generation metrics to Prometheus.
func RecordGearMetricsWithPrometheus(gearType string, rarity string) {
	metrics.RecordGearGenerated(gearType, rarity)
}

// RecordXPMetricsWithPrometheus records XP gain metrics to Prometheus.
func RecordXPMetricsWithPrometheus(actionType string, amount float64) {
	metrics.RecordXPGained(actionType, amount)
}

// RecordLevelUpMetricsWithPrometheus records level up metrics to Prometheus.
func RecordLevelUpMetricsWithPrometheus(season string) {
	metrics.RecordLevelUp(season)
}

// GetPrometheusMetricsSummary returns a summary of Prometheus metrics.
func GetPrometheusMetricsSummary() string {
	return metrics.GetMetricsSummary()
}

// GetPrometheusCollector returns the Prometheus metrics collector.
func GetPrometheusCollector() *metrics.MetricsCollector {
	return metrics.GetCollector()
}

