// Package metrics provides Prometheus metrics collection for the Armored Archer backend.
// This package defines and manages all custom metrics exposed to Prometheus.
package metrics

import (
	"fmt"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Metric label names
const (
	LabelRPCName      = "rpc_name"
	LabelErrorCode    = "error_code"
	LabelEndpoint     = "endpoint"
	LabelMatchType    = "match_type"
	LabelActionType   = "action_type"
	LabelCurrencyType = "currency_type"
	LabelGearType     = "gear_type"
	LabelGearRarity   = "gear_rarity"
	LabelStatus       = "status"
	LabelMethod       = "method"
	LabelCache        = "cache"
	LabelDatabase     = "database"
	LabelPlayerID     = "player_id"
	LabelSeason       = "season"
	LabelRegion       = "region"
)

// MetricsCollector holds all Prometheus metrics collectors.
type MetricsCollector struct {
	// RPC Metrics
	rpcRequestsTotal   *prometheus.CounterVec
	rpcErrorsTotal     *prometheus.CounterVec
	rpcRequestDuration *prometheus.HistogramVec

	// Player Metrics
	activePlayers    *prometheus.GaugeVec
	sessionsCreated  *prometheus.CounterVec
	sessionsDuration *prometheus.HistogramVec

	// Match Metrics
	matchesCreated    *prometheus.CounterVec
	matchesCompleted  *prometheus.CounterVec
	matchmakingQueue  *prometheus.GaugeVec
	matchDuration     *prometheus.HistogramVec

	// Database Metrics
	dbQueryDuration *prometheus.HistogramVec
	dbConnections   *prometheus.GaugeVec
	dbErrorsTotal   *prometheus.CounterVec

	// Cache Metrics
	cacheHitsTotal   *prometheus.CounterVec
	cacheMissesTotal *prometheus.CounterVec
	cacheSize        *prometheus.GaugeVec

	// System Metrics
	memoryUsage    *prometheus.GaugeVec
	cpuUsage       *prometheus.GaugeVec
	goroutineCount *prometheus.GaugeVec
	requestQueue   *prometheus.GaugeVec

	// Business Metrics
	purchasesTotal    *prometheus.CounterVec
	revenueTotal      *prometheus.CounterVec
	currencySpent     *prometheus.CounterVec
	currencyEarned    *prometheus.CounterVec
	gearGenerated     *prometheus.CounterVec
	combatActions     *prometheus.CounterVec
	xpGained          *prometheus.CounterVec
	levelUps          *prometheus.CounterVec

	// Error Rate Tracking
	errorRate *prometheus.GaugeVec

	registry *prometheus.Registry
	mu       sync.RWMutex
	startTime time.Time
}

// Global metrics collector instance
var globalCollector *MetricsCollector
var once sync.Once

// GetCollector returns the global metrics collector instance.
func GetCollector() *MetricsCollector {
	once.Do(func() {
		globalCollector = NewMetricsCollector()
	})
	return globalCollector
}

// NewMetricsCollector creates and registers all Prometheus metrics.
func NewMetricsCollector() *MetricsCollector {
	mc := &MetricsCollector{
		startTime: time.Now(),
		registry:  prometheus.NewRegistry(),
	}

	// Initialize RPC metrics
	mc.rpcRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "rpc_requests_total",
			Help:      "Total number of RPC requests",
			Namespace: "armored_archer",
		},
		[]string{LabelRPCName, LabelMethod},
	)

	mc.rpcErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "rpc_errors_total",
			Help:      "Total number of RPC errors",
			Namespace: "armored_archer",
		},
		[]string{LabelRPCName, LabelErrorCode},
	)

	mc.rpcRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:      "rpc_request_duration_seconds",
			Help:      "RPC request duration in seconds",
			Namespace: "armored_archer",
			Buckets:   prometheus.DefBuckets,
		},
		[]string{LabelRPCName},
	)

	// Initialize player metrics
	mc.activePlayers = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "active_players",
			Help:      "Number of currently active players",
			Namespace: "armored_archer",
		},
		[]string{LabelRegion},
	)

	mc.sessionsCreated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "sessions_created_total",
			Help:      "Total number of player sessions created",
			Namespace: "armored_archer",
		},
		[]string{LabelMethod},
	)

	mc.sessionsDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:      "session_duration_seconds",
			Help:      "Player session duration in seconds",
			Namespace: "armored_archer",
			Buckets:   []float64{10, 30, 60, 300, 600, 1800, 3600, 7200, 14400},
		},
		[]string{},
	)

	// Initialize match metrics
	mc.matchesCreated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "matches_created_total",
			Help:      "Total number of matches created",
			Namespace: "armored_archer",
		},
		[]string{LabelMatchType},
	)

	mc.matchesCompleted = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "matches_completed_total",
			Help:      "Total number of matches completed",
			Namespace: "armored_archer",
		},
		[]string{LabelMatchType, LabelStatus},
	)

	mc.matchmakingQueue = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "matchmaking_queue_size",
			Help:      "Current size of matchmaking queue",
			Namespace: "armored_archer",
		},
		[]string{LabelMatchType},
	)

	mc.matchDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:      "match_duration_seconds",
			Help:      "Match duration in seconds",
			Namespace: "armored_archer",
			Buckets:   []float64{30, 60, 120, 300, 600, 900, 1200, 1800, 3600},
		},
		[]string{LabelMatchType},
	)

	// Initialize database metrics
	mc.dbQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:      "database_query_duration_seconds",
			Help:      "Database query duration in seconds",
			Namespace: "armored_archer",
			Buckets:   []float64{0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0},
		},
		[]string{LabelEndpoint, LabelDatabase},
	)

	mc.dbConnections = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "database_connections",
			Help:      "Current number of database connections",
			Namespace: "armored_archer",
		},
		[]string{LabelDatabase, LabelStatus},
	)

	mc.dbErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "database_errors_total",
			Help:      "Total number of database errors",
			Namespace: "armored_archer",
		},
		[]string{LabelEndpoint, LabelErrorCode},
	)

	// Initialize cache metrics
	mc.cacheHitsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "cache_hits_total",
			Help:      "Total number of cache hits",
			Namespace: "armored_archer",
		},
		[]string{LabelCache},
	)

	mc.cacheMissesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "cache_misses_total",
			Help:      "Total number of cache misses",
			Namespace: "armored_archer",
		},
		[]string{LabelCache},
	)

	mc.cacheSize = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "cache_size_bytes",
			Help:      "Current cache size in bytes",
			Namespace: "armored_archer",
		},
		[]string{LabelCache},
	)

	// Initialize system metrics
	mc.memoryUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "memory_usage_bytes",
			Help:      "Current memory usage in bytes",
			Namespace: "armored_archer",
		},
		[]string{},
	)

	mc.cpuUsage = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "cpu_usage_percent",
			Help:      "Current CPU usage percentage",
			Namespace: "armored_archer",
		},
		[]string{},
	)

	mc.goroutineCount = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "goroutine_count",
			Help:      "Current number of goroutines",
			Namespace: "armored_archer",
		},
		[]string{},
	)

	mc.requestQueue = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "request_queue_depth",
			Help:      "Current request queue depth",
			Namespace: "armored_archer",
		},
		[]string{LabelEndpoint},
	)

	// Initialize business metrics
	mc.purchasesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "purchases_total",
			Help:      "Total number of purchases",
			Namespace: "armored_archer",
		},
		[]string{LabelStatus, LabelCurrencyType},
	)

	mc.revenueTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "revenue_cents_total",
			Help:      "Total revenue in cents",
			Namespace: "armored_archer",
		},
		[]string{LabelCurrencyType},
	)

	mc.currencySpent = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "currency_spent_total",
			Help:      "Total currency spent",
			Namespace: "armored_archer",
		},
		[]string{LabelCurrencyType, LabelActionType},
	)

	mc.currencyEarned = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "currency_earned_total",
			Help:      "Total currency earned",
			Namespace: "armored_archer",
		},
		[]string{LabelCurrencyType, LabelActionType},
	)

	mc.gearGenerated = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "gear_generated_total",
			Help:      "Total gear items generated",
			Namespace: "armored_archer",
		},
		[]string{LabelGearType, LabelGearRarity},
	)

	mc.combatActions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "combat_actions_total",
			Help:      "Total combat actions performed",
			Namespace: "armored_archer",
		},
		[]string{LabelActionType, LabelStatus},
	)

	mc.xpGained = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "xp_gained_total",
			Help:      "Total XP gained by players",
			Namespace: "armored_archer",
		},
		[]string{LabelActionType},
	)

	mc.levelUps = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name:      "level_ups_total",
			Help:      "Total player level ups",
			Namespace: "armored_archer",
		},
		[]string{LabelSeason},
	)

	// Initialize error rate gauge
	mc.errorRate = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name:      "error_rate_percent",
			Help:      "Current error rate percentage",
			Namespace: "armored_archer",
		},
		[]string{LabelRPCName},
	)

	// Register all metrics
	mc.MustRegister(
		mc.rpcRequestsTotal,
		mc.rpcErrorsTotal,
		mc.rpcRequestDuration,
		mc.activePlayers,
		mc.sessionsCreated,
		mc.sessionsDuration,
		mc.matchesCreated,
		mc.matchesCompleted,
		mc.matchmakingQueue,
		mc.matchDuration,
		mc.dbQueryDuration,
		mc.dbConnections,
		mc.dbErrorsTotal,
		mc.cacheHitsTotal,
		mc.cacheMissesTotal,
		mc.cacheSize,
		mc.memoryUsage,
		mc.cpuUsage,
		mc.goroutineCount,
		mc.requestQueue,
		mc.purchasesTotal,
		mc.revenueTotal,
		mc.currencySpent,
		mc.currencyEarned,
		mc.gearGenerated,
		mc.combatActions,
		mc.xpGained,
		mc.levelUps,
		mc.errorRate,
	)

	return mc
}

