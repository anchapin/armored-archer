package matchmaking_test

import (
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/matchmaking"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestNewPvPMatch(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)

	testhelpers.AssertTrue(t, len(match.MatchID) > 0, "MatchID should not be empty")
	testhelpers.AssertEqual(t, "creator1", match.CreatorID, "CreatorID should match")
	testhelpers.AssertEqual(t, "opponent1", match.OpponentID, "OpponentID should match")
	testhelpers.AssertEqual(t, 100, match.CreatorRank, "CreatorRank should match")
	testhelpers.AssertEqual(t, 150, match.OpponentRank, "OpponentRank should match")
	testhelpers.AssertEqual(t, matchmaking.MatchTypeRanked, match.MatchType, "MatchType should match")
	testhelpers.AssertEqual(t, matchmaking.MatchStatusPending, match.Status, "Status should be pending")
	testhelpers.AssertFalse(t, match.IsPunchUp, "Should not be punch-up")
}

func TestPvPMatchAccept(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)

	testhelpers.AssertEqual(t, matchmaking.MatchStatusPending, match.Status,
		"Initial status should be pending")

	match.Accept()
	testhelpers.AssertEqual(t, matchmaking.MatchStatusActive, match.Status,
		"Status should be active after accept")
}

func TestPvPMatchComplete(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)
	match.Accept()

	testhelpers.AssertEqual(t, matchmaking.MatchStatusActive, match.Status,
		"Status should be active")

	match.Complete("creator1")
	testhelpers.AssertEqual(t, matchmaking.MatchStatusCompleted, match.Status,
		"Status should be completed")
	testhelpers.AssertEqual(t, "creator1", match.Winner, "Winner should be creator1")
}

func TestPvPMatchIsExpired(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)

	testhelpers.AssertFalse(t, match.IsExpired(), "Should not be expired initially")

	// Simulate expiration by setting old timestamp
	match.ExpiresAt = 0
	testhelpers.AssertTrue(t, match.IsExpired(), "Should be expired with old timestamp")
}

func TestPvPMatchExpire(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)

	match.Expire()
	testhelpers.AssertEqual(t, matchmaking.MatchStatusExpired, match.Status,
		"Status should be expired")
}

func TestPvPMatchCanAccept(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)

	// Opponent can accept
	testhelpers.AssertTrue(t, match.CanAccept("opponent1"), "Opponent should be able to accept")

	// Creator cannot accept
	testhelpers.AssertFalse(t, match.CanAccept("creator1"), "Creator should not be able to accept")

	// After accepting, no one can accept
	match.Accept()
	testhelpers.AssertFalse(t, match.CanAccept("opponent1"), "Should not be able to accept after accept")
}

func TestPvPMatchCanComplete(t *testing.T) {
	match := matchmaking.NewPvPMatch("creator1", "opponent1", 100, 150,
		matchmaking.MatchTypeRanked, false)

	// Cannot complete when pending
	testhelpers.AssertFalse(t, match.CanComplete("creator1"), "Should not be able to complete when pending")

	match.Accept()

	// Can complete when active
	testhelpers.AssertTrue(t, match.CanComplete("creator1"), "Creator should be able to complete")
	testhelpers.AssertTrue(t, match.CanComplete("opponent1"), "Opponent should be able to complete")

	// Third party cannot complete
	testhelpers.AssertFalse(t, match.CanComplete("third_party"), "Third party should not be able to complete")
}

func TestCalculateRank(t *testing.T) {
	// Test base rank from level
	rank := matchmaking.CalculateRank(10, 0, 0)
	testhelpers.AssertTrue(t, rank >= 100, "Base rank should be at least 100")

	// Test with 50% win rate
	rank = matchmaking.CalculateRank(10, 5, 5)
	testhelpers.AssertTrue(t, rank >= 95 && rank <= 105, "50% win rate should give ~base rank")

	// Test with 100% win rate
	rank = matchmaking.CalculateRank(10, 10, 0)
	testhelpers.AssertTrue(t, rank > 100, "100% win rate should give higher rank")

	// Test with 0% win rate
	rank = matchmaking.CalculateRank(10, 0, 10)
	testhelpers.AssertTrue(t, rank < 100, "0% win rate should give lower rank")
}

func TestCalculateEloChange(t *testing.T) {
	// Test even match (same elo)
	winnerChange, loserChange := matchmaking.CalculateEloChange(1000, 1000, false)
	testhelpers.AssertTrue(t, winnerChange > 0, "Winner should gain elo")
	testhelpers.AssertTrue(t, loserChange < 0, "Loser should lose elo")
	testhelpers.AssertTrue(t, winnerChange == -loserChange, "Changes should be symmetric")

	// Test punch-up (underdog wins)
	winnerChange, loserChange = matchmaking.CalculateEloChange(1000, 1200, true)
	testhelpers.AssertTrue(t, winnerChange > 16, "Underdog winner should gain more elo")
}

