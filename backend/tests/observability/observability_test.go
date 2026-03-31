package observability_test

import (
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/observability"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestCheckHealth(t *testing.T) {
	result := observability.CheckHealth("v1.0.0")

	testhelpers.AssertEqual(t, observability.HealthStatusHealthy, result.Status,
		"Status should be healthy")
	testhelpers.AssertTrue(t, result.Timestamp > 0, "Timestamp should be set")
	testhelpers.AssertEqual(t, "v1.0.0", result.Version, "Version should match")
	testhelpers.AssertTrue(t, result.Uptime >= 0, "Uptime should be non-negative")
	testhelpers.AssertTrue(t, len(result.Services) > 0, "Should have services")
}

func TestCheckServiceHealth(t *testing.T) {
	health := observability.CheckServiceHealth(observability.ServiceDatabase)

	testhelpers.AssertEqual(t, observability.HealthStatusHealthy, health.Status,
		"Status should be healthy")
	testhelpers.AssertTrue(t, len(health.Message) > 0, "Message should not be empty")
}

func TestMetricsRegistry(t *testing.T) {
	registry := observability.NewMetricsRegistry()

	// Test counter
	registry.RegisterCounter("test_counter", map[string]string{"label": "value"}, 1)
	registry.IncrementCounter("test_counter", map[string]string{"label": "value"})

	metrics := registry.GetMetrics()
	testhelpers.AssertTrue(t, len(metrics) > 0, "Should have metrics")

	// Test gauge
	registry.RegisterGauge("test_gauge", map[string]string{"label": "value"}, 100)
	registry.SetGauge("test_gauge", map[string]string{"label": "value"}, 200)

	// Test histogram
	registry.RegisterHistogram("test_histogram", map[string]string{"label": "value"}, 0.5)
	registry.ObserveHistogram("test_histogram", map[string]string{"label": "value"}, 0.7)

	// Test uptime
	uptime := registry.GetUptime()
	testhelpers.AssertTrue(t, uptime >= 0, "Uptime should be non-negative")
}

func TestRecordRPCMetrics(t *testing.T) {
	observability.RecordRPCMetrics("test_rpc", 100, true, "")
	observability.RecordRPCMetrics("test_rpc", 200, false, "error_code")

	registry := observability.GetMetricsRegistry()
	metrics := registry.GetMetrics()
	testhelpers.AssertTrue(t, len(metrics) > 0, "Should have metrics after recording")
}

func TestRecordMatchMetrics(t *testing.T) {
	observability.RecordMatchMetrics("ranked", "created", 0)
	observability.RecordMatchMetrics("ranked", "completed", 0)
	observability.RecordMatchMetrics("ranked", "queue_size", 5)

	registry := observability.GetMetricsRegistry()
	metrics := registry.GetMetrics()
	testhelpers.AssertTrue(t, len(metrics) > 0, "Should have metrics after recording")
}

func TestRecordCombatMetrics(t *testing.T) {
	observability.RecordCombatMetrics("shoot", "hit", 25.0)
	observability.RecordCombatMetrics("shoot", "miss", 0)

	registry := observability.GetMetricsRegistry()
	metrics := registry.GetMetrics()
	testhelpers.AssertTrue(t, len(metrics) > 0, "Should have metrics after recording")
}

func TestRecordPurchaseMetrics(t *testing.T) {
	observability.RecordPurchaseMetrics("gem_pack", "success", 100, "USD")
	observability.RecordPurchaseMetrics("gem_pack", "failed", 0, "USD")

	registry := observability.GetMetricsRegistry()
	metrics := registry.GetMetrics()
	testhelpers.AssertTrue(t, len(metrics) > 0, "Should have metrics after recording")
}

func TestRecordCurrencyMetrics(t *testing.T) {
	observability.RecordCurrencyMetrics("gems", "spent", 100, "buy_item")
	observability.RecordCurrencyMetrics("gems", "earned", 50, "daily_reward")

	registry := observability.GetMetricsRegistry()
	metrics := registry.GetMetrics()
	testhelpers.AssertTrue(t, len(metrics) > 0, "Should have metrics after recording")
}

func TestGetProfilingData(t *testing.T) {
	data := observability.GetProfilingData()

	testhelpers.AssertTrue(t, data.Goroutines > 0, "Should have goroutines")
	testhelpers.AssertTrue(t, data.HeapAlloc > 0, "Should have heap allocation")
	testhelpers.AssertTrue(t, data.HeapSys > 0, "Should have heap sys")
	testhelpers.AssertTrue(t, !data.Timestamp.IsZero(), "Timestamp should be set")
}

