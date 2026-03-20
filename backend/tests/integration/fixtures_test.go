// Package integration provides tests for fixture factory functions.
// This file verifies that test fixtures provide sensible defaults and
// can be customized for specific test scenarios.
package integration

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

// TestFixtureDefaults verifies that NewTestPlayer returns sensible defaults.
func TestFixtureDefaults(t *testing.T) {
	player := testhelpers.NewTestPlayer()

	require.NotNil(t, player, "Player should be created")
	assert.Equal(t, 1, player.Level, "Default level should be 1")
	assert.Equal(t, 0, player.XP, "Default XP should be 0")
	assert.Equal(t, 10, player.Attack, "Default attack should be 10")
	assert.Equal(t, 10, player.Defense, "Default defense should be 10")
	assert.Equal(t, 10, player.Dodge, "Default dodge should be 10")
	assert.Equal(t, 5, player.CritRate, "Default crit rate should be 5")
	assert.Empty(t, player.Gear, "Default gear should be empty")
	assert.NotEmpty(t, player.UserID, "UserID should be auto-generated")
}

// TestFixtureWithLevel verifies that NewTestPlayerWithLevel scales stats correctly.
func TestFixtureWithLevel(t *testing.T) {
	t.Run("Level 1", func(t *testing.T) {
		player := testhelpers.NewTestPlayerWithLevel(1)

		require.NotNil(t, player)
		assert.Equal(t, 1, player.Level)
		assert.Equal(t, 11, player.Attack, "Attack should be 10 + level")
		assert.Equal(t, 11, player.Defense, "Defense should be 10 + level")
		assert.Equal(t, 10, player.Dodge, "Dodge should be 10 + (level / 2)")
		assert.Equal(t, 5, player.CritRate, "Crit rate should be 5 + (level / 5)")
	})

	t.Run("Level 10", func(t *testing.T) {
		player := testhelpers.NewTestPlayerWithLevel(10)

		require.NotNil(t, player)
		assert.Equal(t, 10, player.Level)
		assert.Equal(t, 20, player.Attack, "Attack should be 10 + level")
		assert.Equal(t, 20, player.Defense, "Defense should be 10 + level")
		assert.Equal(t, 15, player.Dodge, "Dodge should be 10 + (level / 2)")
		assert.Equal(t, 7, player.CritRate, "Crit rate should be 5 + (level / 5)")
	})

	t.Run("Level 50", func(t *testing.T) {
		player := testhelpers.NewTestPlayerWithLevel(50)

		require.NotNil(t, player)
		assert.Equal(t, 50, player.Level)
		assert.Equal(t, 60, player.Attack, "Attack should be 10 + level")
		assert.Equal(t, 60, player.Defense, "Defense should be 10 + level")
		assert.Equal(t, 35, player.Dodge, "Dodge should be 10 + (level / 2)")
		assert.Equal(t, 15, player.CritRate, "Crit rate should be 5 + (level / 5)")
	})
}

// TestFixtureWithStats verifies that NewTestPlayerWithStats sets custom stats.
func TestFixtureWithStats(t *testing.T) {
	player := testhelpers.NewTestPlayerWithStats(25, 20, 15, 8)

	require.NotNil(t, player)
	assert.Equal(t, 1, player.Level, "Level should default to 1")
	assert.Equal(t, 25, player.Attack)
	assert.Equal(t, 20, player.Defense)
	assert.Equal(t, 15, player.Dodge)
	assert.Equal(t, 8, player.CritRate)
}

// TestGearDefaults verifies that NewTestGear returns sensible defaults.
func TestGearDefaults(t *testing.T) {
	gear := testhelpers.NewTestGear()

	require.NotNil(t, gear)
	assert.Equal(t, "bow", gear.Type, "Default type should be bow")
	assert.Equal(t, "common", gear.Rarity, "Default rarity should be common")
	assert.Equal(t, 5, gear.Attack, "Default attack should be 5")
	assert.Equal(t, 0, gear.Defense, "Default defense should be 0")
	assert.Equal(t, 0, gear.Dodge, "Default dodge should be 0")
	assert.Equal(t, 0, gear.CritRate, "Default crit rate should be 0")
	assert.NotEmpty(t, gear.ID, "ID should be auto-generated")
}

