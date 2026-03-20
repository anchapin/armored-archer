package testhelpers

import (
	"testing"
)

func TestPlayerBuilderDefaults(t *testing.T) {
	player := NewPlayerBuilder().Build()

	// Verify defaults
	if player.Level != 1 {
		t.Errorf("Expected default Level=1, got %d", player.Level)
	}
	if player.XP != 0 {
		t.Errorf("Expected default XP=0, got %d", player.XP)
	}
	if player.Attack != 10 {
		t.Errorf("Expected default Attack=10, got %d", player.Attack)
	}
	if player.Defense != 10 {
		t.Errorf("Expected default Defense=10, got %d", player.Defense)
	}
	if player.Dodge != 10 {
		t.Errorf("Expected default Dodge=10, got %d", player.Dodge)
	}
	if player.CritRate != 5 {
		t.Errorf("Expected default CritRate=5, got %d", player.CritRate)
	}
	if len(player.Gear) != 0 {
		t.Errorf("Expected default Gear to be empty, got %d items", len(player.Gear))
	}
	if player.UserID == "" {
		t.Error("Expected UserID to be generated, got empty string")
	}
}

func TestPlayerBuilderWithLevel(t *testing.T) {
	tests := []struct {
		name              string
		level             int
		expectedAttack    int
		expectedDefense   int
		expectedDodge     int
		expectedCritRate  int
	}{
		{"Level 1", 1, 11, 11, 10, 5},
		{"Level 10", 10, 20, 20, 15, 7},
		{"Level 25", 25, 35, 35, 22, 10},
		{"Level 50", 50, 60, 60, 35, 15},
		{"Level 100", 100, 110, 110, 60, 25},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			player := NewPlayerBuilder().WithLevel(tt.level).Build()

			if player.Level != tt.level {
				t.Errorf("Expected Level=%d, got %d", tt.level, player.Level)
			}
			if player.Attack != tt.expectedAttack {
				t.Errorf("Expected Attack=%d, got %d", tt.expectedAttack, player.Attack)
			}
			if player.Defense != tt.expectedDefense {
				t.Errorf("Expected Defense=%d, got %d", tt.expectedDefense, player.Defense)
			}
			if player.Dodge != tt.expectedDodge {
				t.Errorf("Expected Dodge=%d, got %d", tt.expectedDodge, player.Dodge)
			}
			if player.CritRate != tt.expectedCritRate {
				t.Errorf("Expected CritRate=%d, got %d", tt.expectedCritRate, player.CritRate)
			}
		})
	}
}

func TestPlayerBuilderWithStats(t *testing.T) {
	player := NewPlayerBuilder().
		WithStats(25, 20, 15, 8).
		Build()

	if player.Attack != 25 {
		t.Errorf("Expected Attack=25, got %d", player.Attack)
	}
	if player.Defense != 20 {
		t.Errorf("Expected Defense=20, got %d", player.Defense)
	}
	if player.Dodge != 15 {
		t.Errorf("Expected Dodge=15, got %d", player.Dodge)
	}
	if player.CritRate != 8 {
		t.Errorf("Expected CritRate=8, got %d", player.CritRate)
	}
}

func TestPlayerBuilderWithGear(t *testing.T) {
	gear1 := *NewTestGearWithType("bow", "rare")
	gear2 := *NewTestGearWithType("helm", "epic")

	player := NewPlayerBuilder().
		WithGear(gear1).
		WithGear(gear2).
		Build()

	if len(player.Gear) != 2 {
		t.Errorf("Expected 2 gear items, got %d", len(player.Gear))
	}
	if player.Gear[0].Type != "bow" {
		t.Errorf("Expected first gear type=bow, got %s", player.Gear[0].Type)
	}
	if player.Gear[1].Type != "helm" {
		t.Errorf("Expected second gear type=helm, got %s", player.Gear[1].Type)
	}
}

func TestPlayerBuilderWithID(t *testing.T) {
	player := NewPlayerBuilder().
		WithID("custom_player_id").
		Build()

	if player.UserID != "custom_player_id" {
		t.Errorf("Expected UserID=custom_player_id, got %s", player.UserID)
	}
}

func TestPlayerBuilderWithXP(t *testing.T) {
	player := NewPlayerBuilder().
		WithXP(5000).
		Build()

	if player.XP != 5000 {
		t.Errorf("Expected XP=5000, got %d", player.XP)
	}
}