// MustRegister registers metrics with panic on error.
func (mc *MetricsCollector) MustRegister(collectors ...prometheus.Collector) {
	mc.registry.MustRegister(collectors...)
}

// Registry returns the Prometheus registry.
func (mc *MetricsCollector) Registry() *prometheus.Registry {
	return mc.registry
}

// ============================================================================
// RPC Metrics
// ============================================================================

// RecordRPCRequest records an RPC request.
func (mc *MetricsCollector) RecordRPCRequest(rpcName, method string) {
	mc.rpcRequestsTotal.WithLabelValues(rpcName, method).Inc()
}

// RecordRPCError records an RPC error.
func (mc *MetricsCollector) RecordRPCError(rpcName, errorCode string) {
	mc.rpcErrorsTotal.WithLabelValues(rpcName, errorCode).Inc()
}

// RecordRPCDuration records RPC request duration.
func (mc *MetricsCollector) RecordRPCDuration(rpcName string, duration time.Duration) {
	mc.rpcRequestDuration.WithLabelValues(rpcName).Observe(duration.Seconds())
}

// ObserveRPCDuration is a helper to time RPC calls.
func (mc *MetricsCollector) ObserveRPCDuration(rpcName string) *RPCTimer {
	return &RPCTimer{
		collector: mc,
		rpcName:   rpcName,
		start:     time.Now(),
	}
}

