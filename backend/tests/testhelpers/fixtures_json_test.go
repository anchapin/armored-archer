package testhelpers

import (
	"encoding/json"
	"testing"
	"time"
)

func TestPlayerJSONSerialization(t *testing.T) {
	// Create a test player
	player := NewTestPlayerWithLevel(10)
	player.UserID = "player123"

	// Test toJSON
	jsonStr := player.toJSON()
	if jsonStr == "" {
		t.Error("toJSON returned empty string")
	}

	// Test fromJSON round-trip
	newPlayer := &TestPlayer{}
	err := newPlayer.fromJSON(jsonStr)
	if err != nil {
		t.Fatalf("fromJSON failed: %v", err)
	}

	// Verify all fields match
	if newPlayer.UserID != player.UserID {
		t.Errorf("UserID mismatch: got %s, want %s", newPlayer.UserID, player.UserID)
	}
	if newPlayer.Level != player.Level {
		t.Errorf("Level mismatch: got %d, want %d", newPlayer.Level, player.Level)
	}
	if newPlayer.Attack != player.Attack {
		t.Errorf("Attack mismatch: got %d, want %d", newPlayer.Attack, player.Attack)
	}
	if newPlayer.Defense != player.Defense {
		t.Errorf("Defense mismatch: got %d, want %d", newPlayer.Defense, player.Defense)
	}
	// Allow small time difference for serialization
	timeDiff := newPlayer.CreatedAt.Sub(player.CreatedAt)
	if timeDiff < 0 {
		timeDiff = -timeDiff
	}
	if timeDiff > time.Second {
		t.Errorf("CreatedAt mismatch: got %v, want %v", newPlayer.CreatedAt, player.CreatedAt)
	}
}

func TestGearJSONSerialization(t *testing.T) {
	// Create a test gear
	gear := NewTestGearWithType("bow", "epic")
	gear.ID = "gear123"

	// Test toJSON
	jsonStr := gear.toJSON()
	if jsonStr == "" {
		t.Error("toJSON returned empty string")
	}

	// Test fromJSON round-trip
	newGear := &TestGear{}
	err := newGear.fromJSON(jsonStr)
	if err != nil {
		t.Fatalf("fromJSON failed: %v", err)
	}

	// Verify all fields match
	if newGear.ID != gear.ID {
		t.Errorf("ID mismatch: got %s, want %s", newGear.ID, gear.ID)
	}
	if newGear.Type != gear.Type {
		t.Errorf("Type mismatch: got %s, want %s", newGear.Type, gear.Type)
	}
	if newGear.Rarity != gear.Rarity {
		t.Errorf("Rarity mismatch: got %s, want %s", newGear.Rarity, gear.Rarity)
	}
	if newGear.Attack != gear.Attack {
		t.Errorf("Attack mismatch: got %d, want %d", newGear.Attack, gear.Attack)
	}
}

func TestMatchJSONSerialization(t *testing.T) {
	// Create a test match
	match := NewTestMatchWithPlayers("player1", "player2")
	match.MatchID = "match123"
	match.Status = "active"

	// Test toJSON
	jsonStr := match.toJSON()
	if jsonStr == "" {
		t.Error("toJSON returned empty string")
	}

	// Test fromJSON round-trip
	newMatch := &TestMatch{}
	err := newMatch.fromJSON(jsonStr)
	if err != nil {
		t.Fatalf("fromJSON failed: %v", err)
	}

	// Verify all fields match
	if newMatch.MatchID != match.MatchID {
		t.Errorf("MatchID mismatch: got %s, want %s", newMatch.MatchID, match.MatchID)
	}
	if newMatch.CreatorID != match.CreatorID {
		t.Errorf("CreatorID mismatch: got %s, want %s", newMatch.CreatorID, match.CreatorID)
	}
	if newMatch.OpponentID != match.OpponentID {
		t.Errorf("OpponentID mismatch: got %s, want %s", newMatch.OpponentID, match.OpponentID)
	}
	if newMatch.Status != match.Status {
		t.Errorf("Status mismatch: got %s, want %s", newMatch.Status, match.Status)
	}
}

func TestPlayerMarshalJSON(t *testing.T) {
	player := NewTestPlayerWithLevel(5)
	player.UserID = "test_player"

	// Test MarshalJSON
	data, err := json.Marshal(player)
	if err != nil {
		t.Fatalf("MarshalJSON failed: %v", err)
	}

	// Verify it's valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Check that CreatedAt field exists
	if _, ok := parsed["CreatedAt"]; !ok {
		t.Error("CreatedAt field not found in JSON")
	}

	// Verify UserID exists (Go uses field names by default)
	if parsed["UserID"] != "test_player" {
		t.Errorf("UserID mismatch: got %v, want test_player", parsed["UserID"])
	}
}

func TestGearMarshalJSON(t *testing.T) {
	gear := NewTestGearWithType("armor", "legendary")
	gear.ID = "test_gear"

	// Test MarshalJSON
	data, err := json.Marshal(gear)
	if err != nil {
		t.Fatalf("MarshalJSON failed: %v", err)
	}

	// Verify it's valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Verify fields (Go uses field names by default)
	if parsed["ID"] != "test_gear" {
		t.Errorf("ID mismatch: got %v, want test_gear", parsed["ID"])
	}
	if parsed["Type"] != "armor" {
		t.Errorf("Type mismatch: got %v, want armor", parsed["Type"])
	}
	if parsed["Rarity"] != "legendary" {
		t.Errorf("Rarity mismatch: got %v, want legendary", parsed["Rarity"])
	}
}

func TestMatchMarshalJSON(t *testing.T) {
	match := NewTestMatchWithPlayers("creator", "opponent")
	match.MatchID = "test_match"
	match.Status = "completed"

	// Test MarshalJSON
	data, err := json.Marshal(match)
	if err != nil {
		t.Fatalf("MarshalJSON failed: %v", err)
	}

	// Verify it's valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Verify fields (Go uses field names by default)
	if parsed["MatchID"] != "test_match" {
		t.Errorf("MatchID mismatch: got %v, want test_match", parsed["MatchID"])
	}
	if parsed["CreatorID"] != "creator" {
		t.Errorf("CreatorID mismatch: got %v, want creator", parsed["CreatorID"])
	}
	if parsed["Status"] != "completed" {
		t.Errorf("Status mismatch: got %v, want completed", parsed["Status"])
	}
}