func TestPlayerBuilderChaining(t *testing.T) {
	gear := *NewTestGearWithType("bow", "legendary")
	player := NewPlayerBuilder().
		WithLevel(25).
		WithStats(50, 45, 30, 15).
		WithGear(gear).
		WithID("chained_player").
		WithXP(10000).
		Build()

	if player.Level != 25 {
		t.Errorf("Expected Level=25, got %d", player.Level)
	}
	if player.Attack != 50 {
		t.Errorf("Expected Attack=50, got %d", player.Attack)
	}
	if player.Defense != 45 {
		t.Errorf("Expected Defense=45, got %d", player.Defense)
	}
	if player.Dodge != 30 {
		t.Errorf("Expected Dodge=30, got %d", player.Dodge)
	}
	if player.CritRate != 15 {
		t.Errorf("Expected CritRate=15, got %d", player.CritRate)
	}
	if len(player.Gear) != 1 {
		t.Errorf("Expected 1 gear item, got %d", len(player.Gear))
	}
	if player.UserID != "chained_player" {
		t.Errorf("Expected UserID=chained_player, got %s", player.UserID)
	}
	if player.XP != 10000 {
		t.Errorf("Expected XP=10000, got %d", player.XP)
	}
}

func TestGearBuilderDefaults(t *testing.T) {
	gear := NewGearBuilder().Build()

	// Verify defaults
	if gear.Type != "bow" {
		t.Errorf("Expected default Type=bow, got %s", gear.Type)
	}
	if gear.Rarity != "common" {
		t.Errorf("Expected default Rarity=common, got %s", gear.Rarity)
	}
	if gear.Attack != 5 {
		t.Errorf("Expected default Attack=5, got %d", gear.Attack)
	}
	if gear.Defense != 0 {
		t.Errorf("Expected default Defense=0, got %d", gear.Defense)
	}
	if gear.Dodge != 0 {
		t.Errorf("Expected default Dodge=0, got %d", gear.Dodge)
	}
	if gear.CritRate != 0 {
		t.Errorf("Expected default CritRate=0, got %d", gear.CritRate)
	}
	if gear.ID == "" {
		t.Error("Expected ID to be generated, got empty string")
	}
}

func TestGearBuilderWithType(t *testing.T) {
	tests := []struct {
		name           string
		gearType       string
		expectedAttack int
		expectedDefense int
		expectedDodge  int
		expectedCritRate int
	}{
		{"Bow", "bow", 5, 0, 0, 0},
		{"Helm", "helm", 5, 0, 0, 0},
		{"Armor", "armor", 5, 0, 0, 0},
		{"Arrow", "arrow", 5, 0, 0, 0},
		{"Amulet", "amulet", 5, 0, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gear := NewGearBuilder().WithType(tt.gearType).Build()

			if gear.Type != tt.gearType {
				t.Errorf("Expected Type=%s, got %s", tt.gearType, gear.Type)
			}
			// WithType only sets the type field, doesn't scale stats
			// Stat scaling happens in WithRarity or WithStats
			if gear.Attack != tt.expectedAttack {
				t.Errorf("Expected Attack=%d, got %d", tt.expectedAttack, gear.Attack)
			}
			if gear.Defense != tt.expectedDefense {
				t.Errorf("Expected Defense=%d, got %d", tt.expectedDefense, gear.Defense)
			}
			if gear.Dodge != tt.expectedDodge {
				t.Errorf("Expected Dodge=%d, got %d", tt.expectedDodge, gear.Dodge)
			}
			if gear.CritRate != tt.expectedCritRate {
				t.Errorf("Expected CritRate=%d, got %d", tt.expectedCritRate, gear.CritRate)
			}
		})
	}
}

func TestGearBuilderWithRarity(t *testing.T) {
	tests := []struct {
		name         string
		rarity       string
		baseStats    int
	}{
		{"Common", "common", 5},
		{"Rare", "rare", 10},
		{"Epic", "epic", 15},
		{"Legendary", "legendary", 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gear := NewGearBuilder().
				WithType("bow").
				WithRarity(tt.rarity).
				Build()

			if gear.Rarity != tt.rarity {
				t.Errorf("Expected Rarity=%s, got %s", tt.rarity, gear.Rarity)
			}
			if gear.Attack != tt.baseStats {
				t.Errorf("Expected Attack=%d for %s bow, got %d", tt.baseStats, tt.rarity, gear.Attack)
			}
		})
	}
}