// RPCTimer tracks RPC call duration.
type RPCTimer struct {
	collector *MetricsCollector
	rpcName   string
	start     time.Time
}

// Stop records the duration.
func (rt *RPCTimer) Stop() {
	rt.collector.RecordRPCDuration(rt.rpcName, time.Since(rt.start))
}

// ============================================================================
// Player Metrics
// ============================================================================

// SetActivePlayers sets the number of active players.
func (mc *MetricsCollector) SetActivePlayers(count float64, region string) {
	mc.activePlayers.WithLabelValues(region).Set(count)
}

// RecordSessionCreated records a new player session.
func (mc *MetricsCollector) RecordSessionCreated(method string) {
	mc.sessionsCreated.WithLabelValues(method).Inc()
}

// RecordSessionDuration records a player session duration.
func (mc *MetricsCollector) RecordSessionDuration(duration time.Duration) {
	mc.sessionsDuration.WithLabelValues().Observe(duration.Seconds())
}

// ============================================================================
// Match Metrics
// ============================================================================

// RecordMatchCreated records a match creation.
func (mc *MetricsCollector) RecordMatchCreated(matchType string) {
	mc.matchesCreated.WithLabelValues(matchType).Inc()
}

// RecordMatchCompleted records a match completion.
func (mc *MetricsCollector) RecordMatchCompleted(matchType, status string) {
	mc.matchesCompleted.WithLabelValues(matchType, status).Inc()
}

