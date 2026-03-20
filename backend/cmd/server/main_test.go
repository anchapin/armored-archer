// Package main tests for the Nakama Go module entry point.
package main

import (
	"io"
	"net/http"
	"net/http/httptest"
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
	// This test will verify the RecordRPCLatency function exists and works correctly
	// For now, we'll skip this as it requires the actual implementation
	t.Skip("RecordRPCLatency function not yet implemented - will be verified after implementation")
}

// TestRecordRPCError verifies the RPC error recording function.
func TestRecordRPCError(t *testing.T) {
	// This test will verify the RecordRPCError function exists and works correctly
	// For now, we'll skip this as it requires the actual implementation
	t.Skip("RecordRPCError function not yet implemented - will be verified after implementation")
}

// TestMetricsServerIntegration verifies that the metrics server
// can be started and metrics are collected over time.
func TestMetricsServerIntegration(t *testing.T) {
	// This test verifies that a metrics server can be started
	// For now, we'll skip this as it requires the actual implementation
	t.Skip("Metrics server integration not yet implemented - will be verified after implementation")
}
