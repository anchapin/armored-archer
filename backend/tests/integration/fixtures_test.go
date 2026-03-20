// Package integration provides tests for fixture factory functions.
// This file verifies that test fixtures provide sensible defaults and
// can be customized for specific test scenarios, including contract tests
// for compatibility with both real DB and mocks.
package integration

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers/mocks"
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

// Contract tests for fixture compatibility with real DB and mocks

// TestPlayerFixture_RealDB verifies fixtures work with real database.
func TestPlayerFixture_RealDB(t *testing.T) {
	ctx := context.Background()

	// Setup real database
	testDB := testhelpers.SetupTestDB(ctx, t)
	defer testhelpers.TeardownTestDB(ctx, testDB)

	// Create player using builder
	player := testhelpers.NewPlayerBuilder().
		WithLevel(10).
		WithStats(25, 20, 15, 8).
		Build()

	require.NotNil(t, player, "Player should be created")
	assert.Equal(t, 10, player.Level, "Level should be 10")
	assert.Equal(t, 25, player.Attack, "Attack should be 25")
	assert.Equal(t, 20, player.Defense, "Defense should be 20")
	assert.Equal(t, 15, player.Dodge, "Dodge should be 15")
	assert.Equal(t, 8, player.CritRate, "CritRate should be 8")
	assert.NotEmpty(t, player.UserID, "UserID should be auto-generated")

	// TODO: When repository is implemented, verify persistence
	// err := repo.CreatePlayer(ctx, player)
	// assert.NoError(t, err, "Player should be created in database")
	// assert.NotEmpty(t, player.ID, "Player should have database ID")

	// Verify database connection works
	err := testDB.DB.PingContext(ctx)
	assert.NoError(t, err, "Database should be accessible")
}

// TestPlayerFixture_MockDB verifies fixtures work with mock database.
func TestPlayerFixture_MockDB(t *testing.T) {
	// Create mock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	_ = mocks.NewMockDatabase(ctrl)

	// Create player using builder
	player := testhelpers.NewPlayerBuilder().
		WithLevel(10).
		Build()

	require.NotNil(t, player, "Player should be created")
	assert.Equal(t, 10, player.Level, "Level should be 10")
	assert.Equal(t, 20, player.Attack, "Attack should be 20 (10 + level)")
	assert.Equal(t, 20, player.Defense, "Defense should be 20 (10 + level)")
	assert.Equal(t, 15, player.Dodge, "Dodge should be 15 (10 + level/2)")

	// TODO: When repository is implemented, use mock DB
	// Example:
	// mockDB.EXPECT().
	//     ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
	//     Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil)
	// repo := NewPlayerRepository(mockDB)
	// err := repo.CreatePlayer(context.Background(), player)
	// assert.NoError(t, err, "Player should be created with mock database")
}

// TestPlayerFixture_BuilderPattern verifies builder pattern works correctly.
func TestPlayerFixture_BuilderPattern(t *testing.T) {
	tests := []struct {
		name     string
		builder  func() *testhelpers.TestPlayer
		expected func(*testhelpers.TestPlayer)
	}{
		{
			name: "Default builder",
			builder: func() *testhelpers.TestPlayer {
				return testhelpers.NewPlayerBuilder().Build()
			},
			expected: func(p *testhelpers.TestPlayer) {
				assert.Equal(t, 1, p.Level, "Default level should be 1")
				assert.Equal(t, 10, p.Attack, "Default attack should be 10")
			},
		},
		{
			name: "WithLevel",
			builder: func() *testhelpers.TestPlayer {
				return testhelpers.NewPlayerBuilder().
					WithLevel(20).
					Build()
			},
			expected: func(p *testhelpers.TestPlayer) {
				assert.Equal(t, 20, p.Level, "Level should be 20")
				assert.Equal(t, 30, p.Attack, "Attack should be 30 (10 + level)")
				assert.Equal(t, 30, p.Defense, "Defense should be 30 (10 + level)")
				assert.Equal(t, 20, p.Dodge, "Dodge should be 20 (10 + level/2)")
			},
		},
		{
			name: "WithStats",
			builder: func() *testhelpers.TestPlayer {
				return testhelpers.NewPlayerBuilder().
					WithStats(50, 40, 30, 25).
					Build()
			},
			expected: func(p *testhelpers.TestPlayer) {
				assert.Equal(t, 50, p.Attack, "Attack should be 50")
				assert.Equal(t, 40, p.Defense, "Defense should be 40")
				assert.Equal(t, 30, p.Dodge, "Dodge should be 30")
				assert.Equal(t, 25, p.CritRate, "CritRate should be 25")
			},
		},
		{
			name: "Chained methods",
			builder: func() *testhelpers.TestPlayer {
				return testhelpers.NewPlayerBuilder().
					WithLevel(15).
					WithStats(35, 30, 20, 12).
					WithXP(7500).
					WithID("custom-player-123").
					Build()
			},
			expected: func(p *testhelpers.TestPlayer) {
				assert.Equal(t, 15, p.Level, "Level should be 15")
				assert.Equal(t, 35, p.Attack, "Attack should be 35 (custom stats override)")
				assert.Equal(t, 30, p.Defense, "Defense should be 30 (custom stats override)")
				assert.Equal(t, 7500, p.XP, "XP should be 7500")
				assert.Equal(t, "custom-player-123", p.UserID, "UserID should be custom")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			player := tt.builder()
			tt.expected(player)
		})
	}
}