func TestFilterMatches(t *testing.T) {
	matches := []*matchmaking.PvPMatch{
		matchmaking.NewPvPMatch("c1", "o1", 100, 150, matchmaking.MatchTypeRanked, false),
		matchmaking.NewPvPMatch("c2", "o2", 200, 250, matchmaking.MatchTypeCasual, false),
		matchmaking.NewPvPMatch("c3", "o3", 300, 350, matchmaking.MatchTypeRanked, false),
	}

	// Filter by match type
	filtered := matchmaking.FilterMatches(matches, matchmaking.MatchTypeRanked, 0, 0)
	testhelpers.AssertEqual(t, 2, len(filtered), "Should have 2 ranked matches")

	// Filter by min rank
	filtered = matchmaking.FilterMatches(matches, "", 200, 0)
	testhelpers.AssertEqual(t, 1, len(filtered), "Should have 1 match with min rank 200")

	// Filter by max rank
	filtered = matchmaking.FilterMatches(matches, "", 0, 150)
	testhelpers.AssertEqual(t, 1, len(filtered), "Should have 1 match with max rank 150")
}

func TestSortMatchesByCreatedAt(t *testing.T) {
	matches := []*matchmaking.PvPMatch{
		matchmaking.NewPvPMatch("c1", "o1", 100, 150, matchmaking.MatchTypeRanked, false),
		matchmaking.NewPvPMatch("c2", "o2", 200, 250, matchmaking.MatchTypeRanked, false),
	}

	// Modify creation times
	matches[0].CreatedAt = 1000
	matches[1].CreatedAt = 2000

	matchmaking.SortMatchesByCreatedAt(matches)

	testhelpers.AssertTrue(t, matches[0].CreatedAt > matches[1].CreatedAt,
		"Should be sorted by creation time (newest first)")
}

func TestGetActiveMatchForUser(t *testing.T) {
	matches := []*matchmaking.PvPMatch{
		matchmaking.NewPvPMatch("c1", "o1", 100, 150, matchmaking.MatchTypeRanked, false),
		matchmaking.NewPvPMatch("c2", "o2", 200, 250, matchmaking.MatchTypeRanked, false),
	}
	matches[0].Accept()

	activeMatch := matchmaking.GetActiveMatchForUser(matches, "c1")
	testhelpers.AssertNotNil(t, activeMatch, "Should find active match")
	testhelpers.AssertEqual(t, "c1", activeMatch.CreatorID, "Should be correct match")
}

func TestGetPendingMatchesForUser(t *testing.T) {
	matches := []*matchmaking.PvPMatch{
		matchmaking.NewPvPMatch("c1", "o1", 100, 150, matchmaking.MatchTypeRanked, false),
		matchmaking.NewPvPMatch("c2", "o2", 200, 250, matchmaking.MatchTypeRanked, false),
	}

	pending := matchmaking.GetPendingMatchesForUser(matches, "o1")
	testhelpers.AssertEqual(t, 1, len(pending), "Should have 1 pending match")
	testhelpers.AssertEqual(t, "o1", pending[0].OpponentID, "Should be correct match")
}

func TestIsPunchUp(t *testing.T) {
	// Not punch-up (similar ranks)
	testhelpers.AssertFalse(t, matchmaking.IsPunchUp(100, 120), "Should not be punch-up")

	// Punch-up (opponent much higher)
	testhelpers.AssertTrue(t, matchmaking.IsPunchUp(100, 200), "Should be punch-up")
}

func TestGetRankFromElo(t *testing.T) {
	tests := []struct {
		elo      int
		expected int
	}{
		{500, 5},    // Unranked
		{1000, 10},  // Unranked
		{1200, 6},   // Bronze
		{1400, 7},   // Silver
		{1600, 8},   // Gold
		{1800, 9},   // Platinum
		{2000, 10},  // Diamond
		{2200, 10},  // Master
	}

	for _, tt := range tests {
		rank := matchmaking.GetRankFromElo(tt.elo)
		testhelpers.AssertEqual(t, tt.expected, rank,
			tt.name(t, "Rank for ELO %d", tt.elo))
	}
}

func TestPlayerRanking(t *testing.T) {
	ranking := matchmaking.NewPlayerRanking("user123", "Player1", 1000, 5)
	ranking.UpdateWinLoss(true, 16)

	testhelpers.AssertEqual(t, 1016, ranking.Elo, "Elo should increase on win")
	testhelpers.AssertEqual(t, 1, ranking.Wins, "Wins should be 1")
	testhelpers.AssertEqual(t, 0, ranking.Losses, "Losses should be 0")

	ranking.UpdateWinLoss(false, -16)
	testhelpers.AssertEqual(t, 1000, ranking.Elo, "Elo should return to original")
	testhelpers.AssertEqual(t, 1, ranking.Wins, "Wins should be 1")
	testhelpers.AssertEqual(t, 1, ranking.Losses, "Losses should be 1")
}

