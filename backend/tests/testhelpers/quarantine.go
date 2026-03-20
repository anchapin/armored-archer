//go:build !flaky
// +build !flaky

package testhelpers

// QuarantinedTests lists flaky tests that should be skipped in normal CI runs.
// Tests are added here via automated flaky detection.
// To run quarantined tests: go test -tags=flaky ./...
//
// Format: "TestName": "Reason quarantined, date, failure rate"
var QuarantinedTests = map[string]string{
	// Example:
	// "TestFlakyCombat": "Intermittent timing issue, quarantined 2026-03-20, failure rate 50%",
}

// IsQuarantined returns true and the reason if the test is quarantined.
func IsQuarantined(testName string) (bool, string) {
	reason, exists := QuarantinedTests[testName]
	return exists, reason
}