// SetMatchmakingQueueSize sets the matchmaking queue size.
func (mc *MetricsCollector) SetMatchmakingQueueSize(size float64, matchType string) {
	mc.matchmakingQueue.WithLabelValues(matchType).Set(size)
}

// RecordMatchDuration records match duration.
func (mc *MetricsCollector) RecordMatchDuration(matchType string, duration time.Duration) {
	mc.matchDuration.WithLabelValues(matchType).Observe(duration.Seconds())
}

// ============================================================================
// Database Metrics
// ============================================================================

// RecordDBQueryDuration records database query duration.
func (mc *MetricsCollector) RecordDBQueryDuration(endpoint, database string, duration time.Duration) {
	mc.dbQueryDuration.WithLabelValues(endpoint, database).Observe(duration.Seconds())
}

// SetDBConnections sets database connection count.
func (mc *MetricsCollector) SetDBConnections(count float64, database, status string) {
	mc.dbConnections.WithLabelValues(database, status).Set(count)
}

// RecordDBError records a database error.
func (mc *MetricsCollector) RecordDBError(endpoint, errorCode string) {
	mc.dbErrorsTotal.WithLabelValues(endpoint, errorCode).Inc()
}

// ObserveDBQueryDuration is a helper to time database queries.
func (mc *MetricsCollector) ObserveDBQueryDuration(endpoint, database string) *DBTimer {
	return &DBTimer{
		collector:  mc,
		endpoint:   endpoint,
		database:   database,
		start:      time.Now(),
	}
}

// DBTimer tracks database query duration.
type DBTimer struct {
	collector *MetricsCollector
	endpoint  string
	database  string
	start     time.Time
}

// Stop records the duration.
func (dt *DBTimer) Stop() {
	dt.collector.RecordDBQueryDuration(dt.endpoint, dt.database, time.Since(dt.start))
}

// ============================================================================
// Cache Metrics
// ============================================================================

// RecordCacheHit records a cache hit.
func (mc *MetricsCollector) RecordCacheHit(cache string) {
	mc.cacheHitsTotal.WithLabelValues(cache).Inc()
}

// RecordCacheMiss records a cache miss.
func (mc *MetricsCollector) RecordCacheMiss(cache string) {
	mc.cacheMissesTotal.WithLabelValues(cache).Inc()
}

// SetCacheSize sets cache size.
func (mc *MetricsCollector) SetCacheSize(sizeBytes float64, cache string) {
	mc.cacheSize.WithLabelValues(cache).Set(sizeBytes)
}

// GetCacheHitRatio calculates cache hit ratio.
func (mc *MetricsCollector) GetCacheHitRatio(cache string) float64 {
	// This would need to track totals, simplified for now
	return 0.0
}

// ============================================================================
// System Metrics
// ============================================================================

// UpdateSystemMetrics updates all system metrics.
func (mc *MetricsCollector) UpdateSystemMetrics() {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	mc.memoryUsage.WithLabelValues().Set(float64(memStats.Alloc))
	mc.goroutineCount.WithLabelValues().Set(float64(runtime.NumGoroutine()))
	
	// CPU usage would need external tracking or cgroup info
	// This is a placeholder
	mc.cpuUsage.WithLabelValues().Set(0.0)
}

// SetRequestQueueDepth sets request queue depth.
func (mc *MetricsCollector) SetRequestQueueDepth(depth float64, endpoint string) {
	mc.requestQueue.WithLabelValues(endpoint).Set(depth)
}

// GetUptime returns the collector uptime in seconds.
func (mc *MetricsCollector) GetUptime() float64 {
	return time.Since(mc.startTime).Seconds()
}

// ============================================================================
// Business Metrics
// ============================================================================

// RecordPurchase records a purchase.
func (mc *MetricsCollector) RecordPurchase(status, currencyType string) {
	mc.purchasesTotal.WithLabelValues(status, currencyType).Inc()
}