func TestGearBuilderTypeAndRarityCombo(t *testing.T) {
	tests := []struct {
		name           string
		gearType       string
		rarity         string
		expectedAttack int
		expectedDefense int
		expectedDodge  int
		expectedCritRate int
	}{
		{"Common Bow", "bow", "common", 5, 0, 0, 0},
		{"Rare Bow", "bow", "rare", 10, 0, 0, 0},
		{"Epic Helm", "helm", "epic", 0, 7, 7, 0},
		{"Legendary Armor", "armor", "legendary", 0, 20, 0, 0},
		{"Epic Arrow", "arrow", "epic", 7, 0, 0, 7},
		{"Rare Amulet", "amulet", "rare", 0, 0, 0, 10},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gear := NewGearBuilder().
				WithType(tt.gearType).
				WithRarity(tt.rarity).
				Build()

			if gear.Type != tt.gearType {
				t.Errorf("Expected Type=%s, got %s", tt.gearType, gear.Type)
			}
			if gear.Rarity != tt.rarity {
				t.Errorf("Expected Rarity=%s, got %s", tt.rarity, gear.Rarity)
			}
			if gear.Attack != tt.expectedAttack {
				t.Errorf("Expected Attack=%d, got %d", tt.expectedAttack, gear.Attack)
			}
			if gear.Defense != tt.expectedDefense {
				t.Errorf("Expected Defense=%d, got %d", tt.expectedDefense, gear.Defense)
			}
			if gear.Dodge != tt.expectedDodge {
				t.Errorf("Expected Dodge=%d, got %d", tt.expectedDodge, gear.Dodge)
			}
			if gear.CritRate != tt.expectedCritRate {
				t.Errorf("Expected CritRate=%d, got %d", tt.expectedCritRate, gear.CritRate)
			}
		})
	}
}

func TestGearBuilderStats(t *testing.T) {
	gear := NewGearBuilder().
		WithStats(25, 10, 5, 15).
		Build()

	if gear.Attack != 25 {
		t.Errorf("Expected Attack=25, got %d", gear.Attack)
	}
	if gear.Defense != 10 {
		t.Errorf("Expected Defense=10, got %d", gear.Defense)
	}
	if gear.Dodge != 5 {
		t.Errorf("Expected Dodge=5, got %d", gear.Dodge)
	}
	if gear.CritRate != 15 {
		t.Errorf("Expected CritRate=15, got %d", gear.CritRate)
	}
}

func TestGearBuilderWithID(t *testing.T) {
	gear := NewGearBuilder().
		WithID("custom_gear_id").
		Build()

	if gear.ID != "custom_gear_id" {
		t.Errorf("Expected ID=custom_gear_id, got %s", gear.ID)
	}
}

func TestGearBuilderWithDisplayName(t *testing.T) {
	gear := NewGearBuilder().
		WithDisplayName("Legendary Dragon Bow").
		Build()

	if gear.DisplayName != "Legendary Dragon Bow" {
		t.Errorf("Expected DisplayName=Legendary Dragon Bow, got %s", gear.DisplayName)
	}
}

func TestGearBuilderChaining(t *testing.T) {
	gear := NewGearBuilder().
		WithType("bow").
		WithRarity("legendary").
		WithStats(30, 5, 3, 12).
		WithID("legendary_bow_001").
		WithDisplayName("Dragon Bow of Fire").
		Build()

	if gear.Type != "bow" {
		t.Errorf("Expected Type=bow, got %s", gear.Type)
	}
	if gear.Rarity != "legendary" {
		t.Errorf("Expected Rarity=legendary, got %s", gear.Rarity)
	}
	if gear.Attack != 30 {
		t.Errorf("Expected Attack=30, got %d", gear.Attack)
	}
	if gear.Defense != 5 {
		t.Errorf("Expected Defense=5, got %d", gear.Defense)
	}
	if gear.Dodge != 3 {
		t.Errorf("Expected Dodge=3, got %d", gear.Dodge)
	}
	if gear.CritRate != 12 {
		t.Errorf("Expected CritRate=12, got %d", gear.CritRate)
	}
	if gear.ID != "legendary_bow_001" {
		t.Errorf("Expected ID=legendary_bow_001, got %s", gear.ID)
	}
	if gear.DisplayName != "Dragon Bow of Fire" {
		t.Errorf("Expected DisplayName=Dragon Bow of Fire, got %s", gear.DisplayName)
	}
}

func TestMatchBuilderDefaults(t *testing.T) {
	match := NewMatchBuilder().Build()

	// Verify defaults
	if match.Status != "active" {
		t.Errorf("Expected default Status=active, got %s", match.Status)
	}
	if match.CreatorHealth != 100 {
		t.Errorf("Expected default CreatorHealth=100, got %d", match.CreatorHealth)
	}
	if match.OpponentHealth != 100 {
		t.Errorf("Expected default OpponentHealth=100, got %d", match.OpponentHealth)
	}
	if match.Turn != 1 {
		t.Errorf("Expected default Turn=1, got %d", match.Turn)
	}
	if match.MatchID == "" {
		t.Error("Expected MatchID to be generated, got empty string")
	}
	if match.CreatorID == "" {
		t.Error("Expected CreatorID to be generated, got empty string")
	}
	if match.OpponentID == "" {
		t.Error("Expected OpponentID to be generated, got empty string")
	}
}

