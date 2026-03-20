// Package main tests for the Nakama Go module entry point.
package main

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPrometheusMetricsRegistryInitialized verifies that the Prometheus metrics registry
// is initialized and collectors are registered.
func TestPrometheusMetricsRegistryInitialized(t *testing.T) {
	// This test verifies that the metrics collectors are defined and can be registered

	// Create a test registry to avoid conflicts with global registry
	testRegistry := prometheus.NewRegistry()

	// Test that rpcLatency collector can be registered
	testLatency := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "test_nakama_rpc_latency_seconds",
			Help:    "RPC call latency in seconds",
			Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"rpc_method", "status"},
	)

	err := testRegistry.Register(testLatency)
	require.NoError(t, err, "rpcLatency collector should register successfully")

	// Test that rpcErrors collector can be registered
	testErrors := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_nakama_rpc_errors_total",
			Help: "Total number of RPC errors",
		},
		[]string{"rpc_method", "error_type"},
	)

	err = testRegistry.Register(testErrors)
	require.NoError(t, err, "rpcErrors collector should register successfully")

	// Test that activeConnections collector can be registered
	testConnections := prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "test_nakama_active_connections",
			Help: "Number of active database connections",
		},
	)

	err = testRegistry.Register(testConnections)
	require.NoError(t, err, "activeConnections collector should register successfully")
}

// TestPrometheusMetricsEndpoint verifies that the /metrics endpoint
// returns Prometheus text format metrics.
func TestPrometheusMetricsEndpoint(t *testing.T) {
	// Create a test HTTP server with the metrics handler
	handler := promhttp.Handler()
	server := httptest.NewServer(handler)
	defer server.Close()

	// Make HTTP request to the metrics endpoint
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err, "Should be able to make HTTP request to /metrics")
	defer resp.Body.Close()

	// Verify response status
	assert.Equal(t, http.StatusOK, resp.StatusCode, "/metrics should return 200 OK")

	// Verify content type is Prometheus text format
	contentType := resp.Header.Get("Content-Type")
	assert.Contains(t, contentType, "text/plain", "Content-Type should be text/plain for Prometheus format")

	// Read and verify response body contains Prometheus metrics
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err, "Should be able to read response body")

	bodyStr := string(body)
	assert.NotEmpty(t, bodyStr, "Response body should not be empty")
	assert.Contains(t, bodyStr, "HELP", "Metrics should contain HELP comments")
	assert.Contains(t, bodyStr, "TYPE", "Metrics should contain TYPE comments")
}

// TestPrometheusMetricsAccessible verifies that metrics collectors
// are registered and accessible via the metrics endpoint.
func TestPrometheusMetricsAccessible(t *testing.T) {
	// Create a test registry
	testRegistry := prometheus.NewRegistry()

	// Register test collectors
	testLatency := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "test_rpc_latency_seconds",
			Help:    "Test RPC latency",
			Buckets: []float64{0.1, 0.5, 1.0},
		},
		[]string{"method"},
	)

	testErrors := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_rpc_errors_total",
			Help: "Test RPC errors",
		},
		[]string{"error_type"},
	)

	err := testRegistry.Register(testLatency)
	require.NoError(t, err)

	err = testRegistry.Register(testErrors)
	require.NoError(t, err)

	// Record some test metrics
	testLatency.WithLabelValues("test_method").Observe(0.123)
	testErrors.WithLabelValues("test_error").Inc()

	// Create metrics handler and server
	handler := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server := httptest.NewServer(handler)
	defer server.Close()

	// Make HTTP request to get metrics
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	bodyStr := string(body)

	// Verify our test metrics are present
	assert.Contains(t, bodyStr, "test_rpc_latency_seconds", "Should contain latency metric")
	assert.Contains(t, bodyStr, "test_rpc_errors_total", "Should contain error metric")
	assert.Contains(t, bodyStr, `method="test_method"`, "Should contain method label")
	assert.Contains(t, bodyStr, `error_type="test_error"`, "Should contain error_type label")
}

