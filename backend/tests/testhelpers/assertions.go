// Package testhelpers provides test assertion helpers built on top of testify.
// These helpers provide domain-specific assertions for the Armored Archer game
// while leveraging testify's robust assertion framework.
package testhelpers

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// AssertPlayerLevel asserts that the actual player level matches the expected level.
// Provides a domain-specific error message for player level assertions.
func AssertPlayerLevel(t TestingT, expected, actual int, msgAndArgs ...interface{}) {
	t.Helper()
	assert.Equal(t, expected, actual, append(msgAndArgs, "Player level mismatch")...)
}

// AssertPlayerXP asserts that the actual player XP matches the expected XP.
func AssertPlayerXP(t TestingT, expected, actual int, msgAndArgs ...interface{}) {
	t.Helper()
	assert.Equal(t, expected, actual, append(msgAndArgs, "Player XP mismatch")...)
}

// AssertPlayerStats asserts that the actual player stats map matches the expected stats map.
// This helper validates that all core stats (attack, defense, dodge, crit_rate) match.
func AssertPlayerStats(t TestingT, expected, actual map[string]int, msgAndArgs ...interface{}) {
	t.Helper()
	for key, expectedValue := range expected {
		actualValue, exists := actual[key]
		assert.True(t, exists, append(msgAndArgs, fmt.Sprintf("Stat %s should exist", key))...)
		assert.Equal(t, expectedValue, actualValue, append(msgAndArgs, fmt.Sprintf("Stat %s mismatch", key))...)
	}
}

// AssertGearType asserts that the actual gear type matches the expected gear type.
// Valid gear types are: helm, armor, bow, arrow, amulet.
func AssertGearType(t TestingT, expected, actual string, msgAndArgs ...interface{}) {
	t.Helper()
	validTypes := map[string]bool{
		"helm":   true,
		"armor":  true,
		"bow":    true,
		"arrow":  true,
		"amulet": true,
	}
	assert.True(t, validTypes[expected], append(msgAndArgs, fmt.Sprintf("Invalid expected gear type: %s", expected))...)
	assert.True(t, validTypes[actual], append(msgAndArgs, fmt.Sprintf("Invalid actual gear type: %s", actual))...)
	assert.Equal(t, expected, actual, append(msgAndArgs, "Gear type mismatch")...)
}

// AssertGearRarity asserts that the actual gear rarity matches the expected rarity.
// Valid gear rarities are: common, rare, epic, legendary.
func AssertGearRarity(t TestingT, expected, actual string, msgAndArgs ...interface{}) {
	t.Helper()
	validRarities := map[string]bool{
		"common":    true,
		"rare":      true,
		"epic":      true,
		"legendary": true,
	}
	assert.True(t, validRarities[expected], append(msgAndArgs, fmt.Sprintf("Invalid expected gear rarity: %s", expected))...)
	assert.True(t, validRarities[actual], append(msgAndArgs, fmt.Sprintf("Invalid actual gear rarity: %s", actual))...)
	assert.Equal(t, expected, actual, append(msgAndArgs, "Gear rarity mismatch")...)
}

// AssertMatchStatus asserts that the actual match status matches the expected status.
// Valid match statuses are: active, completed, forfeited.
func AssertMatchStatus(t TestingT, expected, actual string, msgAndArgs ...interface{}) {
	t.Helper()
	validStatuses := map[string]bool{
		"active":    true,
		"completed": true,
		"forfeited": true,
	}
	assert.True(t, validStatuses[expected], append(msgAndArgs, fmt.Sprintf("Invalid expected match status: %s", expected))...)
	assert.True(t, validStatuses[actual], append(msgAndArgs, fmt.Sprintf("Invalid actual match status: %s", actual))...)
	assert.Equal(t, expected, actual, append(msgAndArgs, "Match status mismatch")...)
}

// TestCase represents a single test case for table-driven testing.
type TestCase struct {
	Name     string      // Name of the test case
	Input    interface{} // Input data for the test
	Expected interface{} // Expected result
	HasError bool        // Whether the test expects an error
}

// TestFunc is a function that takes input and returns a result or error.
type TestFunc func(interface{}) (interface{}, error)

// RunTests executes table-driven tests with proper test naming and isolation.
func RunTests(t *testing.T, tests []TestCase, testFunc TestFunc) {
	t.Helper()
	for _, tt := range tests {
		tt := tt
		t.Run(tt.Name, func(t *testing.T) {
			t.Helper()
			result, err := testFunc(tt.Input)

			if tt.HasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.Expected, result)
			}
		})
	}
}

// RequirePlayerLevel asserts that the actual player level matches the expected level.
// Unlike AssertPlayerLevel, this will immediately fail the test and stop execution.
func RequirePlayerLevel(t *testing.T, expected, actual int, msgAndArgs ...interface{}) {
	t.Helper()
	require.Equal(t, expected, actual, append(msgAndArgs, "Player level mismatch")...)
}

// RequireNoError asserts that no error occurred.
// Unlike AssertNoError, this will immediately fail the test and stop execution.
func RequireNoError(t *testing.T, err error, msgAndArgs ...interface{}) {
	t.Helper()
	require.NoError(t, err, msgAndArgs...)
}

// RequireNotNil asserts that a value is not nil.
// Unlike AssertNotNil, this will immediately fail the test and stop execution.
func RequireNotNil(t *testing.T, value interface{}, msgAndArgs ...interface{}) {
	t.Helper()
	require.NotNil(t, value, msgAndArgs...)
}