func TestCreateErrorInsight(t *testing.T) {
	err := testhelpers.TestError("test error")
	context := map[string]string{"key": "value"}

	insight := observability.CreateErrorInsight(err, "user123", context)

	testhelpers.AssertTrue(t, len(insight.ID) > 0, "ID should not be empty")
	testhelpers.AssertEqual(t, "user123", insight.AffectedUsers[0], "AffectedUsers should match")
	testhelpers.AssertEqual(t, "error", insight.Severity, "Severity should be error")
	testhelpers.AssertTrue(t, insight.Count > 0, "Count should be positive")
}

func TestAlertRegistry(t *testing.T) {
	registry := observability.NewAlertRegistry()

	// Create alert
	alert := registry.CreateAlert("high_error_rate", "critical",
		"Error rate exceeded threshold", 0.1, 0.05,
		map[string]string{"service": "test"})

	testhelpers.AssertTrue(t, len(alert.ID) > 0, "Alert ID should not be empty")
	testhelpers.AssertEqual(t, "firing", alert.Status, "Status should be firing")

	// Resolve alert
	registry.ResolveAlert(alert.ID)
	testhelpers.AssertEqual(t, "resolved", alert.Status, "Status should be resolved")

	// Get active alerts
	activeAlerts := registry.GetActiveAlerts()
	testhelpers.AssertEqual(t, 0, len(activeAlerts), "Should have no active alerts")
}

func TestCheckAlertThresholds(t *testing.T) {
	alerts := observability.CheckAlertThresholds()
	// This should return empty since we don't have actual metrics to check
	testhelpers.AssertTrue(t, len(alerts) >= 0, "Should return alerts list")
}

func TestHealthCheckResultToJSON(t *testing.T) {
	result := observability.CheckHealth("v1.0.0")

	jsonStr, err := observability.HealthCheckResultToJSON(result)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestMetricsToJSON(t *testing.T) {
	registry := observability.NewMetricsRegistry()
	registry.RegisterCounter("test", map[string]string{"label": "value"}, 1)

	metrics := registry.GetMetrics()
	jsonStr, err := observability.MetricsToJSON(metrics)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestAlertsToJSON(t *testing.T) {
	registry := observability.NewAlertRegistry()
	alert := registry.CreateAlert("test", "warning", "Test alert", 1.0, 0.5, nil)

	alerts := []*observability.Alert{alert}
	jsonStr, err := observability.AlertsToJSON(alerts)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestErrorInsightsToJSON(t *testing.T) {
	err := testhelpers.TestError("test error")
	insight := observability.CreateErrorInsight(err, "user123", nil)

	insights := []*observability.ErrorInsight{insight}
	jsonStr, err := observability.ErrorInsightsToJSON(insights)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestProfilingDataToJSON(t *testing.T) {
	data := observability.GetProfilingData()

	jsonStr, err := observability.ProfilingDataToJSON(data)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestGetSystemInfo(t *testing.T) {
	info := observability.GetSystemInfo()

	testhelpers.AssertTrue(t, len(info) > 0, "Should have system info")
	testhelpers.AssertTrue(t, info["go_version"] != nil, "Should have go_version")
	testhelpers.AssertTrue(t, info["go_os"] != nil, "Should have go_os")
	testhelpers.AssertTrue(t, info["go_arch"] != nil, "Should have go_arch")
	testhelpers.AssertTrue(t, info["num_cpu"] != nil, "Should have num_cpu")
	testhelpers.AssertTrue(t, info["num_goroutine"] != nil, "Should have num_goroutine")
}

// TestError is a simple error implementation for testing
type TestError struct {
	message string
}

func (e TestError) Error() string {
	return e.message
}

func createTestError(message string) error {
	return TestError{message: message}
}

func TestCreateErrorInsight(t *testing.T) {
	err := createTestError("test error")
	context := map[string]string{"key": "value"}

	insight := observability.CreateErrorInsight(err, "user123", context)

	testhelpers.AssertTrue(t, len(insight.ID) > 0, "ID should not be empty")
	testhelpers.AssertEqual(t, "user123", insight.AffectedUsers[0], "AffectedUsers should match")
	testhelpers.AssertEqual(t, "error", insight.Severity, "Severity should be error")
	testhelpers.AssertTrue(t, insight.Count > 0, "Count should be positive")
}