// TestGearFixture_RealDB verifies gear fixtures work with real database.
func TestGearFixture_RealDB(t *testing.T) {
	ctx := context.Background()

	// Setup real database
	testDB := testhelpers.SetupTestDB(ctx, t)
	defer testhelpers.TeardownTestDB(ctx, testDB)

	// Create gear using builder
	gear := testhelpers.NewGearBuilder().
		WithType("bow").
		WithRarity("epic").
		WithStats(25, 5, 3, 10).
		Build()

	require.NotNil(t, gear, "Gear should be created")
	assert.Equal(t, "bow", gear.Type, "Type should be bow")
	assert.Equal(t, "epic", gear.Rarity, "Rarity should be epic")
	assert.Equal(t, 25, gear.Attack, "Attack should be 25")
	assert.Equal(t, 5, gear.Defense, "Defense should be 5")
	assert.Equal(t, 3, gear.Dodge, "Dodge should be 3")
	assert.Equal(t, 10, gear.CritRate, "CritRate should be 10")
	assert.NotEmpty(t, gear.ID, "ID should be auto-generated")

	// Verify database connection works
	err := testDB.DB.PingContext(ctx)
	assert.NoError(t, err, "Database should be accessible")
}

// TestGearFixture_MockDB verifies gear fixtures work with mock database.
func TestGearFixture_MockDB(t *testing.T) {
	// Create mock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	_ = mocks.NewMockDatabase(ctrl)

	// Create gear using builder
	gear := testhelpers.NewGearBuilder().
		WithType("armor").
		WithRarity("legendary").
		Build()

	require.NotNil(t, gear, "Gear should be created")
	assert.Equal(t, "armor", gear.Type, "Type should be armor")
	assert.Equal(t, "legendary", gear.Rarity, "Rarity should be legendary")
	assert.Equal(t, 20, gear.Defense, "Defense should be 20 (legendary armor)")

	// TODO: When repository is implemented, use mock DB
	// Example:
	// mockDB.EXPECT().
	//     ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
	//     Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil)
	// repo := NewGearRepository(mockDB)
	// err := repo.CreateGear(context.Background(), gear)
	// assert.NoError(t, err, "Gear should be created with mock database")
}