func TestGetWinRate(t *testing.T) {
	ranking := &matchmaking.PlayerRanking{Wins: 5, Losses: 5}
	winRate := ranking.GetWinRate()
	testhelpers.AssertEqual(t, 50.0, winRate, "Win rate should be 50%")

	ranking.Wins = 10
	ranking.Losses = 0
	winRate = ranking.GetWinRate()
	testhelpers.AssertEqual(t, 100.0, winRate, "Win rate should be 100%")

	ranking.Wins = 0
	ranking.Losses = 0
	winRate = ranking.GetWinRate()
	testhelpers.AssertEqual(t, 0.0, winRate, "Win rate should be 0% with no games")
}

func TestMatchRecord(t *testing.T) {
	record := matchmaking.NewMatchRecord("user123", "match123",
		matchmaking.MatchTypeRanked, matchmaking.MatchResultWin, 100,
		"opponent1", 300)

	testhelpers.AssertEqual(t, "user123", record.UserID, "UserID should match")
	testhelpers.AssertEqual(t, "match123", record.MatchID, "MatchID should match")
	testhelpers.AssertEqual(t, matchmaking.MatchTypeRanked, record.MatchType, "MatchType should match")
	testhelpers.AssertEqual(t, matchmaking.MatchResultWin, record.Result, "Result should match")
}

func TestMatchRecordValidate(t *testing.T) {
	record := &matchmaking.MatchRecord{
		MatchID:   "match123",
		UserID:    "user123",
		MatchType: matchmaking.MatchTypeRanked,
		Result:    matchmaking.MatchResultWin,
	}

	err := record.Validate()
	testhelpers.AssertNoError(t, err, "Valid record should pass validation")

	record.MatchID = ""
	err = record.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty match ID")

	record.MatchID = "match123"
	record.UserID = ""
	err = record.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty user ID")

	record.UserID = "user123"
	record.MatchType = ""
	err = record.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty match type")

	record.MatchType = matchmaking.MatchTypeRanked
	record.Result = ""
	err = record.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty result")
}

func TestFilterByMatchType(t *testing.T) {
	records := []*matchmaking.MatchRecord{
		{MatchType: matchmaking.MatchTypeRanked},
		{MatchType: matchmaking.MatchTypeCasual},
		{MatchType: matchmaking.MatchTypeRanked},
	}

	filtered := matchmaking.FilterByMatchType(records, matchmaking.MatchTypeRanked)
	testhelpers.AssertEqual(t, 2, len(filtered), "Should have 2 ranked matches")
}

func TestFilterByResult(t *testing.T) {
	records := []*matchmaking.MatchRecord{
		{Result: matchmaking.MatchResultWin},
		{Result: matchmaking.MatchResultLoss},
		{Result: matchmaking.MatchResultWin},
	}

	filtered := matchmaking.FilterByResult(records, matchmaking.MatchResultWin)
	testhelpers.AssertEqual(t, 2, len(filtered), "Should have 2 wins")
}

func TestGetWinLossRecord(t *testing.T) {
	records := []*matchmaking.MatchRecord{
		{Result: matchmaking.MatchResultWin},
		{Result: matchmaking.MatchResultLoss},
		{Result: matchmaking.MatchResultWin},
		{Result: matchmaking.MatchResultAbandoned},
	}

	wins, losses := matchmaking.GetWinLossRecord(records)
	testhelpers.AssertEqual(t, 2, wins, "Should have 2 wins")
	testhelpers.AssertEqual(t, 2, losses, "Should have 2 losses (including abandoned)")
}

func TestCalculateWinRate(t *testing.T) {
	winRate := matchmaking.CalculateWinRate(5, 5)
	testhelpers.AssertEqual(t, 50.0, winRate, "Win rate should be 50%")

	winRate = matchmaking.CalculateWinRate(10, 0)
	testhelpers.AssertEqual(t, 100.0, winRate, "Win rate should be 100%")

	winRate = matchmaking.CalculateWinRate(0, 0)
	testhelpers.AssertEqual(t, 0.0, winRate, "Win rate should be 0% with no games")
}

func TestSortByTimestamp(t *testing.T) {
	records := []*matchmaking.MatchRecord{
		{Timestamp: 1000},
		{Timestamp: 3000},
		{Timestamp: 2000},
	}

	matchmaking.SortByTimestamp(records)

	testhelpers.AssertTrue(t, records[0].Timestamp >= records[1].Timestamp,
		"Should be sorted by timestamp (newest first)")
}
