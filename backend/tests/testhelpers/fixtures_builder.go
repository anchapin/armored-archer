// Package testhelpers provides builder pattern for test fixtures.
// Builders enable fluent API for creating test data with sensible defaults
// while allowing customization via method chaining.
package testhelpers

// PlayerBuilder builds TestPlayer instances with fluent API.
//
// Example:
//
//	player := testhelpers.NewPlayerBuilder().
//	    WithLevel(10).
//	    WithStats(25, 20, 15, 8).
//	    WithGear(*testhelpers.NewTestGearWithType("bow", "rare")).
//	    Build()
type PlayerBuilder struct {
	player *TestPlayer
}

// NewPlayerBuilder creates a new PlayerBuilder with sensible defaults.
// Defaults: level=1, xp=0, base stats=10, no gear.
func NewPlayerBuilder() *PlayerBuilder {
	return &PlayerBuilder{
		player: NewTestPlayer(),
	}
}

// WithLevel sets the player level and auto-scales stats based on level.
// Stat scaling formula:
// - Attack: 10 + level
// - Defense: 10 + level
// - Dodge: 10 + (level / 2)
// - CritRate: 5 + (level / 5)
//
// Example:
//
//	builder.WithLevel(10) // Sets stats to Attack=20, Defense=20, Dodge=15, CritRate=7
func (b *PlayerBuilder) WithLevel(level int) *PlayerBuilder {
	b.player.Level = level
	b.player.Attack = 10 + level
	b.player.Defense = 10 + level
	b.player.Dodge = 10 + (level / 2)
	b.player.CritRate = 5 + (level / 5)
	return b
}

// WithStats sets custom stats for the player, overriding any defaults.
//
// Example:
//
//	builder.WithStats(25, 20, 15, 8) // Attack=25, Defense=20, Dodge=15, CritRate=8
func (b *PlayerBuilder) WithStats(attack, defense, dodge, critRate int) *PlayerBuilder {
	b.player.Attack = attack
	b.player.Defense = defense
	b.player.Dodge = dodge
	b.player.CritRate = critRate
	return b
}

// WithGear adds gear items to the player's loadout.
// Can be called multiple times to add multiple items.
//
// Example:
//
//	builder.WithGear(*testhelpers.NewTestGearWithType("bow", "rare")).
//	    WithGear(*testhelpers.NewTestGearWithType("helm", "epic"))
func (b *PlayerBuilder) WithGear(gear ...TestGear) *PlayerBuilder {
	b.player.Gear = append(b.player.Gear, gear...)
	return b
}

// WithID sets a custom user ID for the player.
//
// Example:
//
//	builder.WithID("player123")
func (b *PlayerBuilder) WithID(userID string) *PlayerBuilder {
	b.player.UserID = userID
	return b
}

// WithXP sets the player's experience points.
//
// Example:
//
//	builder.WithXP(5000)
func (b *PlayerBuilder) WithXP(xp int) *PlayerBuilder {
	b.player.XP = xp
	return b
}

// Build returns the constructed TestPlayer.
func (b *PlayerBuilder) Build() *TestPlayer {
	return b.player
}

// GearBuilder builds TestGear instances with fluent API.
//
// Example:
//
//	gear := testhelpers.NewGearBuilder().
//	    WithType("bow").
//	    WithRarity("epic").
//	    WithStats(25, 5, 3, 10).
//	    Build()
type GearBuilder struct {
	gear *TestGear
}

// NewGearBuilder creates a new GearBuilder with sensible defaults.
// Defaults: type="bow", rarity="common", base stats=5.
func NewGearBuilder() *GearBuilder {
	return &GearBuilder{
		gear: NewTestGear(),
	}
}

// WithType sets the gear type.
// Valid types: helm, armor, bow, arrow, amulet.
//
// Example:
//
//	builder.WithType("bow")
func (b *GearBuilder) WithType(gearType string) *GearBuilder {
	b.gear.Type = gearType
	return b
}