// TestGearFixture_BuilderPattern verifies gear builder pattern works correctly.
func TestGearFixture_BuilderPattern(t *testing.T) {
	tests := []struct {
		name     string
		builder  func() *testhelpers.TestGear
		expected func(*testhelpers.TestGear)
	}{
		{
			name: "Default builder",
			builder: func() *testhelpers.TestGear {
				return testhelpers.NewGearBuilder().Build()
			},
			expected: func(g *testhelpers.TestGear) {
				assert.Equal(t, "bow", g.Type, "Default type should be bow")
				assert.Equal(t, "common", g.Rarity, "Default rarity should be common")
				assert.Equal(t, 5, g.Attack, "Default attack should be 5")
			},
		},
		{
			name: "Epic bow",
			builder: func() *testhelpers.TestGear {
				return testhelpers.NewGearBuilder().
					WithType("bow").
					WithRarity("epic").
					Build()
			},
			expected: func(g *testhelpers.TestGear) {
				assert.Equal(t, "bow", g.Type, "Type should be bow")
				assert.Equal(t, "epic", g.Rarity, "Rarity should be epic")
				assert.Equal(t, 15, g.Attack, "Attack should be 15 (epic base)")
			},
		},
		{
			name: "Legendary armor",
			builder: func() *testhelpers.TestGear {
				return testhelpers.NewGearBuilder().
					WithType("armor").
					WithRarity("legendary").
					Build()
			},
			expected: func(g *testhelpers.TestGear) {
				assert.Equal(t, "armor", g.Type, "Type should be armor")
				assert.Equal(t, "legendary", g.Rarity, "Rarity should be legendary")
				assert.Equal(t, 20, g.Defense, "Defense should be 20 (legendary armor)")
			},
		},
		{
			name: "Custom stats",
			builder: func() *testhelpers.TestGear {
				return testhelpers.NewGearBuilder().
					WithType("bow").
					WithStats(50, 10, 5, 15).
					Build()
			},
			expected: func(g *testhelpers.TestGear) {
				assert.Equal(t, 50, g.Attack, "Attack should be 50 (custom)")
				assert.Equal(t, 10, g.Defense, "Defense should be 10 (custom)")
				assert.Equal(t, 5, g.Dodge, "Dodge should be 5 (custom)")
				assert.Equal(t, 15, g.CritRate, "CritRate should be 15 (custom)")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gear := tt.builder()
			tt.expected(gear)
		})
	}
}

// TestMatchFixture_RealDB verifies match fixtures work with real database.
func TestMatchFixture_RealDB(t *testing.T) {
	ctx := context.Background()

	// Setup real database
	testDB := testhelpers.SetupTestDB(ctx, t)
	defer testhelpers.TeardownTestDB(ctx, testDB)

	// Create match using builder
	match := testhelpers.NewMatchBuilder().
		WithPlayers("player1", "player2").
		WithStatus("active").
		WithHealth(100, 80).
		WithTurn(3).
		Build()

	require.NotNil(t, match, "Match should be created")
	assert.Equal(t, "player1", match.CreatorID, "CreatorID should be player1")
	assert.Equal(t, "player2", match.OpponentID, "OpponentID should be player2")
	assert.Equal(t, "active", match.Status, "Status should be active")
	assert.Equal(t, 100, match.CreatorHealth, "Creator health should be 100")
	assert.Equal(t, 80, match.OpponentHealth, "Opponent health should be 80")
	assert.Equal(t, 3, match.Turn, "Turn should be 3")

	// Verify database connection works
	err := testDB.DB.PingContext(ctx)
	assert.NoError(t, err, "Database should be accessible")
}

// TestMatchFixture_MockDB verifies match fixtures work with mock database.
func TestMatchFixture_MockDB(t *testing.T) {
	// Create mock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	// Create mock database
	_ = mocks.NewMockDatabase(ctrl)

	// Create match using builder
	match := testhelpers.NewMatchBuilder().
		WithPlayers("player1", "player2").
		WithStatus("completed").
		Build()

	require.NotNil(t, match, "Match should be created")
	assert.Equal(t, "player1", match.CreatorID, "CreatorID should be player1")
	assert.Equal(t, "player2", match.OpponentID, "OpponentID should be player2")
	assert.Equal(t, "completed", match.Status, "Status should be completed")

	// TODO: When repository is implemented, use mock DB
	// Example:
	// mockDB.EXPECT().
	//     ExecContext(gomock.Any(), gomock.Any(), gomock.Any()).
	//     Return(&mockResult{lastInsertID: 1, rowsAffected: 1}, nil)
	// repo := NewMatchRepository(mockDB)
	// err := repo.CreateMatch(context.Background(), match)
	// assert.NoError(t, err, "Match should be created with mock database")
}