func TestMatchBuilderWithPlayers(t *testing.T) {
	match := NewMatchBuilder().
		WithPlayers("player1", "player2").
		Build()

	if match.CreatorID != "player1" {
		t.Errorf("Expected CreatorID=player1, got %s", match.CreatorID)
	}
	if match.OpponentID != "player2" {
		t.Errorf("Expected OpponentID=player2, got %s", match.OpponentID)
	}
}

func TestMatchBuilderWithStatus(t *testing.T) {
	tests := []struct {
		name   string
		status string
	}{
		{"Active", "active"},
		{"Completed", "completed"},
		{"Forfeited", "forfeited"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			match := NewMatchBuilder().
				WithStatus(tt.status).
				Build()

			if match.Status != tt.status {
				t.Errorf("Expected Status=%s, got %s", tt.status, match.Status)
			}
		})
	}
}

func TestMatchBuilderWithHealth(t *testing.T) {
	match := NewMatchBuilder().
		WithHealth(75, 50).
		Build()

	if match.CreatorHealth != 75 {
		t.Errorf("Expected CreatorHealth=75, got %d", match.CreatorHealth)
	}
	if match.OpponentHealth != 50 {
		t.Errorf("Expected OpponentHealth=50, got %d", match.OpponentHealth)
	}
}

func TestMatchBuilderWithTurn(t *testing.T) {
	match := NewMatchBuilder().
		WithTurn(7).
		Build()

	if match.Turn != 7 {
		t.Errorf("Expected Turn=7, got %d", match.Turn)
	}
}

func TestMatchBuilderWithID(t *testing.T) {
	match := NewMatchBuilder().
		WithID("custom_match_id").
		Build()

	if match.MatchID != "custom_match_id" {
		t.Errorf("Expected MatchID=custom_match_id, got %s", match.MatchID)
	}
}

func TestMatchBuilderChaining(t *testing.T) {
	match := NewMatchBuilder().
		WithPlayers("player1", "player2").
		WithStatus("active").
		WithHealth(90, 85).
		WithTurn(5).
		WithID("match_123").
		Build()

	if match.CreatorID != "player1" {
		t.Errorf("Expected CreatorID=player1, got %s", match.CreatorID)
	}
	if match.OpponentID != "player2" {
		t.Errorf("Expected OpponentID=player2, got %s", match.OpponentID)
	}
	if match.Status != "active" {
		t.Errorf("Expected Status=active, got %s", match.Status)
	}
	if match.CreatorHealth != 90 {
		t.Errorf("Expected CreatorHealth=90, got %d", match.CreatorHealth)
	}
	if match.OpponentHealth != 85 {
		t.Errorf("Expected OpponentHealth=85, got %d", match.OpponentHealth)
	}
	if match.Turn != 5 {
		t.Errorf("Expected Turn=5, got %d", match.Turn)
	}
	if match.MatchID != "match_123" {
		t.Errorf("Expected MatchID=match_123, got %s", match.MatchID)
	}
}

func TestBuilderIntegration(t *testing.T) {
	// Test creating a complete game scenario with builders
	legendaryBow := *NewGearBuilder().
		WithType("bow").
		WithRarity("legendary").
		WithDisplayName("Dragon Bow").
		Build()

	legendaryArmor := *NewGearBuilder().
		WithType("armor").
		WithRarity("legendary").
		WithDisplayName("Dragon Armor").
		Build()

	player1 := NewPlayerBuilder().
		WithLevel(50).
		WithGear(legendaryBow, legendaryArmor).
		WithID("player1").
		Build()

	player2 := NewPlayerBuilder().
		WithLevel(45).
		WithID("player2").
		Build()

	match := NewMatchBuilder().
		WithPlayers(player1.UserID, player2.UserID).
		WithStatus("active").
		WithHealth(100, 95).
		WithTurn(3).
		Build()

	// Verify the integrated scenario
	if player1.Level != 50 {
		t.Errorf("Expected player1 Level=50, got %d", player1.Level)
	}
	if len(player1.Gear) != 2 {
		t.Errorf("Expected player1 to have 2 gear items, got %d", len(player1.Gear))
	}
	if player2.Level != 45 {
		t.Errorf("Expected player2 Level=45, got %d", player2.Level)
	}
	if match.CreatorID != player1.UserID {
		t.Errorf("Expected match CreatorID=%s, got %s", player1.UserID, match.CreatorID)
	}
	if match.OpponentID != player2.UserID {
		t.Errorf("Expected match OpponentID=%s, got %s", player2.UserID, match.OpponentID)
	}
}
