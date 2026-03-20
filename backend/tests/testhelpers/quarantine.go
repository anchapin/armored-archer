//go:build !flaky
// +build !flaky

package testhelpers

// QuarantinedTests lists flaky tests to skip in normal CI.
// Implemented in: 06-02-PLAN.md Task 3
var QuarantinedTests = map[string]string{}

// IsQuarantined returns true and the reason if the test is quarantined.
func IsQuarantined(testName string) (bool, string) {
	reason, exists := QuarantinedTests[testName]
	return exists, reason
}
