// Package testhelpers provides test fixtures and factory functions for test data.
// These fixtures provide sensible defaults and can be customized for specific test scenarios.
package testhelpers

import (
	"time"
)

// TestPlayer represents a test player with common fields.
type TestPlayer struct {
	UserID    string
	Level     int
	XP        int
	Attack    int
	Defense   int
	Dodge     int
	CritRate  int
	Gear      []TestGear
	CreatedAt time.Time
}

// TestGear represents a test gear item.
type TestGear struct {
	ID          string
	Type        string
	Rarity      string
	Attack      int
	Defense     int
	Dodge       int
	CritRate    int
	DisplayName string
}

// TestMatch represents a test match state.
type TestMatch struct {
	MatchID        string
	CreatorID      string
	OpponentID     string
	Status         string
	CreatorHealth  int
	OpponentHealth int
	Turn           int
	CreatedAt      time.Time
}

// NewTestPlayer creates a new test player with sensible defaults.
// Defaults: level=1, xp=0, base stats=10, no gear.
//
// Example:
//
//	player := testhelpers.NewTestPlayer()
//	player.Level = 5
//	player.Attack = 25
func NewTestPlayer() *TestPlayer {
	return &TestPlayer{
		UserID:    GenerateTestID("player"),
		Level:     1,
		XP:        0,
		Attack:    10,
		Defense:   10,
		Dodge:     10,
		CritRate:  5,
		Gear:      []TestGear{},
		CreatedAt: time.Now(),
	}
}

// NewTestPlayerWithLevel creates a test player at a specific level.
// The player will have appropriate XP for that level and scaled stats.
//
// Example:
//
//	player := testhelpers.NewTestPlayerWithLevel(10)
func NewTestPlayerWithLevel(level int) *TestPlayer {
	return &TestPlayer{
		UserID:    GenerateTestID("player"),
		Level:     level,
		XP:        0,
		Attack:    10 + level,
		Defense:   10 + level,
		Dodge:     10 + (level / 2),
		CritRate:  5 + (level / 5),
		Gear:      []TestGear{},
		CreatedAt: time.Now(),
	}
}

// NewTestPlayerWithStats creates a test player with specific stats.
//
// Example:
//
//	player := testhelpers.NewTestPlayerWithStats(15, 20, 10, 5)
func NewTestPlayerWithStats(attack, defense, dodge, critRate int) *TestPlayer {
	return &TestPlayer{
		UserID:    GenerateTestID("player"),
		Level:     1,
		XP:        0,
		Attack:    attack,
		Defense:   defense,
		Dodge:     dodge,
		CritRate:  critRate,
		Gear:      []TestGear{},
		CreatedAt: time.Now(),
	}
}

// NewTestGear creates a new test gear item with sensible defaults.
// Defaults: type="bow", rarity="common", base stats=5.
//
// Example:
//
//	gear := testhelpers.NewTestGear()
//	gear.Rarity = "epic"
//	gear.Attack = 25
func NewTestGear() *TestGear {
	return &TestGear{
		ID:          GenerateTestID("gear"),
		Type:        "bow",
		Rarity:      "common",
		Attack:      5,
		Defense:     0,
		Dodge:       0,
		CritRate:    0,
		DisplayName: "Test Bow",
	}
}

// NewTestGearWithType creates a test gear item of a specific type.
// Valid types are: helm, armor, bow, arrow, amulet.
//
// Example:
//
//	gear := testhelpers.NewTestGearWithType("bow", "epic")
func NewTestGearWithType(gearType, rarity string) *TestGear {
	baseStats := 5
	switch rarity {
	case "rare":
		baseStats = 10
	case "epic":
		baseStats = 15
	case "legendary":
		baseStats = 20
	}

	var attack, defense, dodge, critRate int
	switch gearType {
	case "bow":
		attack = baseStats
	case "helm":
		defense = baseStats / 2
		dodge = baseStats / 2
	case "armor":
		defense = baseStats
	case "arrow":
		attack = baseStats / 2
		critRate = baseStats / 2
	case "amulet":
		critRate = baseStats
	}

	return &TestGear{
		ID:          GenerateTestID("gear"),
		Type:        gearType,
		Rarity:      rarity,
		Attack:      attack,
		Defense:     defense,
		Dodge:       dodge,
		CritRate:    critRate,
		DisplayName: "Test " + gearType,
	}
}

// NewTestMatch creates a new test match with sensible defaults.
// Defaults: status="active", full health (100), turn=1.
//
// Example:
//
//	match := testhelpers.NewTestMatch()
//	match.OpponentHealth = 50
func NewTestMatch() *TestMatch {
	return &TestMatch{
		MatchID:        GenerateTestID("match"),
		CreatorID:      GenerateTestID("player"),
		OpponentID:     GenerateTestID("player"),
		Status:         "active",
		CreatorHealth:  100,
		OpponentHealth: 100,
		Turn:           1,
		CreatedAt:      time.Now(),
	}
}

// NewTestMatchWithPlayers creates a test match with specific player IDs.
//
// Example:
//
//	match := testhelpers.NewTestMatchWithPlayers("player1", "player2")
func NewTestMatchWithPlayers(creatorID, opponentID string) *TestMatch {
	return &TestMatch{
		MatchID:        GenerateTestID("match"),
		CreatorID:      creatorID,
		OpponentID:     opponentID,
		Status:         "active",
		CreatorHealth:  100,
		OpponentHealth: 100,
		Turn:           1,
		CreatedAt:      time.Now(),
	}
}

// NewTestMatchWithStatus creates a test match with a specific status.
// Valid statuses are: active, completed, forfeited.
//
// Example:
//
//	match := testhelpers.NewTestMatchWithStatus("completed")
func NewTestMatchWithStatus(status string) *TestMatch {
	return &TestMatch{
		MatchID:        GenerateTestID("match"),
		CreatorID:      GenerateTestID("player"),
		OpponentID:     GenerateTestID("player"),
		Status:         status,
		CreatorHealth:  100,
		OpponentHealth: 100,
		Turn:           1,
		CreatedAt:      time.Now(),
	}
}

// SetupTestDB is a placeholder for future database test setup.
// In Phase 2, this will use testcontainers-go to spawn isolated PostgreSQL instances.
//
// Example:
//
//	db := testhelpers.SetupTestDB()
//	defer testhelpers.TeardownTestDB(db)
func SetupTestDB() interface{} {
	// Phase 2: Implement testcontainers-go PostgreSQL setup
	return nil
}

// TeardownTestDB is a placeholder for future database test cleanup.
// In Phase 2, this will handle cleanup of testcontainers PostgreSQL instances.
//
// Example:
//
//	defer testhelpers.TeardownTestDB(db)
func TeardownTestDB(db interface{}) {
	// Phase 2: Implement testcontainers-go cleanup
}