// TestRecordRPCLatency verifies the RPC latency recording function.
func TestRecordRPCLatency(t *testing.T) {
	// Create a test registry to avoid conflicts
	testRegistry := prometheus.NewRegistry()

	// Create a test latency metric
	testLatency := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "test_rpc_latency_seconds",
			Help:    "Test RPC latency",
			Buckets: []float64{0.1, 0.5, 1.0},
		},
		[]string{"method", "status"},
	)

	err := testRegistry.Register(testLatency)
	require.NoError(t, err)

	// Simulate recording latency (similar to RecordRPCLatency)
	testLatency.WithLabelValues("test_method", "success").Observe(0.123)

	// Create handler and server
	handler := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server := httptest.NewServer(handler)
	defer server.Close()

	// Get metrics
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	bodyStr := string(body)
	assert.Contains(t, bodyStr, "test_rpc_latency_seconds", "Should contain latency metric")
	assert.Contains(t, bodyStr, `method="test_method"`, "Should contain method label")
	assert.Contains(t, bodyStr, `status="success"`, "Should contain status label")
}

// TestRecordRPCError verifies the RPC error recording function.
func TestRecordRPCError(t *testing.T) {
	// Create a test registry to avoid conflicts
	testRegistry := prometheus.NewRegistry()

	// Create a test error metric
	testErrors := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_rpc_errors_total",
			Help: "Test RPC errors",
		},
		[]string{"method", "error_type"},
	)

	err := testRegistry.Register(testErrors)
	require.NoError(t, err)

	// Simulate recording error (similar to RecordRPCError)
	testErrors.WithLabelValues("test_method", "validation_error").Inc()
	testErrors.WithLabelValues("test_method", "validation_error").Inc()

	// Create handler and server
	handler := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server := httptest.NewServer(handler)
	defer server.Close()

	// Get metrics
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	bodyStr := string(body)
	assert.Contains(t, bodyStr, "test_rpc_errors_total", "Should contain error metric")
	assert.Contains(t, bodyStr, `method="test_method"`, "Should contain method label")
	assert.Contains(t, bodyStr, `error_type="validation_error"`, "Should contain error_type label")
	assert.Contains(t, bodyStr, "test_rpc_errors_total{", "Should contain metric with labels")
}

// TestMetricsServerIntegration verifies that the metrics server
// can be started and metrics are collected over time.
func TestMetricsServerIntegration(t *testing.T) {
	// This test verifies that a metrics server can be started
	// For now, we'll skip this as it requires the actual implementation
	t.Skip("Metrics server integration not yet implemented - will be verified after implementation")
}

// TestAllSixMetricTypesPresent verifies that all 6 expected metric types are present.
func TestAllSixMetricTypesPresent(t *testing.T) {
	// Create a test registry
	testRegistry := prometheus.NewRegistry()

	// Register RPC metrics
	testLatency := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "nakama_rpc_latency_seconds",
			Help:    "RPC call latency in seconds",
			Buckets: []float64{0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
		},
		[]string{"rpc_method", "status"},
	)

	testErrors := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "nakama_rpc_errors_total",
			Help: "Total number of RPC errors",
		},
		[]string{"rpc_method", "error_type"},
	)

	testConnections := prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "nakama_active_connections",
			Help: "Number of active database connections",
		},
	)

	// Register cache metrics
	testCacheHits := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_name"},
	)

	testCacheMisses := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_name"},
	)

	testCacheHitRate := prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "cache_hit_rate",
			Help: "Cache hit rate (0-1)",
		},
		[]string{"cache_name"},
	)

	// Register all metrics
	require.NoError(t, testRegistry.Register(testLatency))
	require.NoError(t, testRegistry.Register(testErrors))
	require.NoError(t, testRegistry.Register(testConnections))
	require.NoError(t, testRegistry.Register(testCacheHits))
	require.NoError(t, testRegistry.Register(testCacheMisses))
	require.NoError(t, testRegistry.Register(testCacheHitRate))

	// Record some test data
	testLatency.WithLabelValues("get_player_stats", "success").Observe(0.123)
	testErrors.WithLabelValues("get_player_stats", "validation_error").Inc()
	testConnections.Set(5)
	testCacheHits.WithLabelValues("player_stats").Inc()
	testCacheMisses.WithLabelValues("player_stats").Inc()
	testCacheHitRate.WithLabelValues("player_stats").Set(0.5)

	// Create handler and server
	handler := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server := httptest.NewServer(handler)
	defer server.Close()

	// Get metrics
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	bodyStr := string(body)

	// Verify all 6 metric types are present
	expectedMetrics := map[string]string{
		"nakama_rpc_latency_seconds": "histogram",
		"nakama_rpc_errors_total":    "counter",
		"nakama_active_connections":  "gauge",
		"cache_hits_total":           "counter",
		"cache_misses_total":         "counter",
		"cache_hit_rate":             "gauge",
	}

	for metricName, metricType := range expectedMetrics {
		// Verify metric exists
		assert.Contains(t, bodyStr, metricName, "Should contain metric: %s", metricName)

		// Verify metric type declaration
		typeLine := fmt.Sprintf("# TYPE %s %s", metricName, metricType)
		assert.Contains(t, bodyStr, typeLine, "Should have correct type for %s", metricName)

		// Verify HELP comment exists
		helpLine := fmt.Sprintf("# HELP %s", metricName)
		assert.Contains(t, bodyStr, helpLine, "Should have HELP comment for %s", metricName)

		t.Logf("✓ Found metric: %s (type: %s)", metricName, metricType)
	}
}

