package player_test

import (
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/player"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestDefaultPlayerStats(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")

	testhelpers.AssertEqual(t, "user123", stats.UserID, "UserID should match")
	testhelpers.AssertEqual(t, 1, stats.Level, "Level should be 1")
	testhelpers.AssertEqual(t, 0, stats.XP, "XP should be 0")
	testhelpers.AssertEqual(t, 0, stats.AbilityPoints, "AbilityPoints should be 0")
	testhelpers.AssertEqual(t, 10, stats.Stats.Attack, "Attack should be 10")
	testhelpers.AssertEqual(t, 10, stats.Stats.Defense, "Defense should be 10")
	testhelpers.AssertEqual(t, 10, stats.Stats.Dodge, "Dodge should be 10")
	testhelpers.AssertEqual(t, 5, stats.Stats.CritRate, "CritRate should be 5")
}

func TestXPRequiredForLevel(t *testing.T) {
	tests := []struct {
		level    int
		expected int
	}{
		{1, 100},
		{2, 200},
		{5, 500},
		{10, 1000},
		{50, 5000},
	}

	for _, tt := range tests {
		result := player.XPRequiredForLevel(tt.level)
		testhelpers.AssertEqual(t, tt.expected, result,
			tt.name(t, "XP for level %d", tt.level))
	}
}

func TestAddXP(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")

	// Test small XP gain (no level up)
	levelUp, newXp := stats.AddXP(50, "pve")
	testhelpers.AssertFalse(t, levelUp, "Should not level up with 50 XP")
	testhelpers.AssertEqual(t, 50, newXp, "XP should be 50")
	testhelpers.AssertEqual(t, 1, stats.Level, "Level should still be 1")

	// Test XP gain that causes level up
	levelUp, newXp = stats.AddXP(100, "pve")
	testhelpers.AssertTrue(t, levelUp, "Should level up with 100 XP")
	testhelpers.AssertEqual(t, 50, newXp, "Remaining XP should be 50")
	testhelpers.AssertEqual(t, 2, stats.Level, "Level should be 2")
	testhelpers.AssertEqual(t, 3, stats.AbilityPoints, "Should gain 3 ability points")

	// Test multiple level ups
	stats.XP = 0
	stats.Level = 1
	stats.AbilityPoints = 0
	levelUp, newXp = stats.AddXP(350, "pvp")
	testhelpers.AssertTrue(t, levelUp, "Should level up")
	testhelpers.AssertEqual(t, 3, stats.Level, "Should be level 3")
	testhelpers.AssertEqual(t, 6, stats.AbilityPoints, "Should have 6 ability points")
}

func TestAllocateStat(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.AbilityPoints = 10

	// Test valid allocation
	err := stats.AllocateStat("attack", 5)
	testhelpers.AssertNoError(t, err, "Should allocate attack points")
	testhelpers.AssertEqual(t, 15, stats.Stats.Attack, "Attack should be 15")
	testhelpers.AssertEqual(t, 5, stats.AbilityPoints, "Should have 5 points left")

	// Test insufficient points
	err = stats.AllocateStat("defense", 10)
	testhelpers.AssertError(t, err, "Should fail with insufficient points")

	// Test invalid stat name
	err = stats.AllocateStat("invalid", 1)
	testhelpers.AssertError(t, err, "Should fail with invalid stat name")

	// Test negative points
	err = stats.AllocateStat("attack", -1)
	testhelpers.AssertError(t, err, "Should fail with negative points")
}

func TestGetStatValue(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Stats.Attack = 15
	stats.Stats.Defense = 20
	stats.Stats.Dodge = 10
	stats.Stats.CritRate = 5

	tests := []struct {
		statName string
		expected int
		hasError bool
	}{
		{"attack", 15, false},
		{"defense", 20, false},
		{"dodge", 10, false},
		{"crit_rate", 5, false},
		{"invalid", 0, true},
	}

	for _, tt := range tests {
		value, err := stats.GetStatValue(tt.statName)
		if tt.hasError {
			testhelpers.AssertError(t, err, "Should error for "+tt.statName)
		} else {
			testhelpers.AssertNoError(t, err, "Should not error for "+tt.statName)
			testhelpers.AssertEqual(t, tt.expected, value, "Stat value for "+tt.statName)
		}
	}
}

func TestGetTotalStats(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Stats.Attack = 15
	stats.Stats.Defense = 20
	stats.Stats.Dodge = 10
	stats.Stats.CritRate = 5

	total := stats.GetTotalStats()
	testhelpers.AssertEqual(t, 50, total, "Total stats should be 50")
}

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

	testhelpers.AssertNoError(t, err, "Should restore from map")
	testhelpers.AssertEqual(t, original.UserID, restored.UserID, "UserID should match")
	testhelpers.AssertEqual(t, original.Level, restored.Level, "Level should match")
	testhelpers.AssertEqual(t, original.XP, restored.XP, "XP should match")
	testhelpers.AssertEqual(t, original.Stats.Attack, restored.Stats.Attack, "Attack should match")
}

func TestValidate(t *testing.T) {
	// Valid stats
	stats := player.DefaultPlayerStats("user123")
	err := stats.Validate()
	testhelpers.AssertNoError(t, err, "Valid stats should pass validation")

	// Invalid: empty user ID
	stats.UserID = ""
	err = stats.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty user ID")

	// Invalid: level too low
	stats.UserID = "user123"
	stats.Level = 0
	err = stats.Validate()
	testhelpers.AssertError(t, err, "Should fail with level 0")

	// Invalid: negative XP
	stats.Level = 1
	stats.XP = -100
	err = stats.Validate()
	testhelpers.AssertError(t, err, "Should fail with negative XP")

	// Invalid: negative ability points
	stats.XP = 0
	stats.AbilityPoints = -5
	err = stats.Validate()
	testhelpers.AssertError(t, err, "Should fail with negative ability points")
}

func TestValidatePlayerLevel(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Level = 10

	// Test passing validation
	err := player.ValidatePlayerLevel(stats, 5)
	testhelpers.AssertNoError(t, err, "Should pass level 5 requirement")

	// Test failing validation
	err = player.ValidatePlayerLevel(stats, 15)
	testhelpers.AssertError(t, err, "Should fail level 15 requirement")
}

func TestRecordBossDefeated(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	testhelpers.AssertEqual(t, 0, stats.BossesDefeated, "Initial bosses defeated should be 0")

	stats.RecordBossDefeated()
	testhelpers.AssertEqual(t, 1, stats.BossesDefeated, "Should increment to 1")

	stats.RecordBossDefeated()
	testhelpers.AssertEqual(t, 2, stats.BossesDefeated, "Should increment to 2")
}

func TestFromJSON(t *testing.T) {
	jsonStr := `{"user_id":"user123","level":5,"xp":500,"ability_points":12,"stats":{"attack":25,"defense":20,"dodge":15,"crit_rate":10}}`

	stats, err := player.FromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse JSON")
	testhelpers.AssertEqual(t, "user123", stats.UserID, "UserID should match")
	testhelpers.AssertEqual(t, 5, stats.Level, "Level should match")
	testhelpers.AssertEqual(t, 25, stats.Stats.Attack, "Attack should match")
}

func TestToJSON(t *testing.T) {
	stats := player.DefaultPlayerStats("user123")
	stats.Level = 5
	stats.XP = 500

	jsonStr, err := stats.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := player.FromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, stats.Level, restored.Level, "Level should match after round-trip")
}