// RecordRevenue records revenue.
func (mc *MetricsCollector) RecordRevenue(amountCents float64, currencyType string) {
	mc.revenueTotal.WithLabelValues(currencyType).Add(amountCents)
}

// RecordCurrencySpent records currency spent.
func (mc *MetricsCollector) RecordCurrencySpent(currencyType, actionType string, amount float64) {
	mc.currencySpent.WithLabelValues(currencyType, actionType).Add(amount)
}

// RecordCurrencyEarned records currency earned.
func (mc *MetricsCollector) RecordCurrencyEarned(currencyType, actionType string, amount float64) {
	mc.currencyEarned.WithLabelValues(currencyType, actionType).Add(amount)
}

// RecordGearGenerated records gear generation.
func (mc *MetricsCollector) RecordGearGenerated(gearType, rarity string) {
	mc.gearGenerated.WithLabelValues(gearType, rarity).Inc()
}

// RecordCombatAction records a combat action.
func (mc *MetricsCollector) RecordCombatAction(actionType, status string) {
	mc.combatActions.WithLabelValues(actionType, status).Inc()
}

// RecordXPGained records XP gained.
func (mc *MetricsCollector) RecordXPGained(actionType string, amount float64) {
	mc.xpGained.WithLabelValues(actionType).Add(amount)
}

// RecordLevelUp records a player level up.
func (mc *MetricsCollector) RecordLevelUp(season string) {
	mc.levelUps.WithLabelValues(season).Inc()
}

// ============================================================================
// Error Rate Metrics
// ============================================================================

// SetErrorRate sets the error rate for an RPC endpoint.
func (mc *MetricsCollector) SetErrorRate(rate float64, rpcName string) {
	mc.errorRate.WithLabelValues(rpcName).Set(rate)
}

// ============================================================================
// Global Convenience Functions
// ============================================================================

// RecordRPCRequest records an RPC request using the global collector.
func RecordRPCRequest(rpcName, method string) {
	GetCollector().RecordRPCRequest(rpcName, method)
}

// RecordRPCError records an RPC error using the global collector.
func RecordRPCError(rpcName, errorCode string) {
	GetCollector().RecordRPCError(rpcName, errorCode)
}

// RecordRPCDuration records RPC duration using the global collector.
func RecordRPCDuration(rpcName string, duration time.Duration) {
	GetCollector().RecordRPCDuration(rpcName, duration)
}

// ObserveRPCDuration creates a timer for RPC calls.
func ObserveRPCDuration(rpcName string) *RPCTimer {
	return GetCollector().ObserveRPCDuration(rpcName)
}

// SetActivePlayers sets active players using the global collector.
func SetActivePlayers(count float64, region string) {
	GetCollector().SetActivePlayers(count, region)
}

// RecordMatchCreated records a match creation using the global collector.
func RecordMatchCreated(matchType string) {
	GetCollector().RecordMatchCreated(matchType)
}

// RecordMatchCompleted records a match completion using the global collector.
func RecordMatchCompleted(matchType, status string) {
	GetCollector().RecordMatchCompleted(matchType, status)
}

// SetMatchmakingQueueSize sets matchmaking queue size using the global collector.
func SetMatchmakingQueueSize(size float64, matchType string) {
	GetCollector().SetMatchmakingQueueSize(size, matchType)
}

// RecordDBQueryDuration records database query duration using the global collector.
func RecordDBQueryDuration(endpoint, database string, duration time.Duration) {
	GetCollector().RecordDBQueryDuration(endpoint, database, duration)
}

// ObserveDBQueryDuration creates a timer for database queries.
func ObserveDBQueryDuration(endpoint, database string) *DBTimer {
	return GetCollector().ObserveDBQueryDuration(endpoint, database)
}

// RecordCacheHit records a cache hit using the global collector.
func RecordCacheHit(cache string) {
	GetCollector().RecordCacheHit(cache)
}

// RecordCacheMiss records a cache miss using the global collector.
func RecordCacheMiss(cache string) {
	GetCollector().RecordCacheMiss(cache)
}

// UpdateSystemMetrics updates system metrics using the global collector.
func UpdateSystemMetrics() {
	GetCollector().UpdateSystemMetrics()
}