// TestGearWithType verifies that NewTestGearWithType has correct stats per type.
func TestGearWithType(t *testing.T) {
	tests := []struct {
		name           string
		gearType       string
		rarity         string
		expectedAttack int
		expectedDef    int
		expectedDodge  int
		expectedCrit   int
	}{
		{
			name:           "Common Bow",
			gearType:       "bow",
			rarity:         "common",
			expectedAttack: 5,
			expectedDef:    0,
			expectedDodge:  0,
			expectedCrit:   0,
		},
		{
			name:           "Epic Bow",
			gearType:       "bow",
			rarity:         "epic",
			expectedAttack: 15,
			expectedDef:    0,
			expectedDodge:  0,
			expectedCrit:   0,
		},
		{
			name:           "Legendary Armor",
			gearType:       "armor",
			rarity:         "legendary",
			expectedAttack: 0,
			expectedDef:    20,
			expectedDodge:  0,
			expectedCrit:   0,
		},
		{
			name:           "Rare Helm",
			gearType:       "helm",
			rarity:         "rare",
			expectedAttack: 0,
			expectedDef:    5,
			expectedDodge:  5,
			expectedCrit:   0,
		},
		{
			name:           "Epic Arrow",
			gearType:       "arrow",
			rarity:         "epic",
			expectedAttack: 7,
			expectedDef:    0,
			expectedDodge:  0,
			expectedCrit:   7,
		},
		{
			name:           "Legendary Amulet",
			gearType:       "amulet",
			rarity:         "legendary",
			expectedAttack: 0,
			expectedDef:    0,
			expectedDodge:  0,
			expectedCrit:   20,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gear := testhelpers.NewTestGearWithType(tt.gearType, tt.rarity)

			require.NotNil(t, gear)
			assert.Equal(t, tt.gearType, gear.Type)
			assert.Equal(t, tt.rarity, gear.Rarity)
			assert.Equal(t, tt.expectedAttack, gear.Attack)
			assert.Equal(t, tt.expectedDef, gear.Defense)
			assert.Equal(t, tt.expectedDodge, gear.Dodge)
			assert.Equal(t, tt.expectedCrit, gear.CritRate)
		})
	}
}

// TestMatchDefaults verifies that NewTestMatch returns sensible defaults.
func TestMatchDefaults(t *testing.T) {
	match := testhelpers.NewTestMatch()

	require.NotNil(t, match)
	assert.Equal(t, "active", match.Status, "Default status should be active")
	assert.Equal(t, 100, match.CreatorHealth, "Default health should be 100")
	assert.Equal(t, 100, match.OpponentHealth, "Default health should be 100")
	assert.Equal(t, 1, match.Turn, "Default turn should be 1")
	assert.NotEmpty(t, match.MatchID, "MatchID should be auto-generated")
	assert.NotEmpty(t, match.CreatorID, "CreatorID should be auto-generated")
	assert.NotEmpty(t, match.OpponentID, "OpponentID should be auto-generated")
}

// TestMatchWithPlayers verifies that NewTestMatchWithPlayers sets IDs correctly.
func TestMatchWithPlayers(t *testing.T) {
	creatorID := "player_123"
	opponentID := "player_456"

	match := testhelpers.NewTestMatchWithPlayers(creatorID, opponentID)

	require.NotNil(t, match)
	assert.Equal(t, creatorID, match.CreatorID)
	assert.Equal(t, opponentID, match.OpponentID)
	assert.Equal(t, "active", match.Status, "Default status should be active")
	assert.Equal(t, 100, match.CreatorHealth, "Default health should be 100")
	assert.Equal(t, 100, match.OpponentHealth, "Default health should be 100")
}

// TestMatchWithStatus verifies that NewTestMatchWithStatus sets status correctly.
func TestMatchWithStatus(t *testing.T) {
	tests := []struct {
		name   string
		status string
	}{
		{"Active match", "active"},
		{"Completed match", "completed"},
		{"Forfeited match", "forfeited"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			match := testhelpers.NewTestMatchWithStatus(tt.status)

			require.NotNil(t, match)
			assert.Equal(t, tt.status, match.Status)
		})
	}
}

// TestGenerateTestID verifies that GenerateTestID creates unique IDs.
func TestGenerateTestID(t *testing.T) {
	id1 := testhelpers.GenerateTestID("player")
	id2 := testhelpers.GenerateTestID("player")

	assert.NotEmpty(t, id1, "ID should not be empty")
	assert.NotEmpty(t, id2, "ID should not be empty")
	assert.NotEqual(t, id1, id2, "IDs should be unique")
	assert.Contains(t, id1, "player", "ID should contain prefix")
	assert.Contains(t, id2, "player", "ID should contain prefix")
}
