package rpg_test

import (
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/rpg"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestNewPlayerStats(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")

	testhelpers.AssertEqual(t, "user123", stats.UserID, "UserID should match")
	testhelpers.AssertEqual(t, 1, stats.Level, "Level should be 1")
	testhelpers.AssertEqual(t, 0, stats.XP, "XP should be 0")
	testhelpers.AssertEqual(t, 0, stats.AbilityPoints, "AbilityPoints should be 0")
	testhelpers.AssertEqual(t, 10, stats.Stats.Attack, "Attack should be 10")
	testhelpers.AssertEqual(t, 10, stats.Stats.Defense, "Defense should be 10")
	testhelpers.AssertEqual(t, 10, stats.Stats.Dodge, "Dodge should be 10")
	testhelpers.AssertEqual(t, 5, stats.Stats.CritRate, "CritRate should be 5")
}

func TestCalculateLevel(t *testing.T) {
	tests := []struct {
		totalXP  int
		expected int
	}{
		{0, 1},
		{50, 1},
		{100, 1},
		{200, 1},
		{400, 2},
		{900, 3},
		{10000, 10},
		{100000, 31},
	}

	for _, tt := range tests {
		result := rpg.CalculateLevel(tt.totalXP)
		testhelpers.AssertEqual(t, tt.expected, result,
			fmt.Sprintf(""Level for %d XP", tt.totalXP))
	}
}

func TestXPRequiredForLevel(t *testing.T) {
	tests := []struct {
		level    int
		expected int
	}{
		{1, 100},
		{2, 400},
		{3, 900},
		{5, 2500},
		{10, 10000},
	}

	for _, tt := range tests {
		result := rpg.XPRequiredForLevel(tt.level)
		testhelpers.AssertEqual(t, tt.expected, result,
			fmt.Sprintf(""XP for level %d", tt.level))
	}
}

func TestXPRequiredForNextLevel(t *testing.T) {
	// Level 1 to 2: 400 - 100 = 300 XP
	xp := rpg.XPRequiredForNextLevel(1)
	testhelpers.AssertEqual(t, 300, xp, "XP for level 1->2 should be 300")

	// Level 2 to 3: 900 - 400 = 500 XP
	xp = rpg.XPRequiredForNextLevel(2)
	testhelpers.AssertEqual(t, 500, xp, "XP for level 2->3 should be 500")
}

func TestAddXP(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")

	// Test small XP gain (no level up)
	levelsGained, newXP := stats.AddXP(50, "pve")
	testhelpers.AssertEqual(t, 0, levelsGained, "Should not gain levels")
	testhelpers.AssertEqual(t, 50, newXP, "XP should be 50")

	// Test XP gain that causes level up
	levelsGained, newXP = stats.AddXP(150, "pve")
	testhelpers.AssertEqual(t, 1, levelsGained, "Should gain 1 level")
	testhelpers.AssertEqual(t, 3, stats.AbilityPoints, "Should gain 3 ability points")

	// Test multiple level ups
	stats.XP = 0
	stats.Level = 1
	stats.AbilityPoints = 0
	levelsGained, _ = stats.AddXP(500, "pvp")
	testhelpers.AssertTrue(t, levelsGained >= 2, "Should gain multiple levels")
}

func TestAllocateStat(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")
	stats.AbilityPoints = 10

	// Test valid allocation
	err := stats.AllocateStat(rpg.StatAttack, 5)
	testhelpers.AssertNoError(t, err, "Should allocate attack points")
	testhelpers.AssertEqual(t, 15, stats.Stats.Attack, "Attack should be 15")
	testhelpers.AssertEqual(t, 5, stats.AbilityPoints, "Should have 5 points left")

	// Test insufficient points
	err = stats.AllocateStat(rpg.StatDefense, 10)
	testhelpers.AssertError(t, err, "Should fail with insufficient points")

	// Test invalid stat name
	err = stats.AllocateStat("invalid", 1)
	testhelpers.AssertError(t, err, "Should fail with invalid stat name")

	// Test allocating more than max per transaction
	err = stats.AllocateStat(rpg.StatAttack, 10)
	testhelpers.AssertError(t, err, "Should fail with too many points")
}

func TestGetStatValue(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")
	stats.Stats.Attack = 15
	stats.Stats.Defense = 20
	stats.Stats.Dodge = 10
	stats.Stats.CritRate = 5

	tests := []struct {
		statName string
		expected int
		hasError bool
	}{
		{rpg.StatAttack, 15, false},
		{rpg.StatDefense, 20, false},
		{rpg.StatDodge, 10, false},
		{rpg.StatCritRate, 5, false},
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
	stats := rpg.NewPlayerStats("user123")
	stats.Stats.Attack = 15
	stats.Stats.Defense = 20
	stats.Stats.Dodge = 10
	stats.Stats.CritRate = 5

	total := stats.GetTotalStats()
	testhelpers.AssertEqual(t, 50, total, "Total stats should be 50")
}

func TestGetProgressToNextLevel(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")

	// At level 1 with 0 XP, should be 0% progress
	progress := stats.GetProgressToNextLevel()
	testhelpers.AssertEqual(t, 0.0, progress, "Should be 0% progress at level 1 with 0 XP")

	// At level 1 with 150 XP (halfway to level 2)
	stats.XP = 150
	progress = stats.GetProgressToNextLevel()
	testhelpers.AssertTrue(t, progress >= 45 && progress <= 55, "Should be around 50% progress")

	// At max level
	stats.Level = rpg.MaxLevel
	progress = stats.GetProgressToNextLevel()
	testhelpers.AssertEqual(t, 100.0, progress, "Should be 100% at max level")
}

func TestIsMaxLevel(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")
	testhelpers.AssertFalse(t, stats.IsMaxLevel(), "Should not be max level initially")

	stats.Level = rpg.MaxLevel
	testhelpers.AssertTrue(t, stats.IsMaxLevel(), "Should be max level at level 100")
}

func TestValidate(t *testing.T) {
	// Valid stats
	stats := rpg.NewPlayerStats("user123")
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

	// Invalid: level too high
	stats.Level = rpg.MaxLevel + 1
	err = stats.Validate()
	testhelpers.AssertError(t, err, "Should fail with level above max")

	// Invalid: negative XP
	stats.Level = 1
	stats.XP = -100
	err = stats.Validate()
	testhelpers.AssertError(t, err, "Should fail with negative XP")
}

func TestXPGainRequestValidate(t *testing.T) {
	// Valid request
	req := &rpg.XPGainRequest{
		XPAmount: 100,
		Source:   "pve",
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	// Invalid: negative XP
	req.XPAmount = -100
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with negative XP")

	// Invalid: invalid source
	req.XPAmount = 100
	req.Source = "invalid"
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with invalid source")

	// Invalid: XP too high
	req.Source = "pve"
	req.XPAmount = 20000
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with XP above maximum")
}

func TestStatAllocationRequestValidate(t *testing.T) {
	// Valid request
	req := &rpg.StatAllocationRequest{
		StatName: rpg.StatAttack,
		Points:   3,
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	// Invalid: empty stat name
	req.StatName = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty stat name")

	// Invalid: negative points
	req.StatName = rpg.StatAttack
	req.Points = -1
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with negative points")

	// Invalid: too many points
	req.Points = 10
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with too many points")

	// Invalid: invalid stat name
	req.Points = 3
	req.StatName = "invalid"
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with invalid stat name")
}

func TestFromJSON(t *testing.T) {
	jsonStr := `{"user_id":"user123","level":5,"xp":500,"ability_points":12,"stats":{"attack":25,"defense":20,"dodge":15,"crit_rate":10}}`

	stats, err := rpg.FromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse JSON")
	testhelpers.AssertEqual(t, "user123", stats.UserID, "UserID should match")
	testhelpers.AssertEqual(t, 5, stats.Level, "Level should match")
	testhelpers.AssertEqual(t, 25, stats.Stats.Attack, "Attack should match")
}

func TestToJSON(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")
	stats.Level = 5
	stats.XP = 500

	jsonStr, err := stats.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := rpg.FromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, stats.Level, restored.Level, "Level should match after round-trip")
}

func TestGetStatDescription(t *testing.T) {
	tests := []struct {
		statName string
		expected string
	}{
		{rpg.StatAttack, "Increases damage dealt"},
		{rpg.StatDefense, "Reduces damage taken"},
		{rpg.StatDodge, "Chance to avoid attacks"},
		{rpg.StatCritRate, "Chance for critical hits"},
		{"invalid", "Unknown stat"},
	}

	for _, tt := range tests {
		desc := rpg.GetStatDescription(tt.statName)
		testhelpers.AssertEqual(t, tt.expected, desc, "Description for "+tt.statName)
	}
}

func TestGetStatLimits(t *testing.T) {
	limits := rpg.GetStatLimits()

	testhelpers.AssertTrue(t, limits[rpg.StatAttack] > 0, "Attack should have limit")
	testhelpers.AssertTrue(t, limits[rpg.StatDefense] > 0, "Defense should have limit")
	testhelpers.AssertTrue(t, limits[rpg.StatDodge] > 0, "Dodge should have limit")
	testhelpers.AssertTrue(t, limits[rpg.StatCritRate] > 0, "CritRate should have limit")
}

func TestValidateStatAllocation(t *testing.T) {
	// Valid allocation
	err := rpg.ValidateStatAllocation(10, 20, rpg.StatAttack)
	testhelpers.AssertNoError(t, err, "Valid allocation should pass")

	// Exceeds soft cap
	err = rpg.ValidateStatAllocation(10, 2000, rpg.StatAttack)
	testhelpers.AssertError(t, err, "Should fail when exceeding soft cap")
}

func TestGenerateProgressionReport(t *testing.T) {
	stats := rpg.NewPlayerStats("user123")
	stats.Level = 5
	stats.XP = 500

	report := rpg.GenerateProgressionReport(stats)

	testhelpers.AssertTrue(t, len(report) > 0, "Report should not be empty")
	testhelpers.AssertTrue(t, report["level"] != nil, "Report should have level")
	testhelpers.AssertTrue(t, report["xp"] != nil, "Report should have xp")
	testhelpers.AssertTrue(t, report["stats"] != nil, "Report should have stats")
	testhelpers.AssertTrue(t, report["stat_descriptions"] != nil, "Report should have stat descriptions")
}