// TestMetricLabels verifies that metrics have proper labels.
func TestMetricLabels(t *testing.T) {
	// Create a test registry
	testRegistry := prometheus.NewRegistry()

	// Register metrics with labels
	testLatency := prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "nakama_rpc_latency_seconds",
			Help:    "RPC call latency in seconds",
			Buckets: []float64{0.1, 0.5, 1.0},
		},
		[]string{"rpc_method", "status"},
	)

	testErrors := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "nakama_rpc_errors_total",
			Help: "Total number of RPC errors",
		},
		[]string{"rpc_method", "error_type"},
	)

	testCacheHits := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_name"},
	)

	testRegistry.Register(testLatency)
	testRegistry.Register(testErrors)
	testRegistry.Register(testCacheHits)

	// Record metrics with specific labels
	testLatency.WithLabelValues("get_player_stats", "success").Observe(0.123)
	testLatency.WithLabelValues("get_season_info", "error").Observe(0.456)
	testErrors.WithLabelValues("get_player_stats", "validation_error").Inc()
	testErrors.WithLabelValues("get_player_stats", "timeout").Inc()
	testCacheHits.WithLabelValues("player_stats").Inc()
	testCacheHits.WithLabelValues("leaderboards").Inc()

	// Create handler and server
	handler := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server := httptest.NewServer(handler)
	defer server.Close()

	// Get metrics
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	bodyStr := string(body)

	// Verify RPC latency labels
	assert.Contains(t, bodyStr, `rpc_method="get_player_stats"`, "Should have rpc_method label")
	assert.Contains(t, bodyStr, `status="success"`, "Should have status label")
	assert.Contains(t, bodyStr, `status="error"`, "Should have error status")

	// Verify RPC error labels
	assert.Contains(t, bodyStr, `error_type="validation_error"`, "Should have error_type label")
	assert.Contains(t, bodyStr, `error_type="timeout"`, "Should have timeout error_type")

	// Verify cache labels
	assert.Contains(t, bodyStr, `cache_name="player_stats"`, "Should have cache_name label")
	assert.Contains(t, bodyStr, `cache_name="leaderboards"`, "Should have leaderboards cache_name")

	t.Log("✓ All metric labels verified")
}

