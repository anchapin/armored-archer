package load_test

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestK6ConfigurationValid verifies that k6 configuration files are syntactically valid
func TestK6ConfigurationValid(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
	}{
		{
			name:     "main k6 config",
			filePath: "k6.conf.js",
		},
		{
			name:     "smoke test",
			filePath: "scenarios/smoke.js",
		},
		{
			name:     "player stats test",
			filePath: "scenarios/player_stats.js",
		},
		{
			name:     "leaderboard test",
			filePath: "scenarios/leaderboard.js",
		},
		{
			name:     "mixed workload test",
			filePath: "scenarios/mixed_workload.js",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Check if k6 is installed
			if _, err := exec.LookPath("k6"); err != nil {
				t.Skip("k6 not installed, skipping syntax validation")
			}

			// Get absolute path
			absPath, err := filepath.Abs(tt.filePath)
			require.NoError(t, err, "Failed to get absolute path")

			// Run k6 in dry-run mode to validate syntax
			cmd := exec.Command("k6", "archive", "--dry-run", absPath)
			output, err := cmd.CombinedOutput()

			// k6 archive --dry-run returns non-zero if syntax is invalid
			if err != nil {
				t.Fatalf("k6 configuration validation failed for %s:\n%s\nError: %v", tt.filePath, string(output), err)
			}

			t.Logf("✓ %s is syntactically valid", tt.filePath)
		})
	}
}

// TestK6ThresholdsConfigured verifies that performance thresholds are correctly defined
func TestK6ThresholdsConfigured(t *testing.T) {
	// Read main k6 config file
	data, err := os.ReadFile("k6.conf.js")
	require.NoError(t, err, "Failed to read k6.conf.js")

	content := string(data)

	// Verify thresholds are present
	assert.Contains(t, content, "thresholds:", "thresholds section must be defined")
	assert.Contains(t, content, "rate<0.01", "error rate threshold must be < 1%")
	assert.Contains(t, content, "p(95)<100", "P95 latency threshold must be < 100ms")

	// Verify stages are configured
	assert.Contains(t, content, "stages:", "stages section must be defined")
	assert.Contains(t, content, "target: 500", "must ramp up to 500 users")

	t.Log("✓ All required thresholds are configured correctly")
}

// TestK6StagesDefined verifies that load test stages are properly defined
func TestK6StagesDefined(t *testing.T) {
	data, err := os.ReadFile("k6.conf.js")
	require.NoError(t, err, "Failed to read k6.conf.js")

	content := string(data)

	// Verify ramp-up stages
	assert.Contains(t, content, `{ duration: '1m', target: 50 }`, "must ramp to 50 users")
	assert.Contains(t, content, `{ duration: '2m', target: 200 }`, "must ramp to 200 users")
	assert.Contains(t, content, `{ duration: '3m', target: 500 }`, "must ramp to 500 users")
	assert.Contains(t, content, `{ duration: '5m', target: 500 }`, "must sustain 500 users")
	assert.Contains(t, content, `{ duration: '2m', target: 0 }`, "must ramp down")

	t.Log("✓ Load test stages are properly defined")
}

// TestSmokeTestCanExecute verifies that the smoke test can run successfully
func TestSmokeTestCanExecute(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping smoke test in short mode")
	}

	// Check if k6 is installed
	if _, err := exec.LookPath("k6"); err != nil {
		t.Skip("k6 not installed, skipping smoke test execution")
	}

	// Check if backend is running
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Try to connect to Nakama
	cmd := exec.CommandContext(ctx, "curl", "-f", "http://localhost:7350/")
	if err := cmd.Run(); err != nil {
		t.Skip("Nakama backend not running, skipping smoke test execution")
	}

	// Run smoke test
	absPath, err := filepath.Abs("scenarios/smoke.js")
	require.NoError(t, err)

	cmd = exec.Command("k6", "run", "--no-summary", absPath)
	output, err := cmd.CombinedOutput()

	if err != nil {
		t.Fatalf("Smoke test failed:\n%s\nError: %v", string(output), err)
	}

	// Verify output contains expected success indicator
	outputStr := string(output)
	assert.Contains(t, outputStr, "server is running", "smoke test should verify server is running")

	t.Log("✓ Smoke test executed successfully")
}

// TestLoadTestScenariosExist verifies all required scenario files exist
func TestLoadTestScenariosExist(t *testing.T) {
	requiredScenarios := []string{
		"scenarios/smoke.js",
		"scenarios/player_stats.js",
		"scenarios/leaderboard.js",
		"scenarios/mixed_workload.js",
	}

	for _, scenario := range requiredScenarios {
		t.Run(scenario, func(t *testing.T) {
			if _, err := os.Stat(scenario); os.IsNotExist(err) {
				t.Errorf("Required scenario file missing: %s", scenario)
			} else {
				t.Logf("✓ %s exists", scenario)
			}
		})
	}
}