// WithRarity sets the gear rarity and scales base stats accordingly.
// Rarity stat bonuses:
// - common: base stats = 5
// - rare: base stats = 10
// - epic: base stats = 15
// - legendary: base stats = 20
//
// Example:
//
//	builder.WithRarity("epic") // Scales stats to 15 base
func (b *GearBuilder) WithRarity(rarity string) *GearBuilder {
	b.gear.Rarity = rarity

	baseStats := 5
	switch rarity {
	case "rare":
		baseStats = 10
	case "epic":
		baseStats = 15
	case "legendary":
		baseStats = 20
	}

	// Auto-scale stats based on type and rarity
	var attack, defense, dodge, critRate int
	switch b.gear.Type {
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

	b.gear.Attack = attack
	b.gear.Defense = defense
	b.gear.Dodge = dodge
	b.gear.CritRate = critRate

	return b
}

// WithStats sets custom stats for the gear, overriding any defaults.
//
// Example:
//
//	builder.WithStats(25, 5, 3, 10) // Attack=25, Defense=5, Dodge=3, CritRate=10
func (b *GearBuilder) WithStats(attack, defense, dodge, critRate int) *GearBuilder {
	b.gear.Attack = attack
	b.gear.Defense = defense
	b.gear.Dodge = dodge
	b.gear.CritRate = critRate
	return b
}

// WithID sets a custom gear ID.
//
// Example:
//
//	builder.WithID("gear123")
func (b *GearBuilder) WithID(id string) *GearBuilder {
	b.gear.ID = id
	return b
}

// WithDisplayName sets a custom display name for the gear.
//
// Example:
//
//	builder.WithDisplayName("Legendary Bow of Fire")
func (b *GearBuilder) WithDisplayName(name string) *GearBuilder {
	b.gear.DisplayName = name
	return b
}

// Build returns the constructed TestGear.
func (b *GearBuilder) Build() *TestGear {
	return b.gear
}

// MatchBuilder builds TestMatch instances with fluent API.
//
// Example:
//
//	match := testhelpers.NewMatchBuilder().
//	    WithPlayers("player1", "player2").
//	    WithStatus("active").
//	    WithHealth(100, 80).
//	    WithTurn(3).
//	    Build()
type MatchBuilder struct {
	match *TestMatch
}

// NewMatchBuilder creates a new MatchBuilder with sensible defaults.
// Defaults: status="active", full health (100), turn=1.
func NewMatchBuilder() *MatchBuilder {
	return &MatchBuilder{
		match: NewTestMatch(),
	}
}

// WithPlayers sets the creator and opponent player IDs.
//
// Example:
//
//	builder.WithPlayers("player1", "player2")
func (b *MatchBuilder) WithPlayers(creatorID, opponentID string) *MatchBuilder {
	b.match.CreatorID = creatorID
	b.match.OpponentID = opponentID
	return b
}

// WithStatus sets the match status.
// Valid statuses: active, completed, forfeited.
//
// Example:
//
//	builder.WithStatus("completed")
func (b *MatchBuilder) WithStatus(status string) *MatchBuilder {
	b.match.Status = status
	return b
}

// WithHealth sets the health values for both players.
//
// Example:
//
//	builder.WithHealth(100, 50) // Creator at 100 health, opponent at 50
func (b *MatchBuilder) WithHealth(creatorHealth, opponentHealth int) *MatchBuilder {
	b.match.CreatorHealth = creatorHealth
	b.match.OpponentHealth = opponentHealth
	return b
}

// WithTurn sets the current turn number.
//
// Example:
//
//	builder.WithTurn(5)
func (b *MatchBuilder) WithTurn(turn int) *MatchBuilder {
	b.match.Turn = turn
	return b
}

// WithID sets a custom match ID.
//
// Example:
//
//	builder.WithID("match123")
func (b *MatchBuilder) WithID(matchID string) *MatchBuilder {
	b.match.MatchID = matchID
	return b
}

// Build returns the constructed TestMatch.
func (b *MatchBuilder) Build() *TestMatch {
	return b.match
}