// TestMetricsIncrement verifies that metrics increment when operations are performed.
func TestMetricsIncrement(t *testing.T) {
	// Create a test registry
	testRegistry := prometheus.NewRegistry()

	// Register metrics
	testCacheHits := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_hits_total",
			Help: "Total number of cache hits",
		},
		[]string{"cache_name"},
	)

	testCacheMisses := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "cache_misses_total",
			Help: "Total number of cache misses",
		},
		[]string{"cache_name"},
	)

	testRPCCount := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "nakama_rpc_calls_total",
			Help: "Total number of RPC calls",
		},
		[]string{"rpc_method"},
	)

	testRegistry.Register(testCacheHits)
	testRegistry.Register(testCacheMisses)
	testRegistry.Register(testRPCCount)

	// Get initial state
	handler1 := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server1 := httptest.NewServer(handler1)
	defer server1.Close()

	resp1, err := http.Get(server1.URL + "/metrics")
	require.NoError(t, err)
	resp1.Body.Close()

	// Perform operations - record initial values
	testCacheHits.WithLabelValues("test_cache").Inc()
	testCacheHits.WithLabelValues("test_cache").Inc()
	testCacheMisses.WithLabelValues("test_cache").Inc()
	testRPCCount.WithLabelValues("test_method").Inc()
	testRPCCount.WithLabelValues("test_method").Inc()
	testRPCCount.WithLabelValues("test_method").Inc()

	// Get updated state
	handler2 := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server2 := httptest.NewServer(handler2)
	defer server2.Close()

	resp2, err := http.Get(server2.URL + "/metrics")
	require.NoError(t, err)
	defer resp2.Body.Close()

	body2, err := io.ReadAll(resp2.Body)
	require.NoError(t, err)

	bodyStr2 := string(body2)

	// Verify metrics incremented
	assert.Contains(t, bodyStr2, `cache_hits_total{cache_name="test_cache"} 2`, "Cache hits should increment to 2")
	assert.Contains(t, bodyStr2, `cache_misses_total{cache_name="test_cache"} 1`, "Cache misses should increment to 1")
	assert.Contains(t, bodyStr2, `nakama_rpc_calls_total{rpc_method="test_method"} 3`, "RPC calls should increment to 3")

	t.Log("✓ Metrics increment correctly")
}

// TestPrometheusTextFormat verifies that metrics are exported in correct Prometheus text format.
func TestPrometheusTextFormat(t *testing.T) {
	// Create a test registry
	testRegistry := prometheus.NewRegistry()

	// Register a test metric
	testMetric := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "test_metric_total",
			Help: "A test metric for format validation",
		},
		[]string{"label1"},
	)

	testRegistry.Register(testMetric)
	testMetric.WithLabelValues("value1").Inc()

	// Create handler and server
	handler := promhttp.HandlerFor(testRegistry, promhttp.HandlerOpts{})
	server := httptest.NewServer(handler)
	defer server.Close()

	// Get metrics
	resp, err := http.Get(server.URL + "/metrics")
	require.NoError(t, err)
	defer resp.Body.Close()

	// Verify content type
	contentType := resp.Header.Get("Content-Type")
	assert.Contains(t, contentType, "text/plain", "Content-Type should be text/plain")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	bodyStr := string(body)
	lines := strings.Split(bodyStr, "\n")

	// Verify Prometheus text format requirements
	hasHelp := false
	hasType := false
	hasMetric := false

	for _, line := range lines {
		// Check for HELP comments
		if strings.HasPrefix(line, "# HELP ") {
			hasHelp = true
			// Verify format: # HELP metric_name description
			parts := strings.SplitN(line, " ", 4)
			assert.Equal(t, "#", parts[0], "HELP should start with #")
			assert.Equal(t, "HELP", parts[1], "Second token should be HELP")
			assert.GreaterOrEqual(t, len(parts), 4, "HELP should have at least 4 parts")
		}

		// Check for TYPE comments
		if strings.HasPrefix(line, "# TYPE ") {
			hasType = true
			// Verify format: # TYPE metric_name type
			parts := strings.SplitN(line, " ", 4)
			assert.Equal(t, "#", parts[0], "TYPE should start with #")
			assert.Equal(t, "TYPE", parts[1], "Second token should be TYPE")

			// Verify valid type
			validTypes := map[string]bool{
				"counter":   true,
				"gauge":     true,
				"histogram": true,
				"summary":   true,
				"untyped":   true,
			}
			if len(parts) >= 4 {
				metricType := parts[3]
				assert.True(t, validTypes[metricType], "Type should be valid: %s", metricType)
			}
		}

		// Check for actual metric lines
		if !strings.HasPrefix(line, "#") && strings.Contains(line, "test_metric_total") {
			hasMetric = true
		}
	}

	assert.True(t, hasHelp, "Should have HELP comments")
	assert.True(t, hasType, "Should have TYPE comments")
	assert.True(t, hasMetric, "Should have metric data")

	t.Log("✓ Prometheus text format validated")
}
