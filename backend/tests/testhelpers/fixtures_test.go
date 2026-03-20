package testhelpers

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNewTestPlayer(t *testing.T) {
	player := NewTestPlayer()

	assert.NotNil(t, player)
	assert.Equal(t, 1, player.Level)
	assert.Equal(t, 0, player.XP)
	assert.Equal(t, 10, player.Attack)
	assert.Equal(t, 10, player.Defense)
	assert.NotEmpty(t, player.UserID)
}

func TestNewTestPlayerWithLevel(t *testing.T) {
	player := NewTestPlayerWithLevel(10)

	assert.NotNil(t, player)
	assert.Equal(t, 10, player.Level)
	assert.Equal(t, 20, player.Attack)
	assert.Equal(t, 20, player.Defense)
}

func TestNewTestPlayerWithStats(t *testing.T) {
	player := NewTestPlayerWithStats(15, 20, 10, 5)

	assert.NotNil(t, player)
	assert.Equal(t, 15, player.Attack)
	assert.Equal(t, 20, player.Defense)
	assert.Equal(t, 10, player.Dodge)
	assert.Equal(t, 5, player.CritRate)
}

func TestNewTestGear(t *testing.T) {
	gear := NewTestGear()

	assert.NotNil(t, gear)
	assert.Equal(t, "bow", gear.Type)
	assert.Equal(t, "common", gear.Rarity)
	assert.Equal(t, 5, gear.Attack)
	assert.NotEmpty(t, gear.ID)
}

func TestNewTestGearWithType(t *testing.T) {
	gear := NewTestGearWithType("bow", "epic")

	assert.NotNil(t, gear)
	assert.Equal(t, "bow", gear.Type)
	assert.Equal(t, "epic", gear.Rarity)
	assert.Equal(t, 15, gear.Attack)
}

func TestNewTestMatch(t *testing.T) {
	match := NewTestMatch()

	assert.NotNil(t, match)
	assert.Equal(t, "active", match.Status)
	assert.Equal(t, 100, match.CreatorHealth)
	assert.Equal(t, 100, match.OpponentHealth)
	assert.Equal(t, 1, match.Turn)
	assert.NotEmpty(t, match.MatchID)
}

func TestNewTestMatchWithPlayers(t *testing.T) {
	match := NewTestMatchWithPlayers("player1", "player2")

	assert.NotNil(t, match)
	assert.Equal(t, "player1", match.CreatorID)
	assert.Equal(t, "player2", match.OpponentID)
}

func TestNewTestMatchWithStatus(t *testing.T) {
	match := NewTestMatchWithStatus("completed")

	assert.NotNil(t, match)
	assert.Equal(t, "completed", match.Status)
}