// TestK6OutputFormat validates that k6 can output JSON summary
func TestK6OutputFormat(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping in short mode")
	}

	if _, err := exec.LookPath("k6"); err != nil {
		t.Skip("k6 not installed")
	}

	// Create a temporary file for output
	tmpFile, err := os.CreateTemp("", "k6-test-output-*.json")
	require.NoError(t, err)
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Run smoke test with JSON output
	absPath, err := filepath.Abs("scenarios/smoke.js")
	require.NoError(t, err)

	cmd := exec.Command("k6", "run", "--summary-export="+tmpFile.Name(), absPath)
	output, err := cmd.CombinedOutput()

	if err != nil {
		t.Fatalf("k6 run failed: %v\nOutput: %s", err, string(output))
	}

	// Parse JSON output
	data, err := os.ReadFile(tmpFile.Name())
	require.NoError(t, err, "Failed to read k6 output file")

	var result map[string]interface{}
	err = json.Unmarshal(data, &result)
	require.NoError(t, err, "Failed to parse k6 JSON output")

	// Verify expected fields exist
	assert.Contains(t, result, "metrics", "k6 output must contain metrics field")

	t.Log("✓ k6 JSON output format is valid")
}

// TestLoadTestHelperFunctions verifies that helper functions are defined
func TestLoadTestHelperFunctions(t *testing.T) {
	data, err := os.ReadFile("k6.conf.js")
	require.NoError(t, err)

	content := string(data)

	// Verify helper functions exist
	assert.Contains(t, content, "function callRpc", "must define callRpc helper")
	assert.Contains(t, content, "function authenticate", "must define authenticate helper")
	assert.Contains(t, content, "export function setup", "must define setup function")
	assert.Contains(t, content, "export function teardown", "must define teardown function")

	t.Log("✓ All required helper functions are defined")
}

// TestCustomMetricsDefined verifies custom metrics are properly defined
func TestCustomMetricsDefined(t *testing.T) {
	data, err := os.ReadFile("k6.conf.js")
	require.NoError(t, err)

	content := string(data)

	// Verify custom metrics
	assert.Contains(t, content, "new Rate('errors')", "must define error rate metric")
	assert.Contains(t, content, "new Trend('rpc_latency')", "must define RPC latency metric")

	t.Log("✓ Custom metrics are properly defined")
}

// TestRPCScenariosCovered verifies all hot-path RPCs are tested
func TestRPCScenariosCovered(t *testing.T) {
	data, err := os.ReadFile("k6.conf.js")
	require.NoError(t, err)

	content := string(data)

	// Verify all hot-path RPCs are called
	requiredRPCs := []string{
		"get_player_stats",
		"get_season_info",
		"get_leaderboard",
		"submit_feedback",
	}

	for _, rpc := range requiredRPCs {
		found := strings.Contains(content, rpc)
		assert.True(t, found, "k6 config must test RPC: %s", rpc)
	}

	t.Log("✓ All hot-path RPCs are covered in load tests")
}

// TestReadmeDocumentationExists verifies README.md exists and contains required sections
func TestReadmeDocumentationExists(t *testing.T) {
	data, err := os.ReadFile("README.md")
	require.NoError(t, err, "README.md must exist")

	content := string(data)

	// Verify required sections
	requiredSections := []string{
		"Prerequisites",
		"Running Tests",
		"Metrics",
	}

	for _, section := range requiredSections {
		assert.Contains(t, content, section, "README must contain section: %s", section)
	}

	t.Log("✓ README.md documentation is complete")
}

// TestLoadTestConfigurationNotHardcoded verifies configuration uses environment variables
func TestLoadTestConfigurationNotHardcoded(t *testing.T) {
	data, err := os.ReadFile("k6.conf.js")
	require.NoError(t, err)

	content := string(data)

	// Verify environment variable usage
	assert.Contains(t, content, "__ENV.NAKAMA_URL", "must use NAKAMA_URL environment variable")

	t.Log("✓ Configuration uses environment variables")
}

// BenchmarkK6Startup measures how fast k6 can start (useful for CI optimization)
func BenchmarkK6Startup(b *testing.B) {
	if _, err := exec.LookPath("k6"); err != nil {
		b.Skip("k6 not installed")
	}

	absPath, err := filepath.Abs("scenarios/smoke.js")
	require.NoError(b, err)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cmd := exec.Command("k6", "archive", "--dry-run", absPath)
		if err := cmd.Run(); err != nil {
			b.Fatalf("k6 dry-run failed: %v", err)
		}
	}
}
