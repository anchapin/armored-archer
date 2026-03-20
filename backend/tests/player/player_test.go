package player_test

import (
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/player"
	"github.com/stretchr/testify/assert"
)

// TestDefaultPlayerStats verifies that DefaultPlayerStats creates a player with correct default values.
// Uses testify assertions for clearer error messages.
func TestDefaultPlayerStats(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")

	assert.Equal(t, "user123", stats.UserID, "UserID should match")
	assert.Equal(t, 1, stats.Level, "Level should be 1")
	assert.Equal(t, 0, stats.XP, "XP should be 0")
	assert.Equal(t, 0, stats.AbilityPoints, "AbilityPoints should be 0")
	assert.Equal(t, 10, stats.Stats.Attack, "Attack should be 10")
	assert.Equal(t, 10, stats.Stats.Defense, "Defense should be 10")
	assert.Equal(t, 10, stats.Stats.Dodge, "Dodge should be 10")
	assert.Equal(t, 5, stats.Stats.CritRate, "CritRate should be 5")
}

// TestXPRequiredForLevel uses table-driven test pattern with testify.
// This pattern is recommended for testing multiple scenarios with clear input/output mapping.
func TestXPRequiredForLevel(t *testing.T) {
	tests := []struct {
		name     string
		level    int
		expected int
	}{
		{"level_1", 1, 100},
		{"level_2", 2, 200},
		{"level_5", 5, 500},
		{"level_10", 10, 1000},
		{"level_50", 50, 5000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := player.XPRequiredForLevel(tt.level)
			assert.Equal(t, tt.expected, result, "XP for level %d", tt.level)
		})
	}
}

// TestGetStatValue uses table-driven test pattern for testing stat retrieval.
// Each test case validates a different stat lookup scenario.
func TestGetStatValue(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Stats.Attack = 15
	stats.Stats.Defense = 20
	stats.Stats.Dodge = 10
	stats.Stats.CritRate = 5

	tests := []struct {
		name     string
		statName string
		expected int
		hasError bool
	}{
		{"attack_stat", "attack", 15, false},
		{"defense_stat", "defense", 20, false},
		{"dodge_stat", "dodge", 10, false},
		{"crit_rate_stat", "crit_rate", 5, false},
		{"invalid_stat", "invalid", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := stats.GetStatValue(tt.statName)

			if tt.hasError {
				assert.Error(t, err, "Should error for "+tt.statName)
			} else {
				assert.NoError(t, err, "Should not error for "+tt.statName)
				assert.Equal(t, tt.expected, value, "Stat value for "+tt.statName)
			}
		})
	}
}

// TestValidate uses table-driven test pattern for validation testing.
// Each test case validates a different validation scenario.
func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		setup   func(*player.PlayerStats)
		isValid bool
	}{
		{
			name:    "valid_stats",
			setup:   func(stats *player.PlayerStats) {},
			isValid: true,
		},
		{
			name: "empty_user_id",
			setup: func(stats *player.PlayerStats) {
				stats.UserID = ""
			},
			isValid: false,
		},
		{
			name: "level_too_low",
			setup: func(stats *player.PlayerStats) {
				stats.Level = 0
			},
			isValid: false,
		},
		{
			name: "negative_xp",
			setup: func(stats *player.PlayerStats) {
				stats.XP = -100
			},
			isValid: false,
		},
		{
			name: "negative_ability_points",
			setup: func(stats *player.PlayerStats) {
				stats.AbilityPoints = -5
			},
			isValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stats := player.DefaultPlayerStats("user123")
			tt.setup(stats)

			err := stats.Validate()

			if tt.isValid {
				assert.NoError(t, err, "Valid stats should pass validation")
			} else {
				assert.Error(t, err, "Should fail validation")
			}
		})
	}
}

// TestToMapAndFromMap verifies serialization and deserialization of player stats.
// Uses testify assertions to verify round-trip data integrity.
func TestToMapAndFromMap(t *testing.T) {
	original := player.DefaultPlayerStats("user123")
	original.Level = 5
	original.XP = 500
	original.AbilityPoints = 12
	original.Stats.Attack = 25
	original.Stats.Defense = 20
	original.Stats.Dodge = 15
	original.Stats.CritRate = 10

	data := original.ToMap()
	restored, err := player.FromMap(data)

	assert.NoError(t, err, "Should restore from map")
	assert.Equal(t, original.UserID, restored.UserID, "UserID should match")
	assert.Equal(t, original.Level, restored.Level, "Level should match")
	assert.Equal(t, original.XP, restored.XP, "XP should match")
	assert.Equal(t, original.Stats.Attack, restored.Stats.Attack, "Attack should match")
}

// TestFromJSON verifies JSON deserialization of player stats.
// Uses testify assertions for clearer error messages.
func TestFromJSON(t *testing.T) {
	jsonStr := `{"user_id":"user123","level":5,"xp":500,"ability_points":12,"stats":{"attack":25,"defense":20,"dodge":15,"crit_rate":10}}`

	stats, err := player.FromJSON(jsonStr)

	assert.NoError(t, err, "Should parse JSON")
	assert.Equal(t, "user123", stats.UserID, "UserID should match")
	assert.Equal(t, 5, stats.Level, "Level should match")
	assert.Equal(t, 25, stats.Stats.Attack, "Attack should match")
}

// TestToJSON verifies JSON serialization of player stats.
// Uses testify assertions to verify JSON output.
func TestToJSON(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Level = 5
	stats.XP = 500

	jsonStr, err := stats.ToJSON()

	assert.NoError(t, err, "Should marshal to JSON")
	assert.True(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := player.FromJSON(jsonStr)
	assert.NoError(t, err, "Should parse generated JSON")
	assert.Equal(t, stats.Level, restored.Level, "Level should match after round-trip")
}

// TestRecordBossDefeated verifies boss defeat counter increment.
// Uses testify assertions for multiple assertions in sequence.
func TestRecordBossDefeated(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")

	assert.Equal(t, 0, stats.BossesDefeated, "Initial bosses defeated should be 0")

	stats.RecordBossDefeated()
	assert.Equal(t, 1, stats.BossesDefeated, "Should increment to 1")

	stats.RecordBossDefeated()
	assert.Equal(t, 2, stats.BossesDefeated, "Should increment to 2")
}

// TestValidatePlayerLevel verifies level validation logic.
// Uses testify assertions for clearer error messages.
func TestValidatePlayerLevel(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Level = 10

	// Test passing validation
	err := player.ValidatePlayerLevel(stats, 5)
	assert.NoError(t, err, "Should pass level 5 requirement")

	// Test failing validation
	err = player.ValidatePlayerLevel(stats, 15)
	assert.Error(t, err, "Should fail level 15 requirement")
}