// RecordPurchase records a purchase using the global collector.
func RecordPurchase(status, currencyType string) {
	GetCollector().RecordPurchase(status, currencyType)
}

// RecordRevenue records revenue using the global collector.
func RecordRevenue(amountCents float64, currencyType string) {
	GetCollector().RecordRevenue(amountCents, currencyType)
}

// RecordGearGenerated records gear generation using the global collector.
func RecordGearGenerated(gearType, rarity string) {
	GetCollector().RecordGearGenerated(gearType, rarity)
}

// RecordXPGained records XP gained using the global collector.
func RecordXPGained(actionType string, amount float64) {
	GetCollector().RecordXPGained(actionType, amount)
}

// RecordLevelUp records a level up using the global collector.
func RecordLevelUp(season string) {
	GetCollector().RecordLevelUp(season)
}

// RecordCombatAction records a combat action using the global collector.
func RecordCombatAction(actionType, status string) {
	GetCollector().RecordCombatAction(actionType, status)
}

// RecordCurrencySpent records currency spent using the global collector.
func RecordCurrencySpent(currencyType, actionType string, amount float64) {
	GetCollector().RecordCurrencySpent(currencyType, actionType, amount)
}

// RecordCurrencyEarned records currency earned using the global collector.
func RecordCurrencyEarned(currencyType, actionType string, amount float64) {
	GetCollector().RecordCurrencyEarned(currencyType, actionType, amount)
}

// RecordSessionCreated records a session creation using the global collector.
func RecordSessionCreated(method string) {
	GetCollector().RecordSessionCreated(method)
}

// RecordSessionDuration records a session duration using the global collector.
func RecordSessionDuration(duration time.Duration) {
	GetCollector().RecordSessionDuration(duration)
}

// RecordDBError records a database error using the global collector.
func RecordDBError(endpoint, errorCode string) {
	GetCollector().RecordDBError(endpoint, errorCode)
}

// SetCacheSize sets cache size using the global collector.
func SetCacheSize(sizeBytes float64, cache string) {
	GetCollector().SetCacheSize(sizeBytes, cache)
}

// MetricsEndpoint returns the Prometheus metrics endpoint path.
func MetricsEndpoint() string {
	return "/metrics"
}

// FormatPrometheusLabel formats a string for use as a Prometheus label.
func FormatPrometheusLabel(s string) string {
	// Replace invalid characters with underscores
	s = strings.ReplaceAll(s, "-", "_")
	s = strings.ReplaceAll(s, " ", "_")
	s = strings.ReplaceAll(s, ".", "_")
	s = strings.ToLower(s)
	return s
}

// ValidateLabelValue validates a Prometheus label value.
func ValidateLabelValue(s string) string {
	// Prometheus label values can contain any characters, but we sanitize for safety
	s = strings.ReplaceAll(s, "\"", "\\\"")
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.ReplaceAll(s, "\r", " ")
	return s
}

// GetMetricsSummary returns a summary of all registered metrics.
func GetMetricsSummary() string {
	mc := GetCollector()
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	var sb strings.Builder
	sb.WriteString("Armored Archer Metrics Summary\n")
	sb.WriteString("==============================\n\n")
	sb.WriteString(fmt.Sprintf("Uptime: %.2f seconds\n", mc.GetUptime()))
	sb.WriteString("\nMetric Categories:\n")
	sb.WriteString("- RPC Metrics (3): requests, errors, duration\n")
	sb.WriteString("- Player Metrics (3): active players, sessions, duration\n")
	sb.WriteString("- Match Metrics (4): created, completed, queue, duration\n")
	sb.WriteString("- Database Metrics (3): query duration, connections, errors\n")
	sb.WriteString("- Cache Metrics (3): hits, misses, size\n")
	sb.WriteString("- System Metrics (4): memory, CPU, goroutines, queue\n")
	sb.WriteString("- Business Metrics (8): purchases, revenue, currency, gear, combat, XP, levels\n")
	sb.WriteString("- Error Rate Metrics (1): error rate by endpoint\n")
	sb.WriteString("\nTotal: 27 metric types\n")

	return sb.String()
}
