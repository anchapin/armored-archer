package season_test

import (
	"testing"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/season"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestNewSeasonInfo(t *testing.T) {
	now := time.Now().UnixMilli()
	season := season.NewSeasonInfo(1, now, now+season.DefaultSeasonDurationMs)

	testhelpers.AssertEqual(t, "season_1", season.SeasonID, "SeasonID should match")
	testhelpers.AssertEqual(t, 1, season.SeasonNumber, "SeasonNumber should match")
	testhelpers.AssertEqual(t, now, season.StartTime, "StartTime should match")
	testhelpers.AssertEqual(t, season.SeasonStatusActive, season.Status, "Status should be active")
}

func TestGetCurrentSeason(t *testing.T) {
	seasonInfo := season.GetCurrentSeason()

	testhelpers.AssertTrue(t, len(seasonInfo.SeasonID) > 0, "SeasonID should not be empty")
	testhelpers.AssertTrue(t, seasonInfo.SeasonNumber > 0, "SeasonNumber should be positive")
	testhelpers.AssertTrue(t, seasonInfo.StartTime > 0, "StartTime should be positive")
	testhelpers.AssertTrue(t, seasonInfo.EndTime > seasonInfo.StartTime, "EndTime should be after StartTime")
}

func TestSeasonInfoGetTimeRemaining(t *testing.T) {
	now := time.Now().UnixMilli()
	seasonInfo := season.NewSeasonInfo(1, now, now+100000) // Ends in 100 seconds

	remaining := seasonInfo.GetTimeRemaining()
	testhelpers.AssertTrue(t, remaining > 0, "Should have time remaining")
	testhelpers.AssertTrue(t, remaining <= 100000, "Should be less than or equal to duration")
}

func TestSeasonInfoIsExpired(t *testing.T) {
	now := time.Now().UnixMilli()
	
	// Future season (not expired)
	seasonInfo := season.NewSeasonInfo(1, now, now+100000)
	testhelpers.AssertFalse(t, seasonInfo.IsExpired(), "Should not be expired")

	// Past season (expired)
	seasonInfo = season.NewSeasonInfo(1, now-200000, now-100000)
	testhelpers.AssertTrue(t, seasonInfo.IsExpired(), "Should be expired")
}

func TestGetRankTier(t *testing.T) {
	tests := []struct {
		score    int
		expected string
	}{
		{500, season.RankTierCommon},
		{1399, season.RankTierCommon},
		{1400, season.RankTierUncommon},
		{1599, season.RankTierUncommon},
		{1600, season.RankTierRare},
		{1799, season.RankTierRare},
		{1800, season.RankTierEpic},
		{1999, season.RankTierEpic},
		{2000, season.RankTierLegendary},
		{3000, season.RankTierLegendary},
	}

	for _, tt := range tests {
		tier := season.GetRankTier(tt.score)
		testhelpers.AssertEqual(t, tt.expected, tier,
			fmt.Sprintf(""Tier for score %d", tt.score))
	}
}

func TestGetRewardsForTier(t *testing.T) {
	tests := []struct {
		tier     string
		minCoins int
		minGems  int
	}{
		{season.RankTierCommon, 500, 25},
		{season.RankTierUncommon, 1000, 50},
		{season.RankTierRare, 2500, 100},
		{season.RankTierEpic, 5000, 250},
		{season.RankTierLegendary, 10000, 500},
	}

	for _, tt := range tests {
		rewards := season.GetRewardsForTier(tt.tier)
		testhelpers.AssertEqual(t, tt.tier, rewards.RankTier, "Tier should match")
		testhelpers.AssertTrue(t, rewards.Coins >= tt.minCoins, "Coins should be at least "+fmt.Sprintf(""%d", tt.minCoins))
		testhelpers.AssertTrue(t, rewards.Gems >= tt.minGems, "Gems should be at least "+fmt.Sprintf(""%d", tt.minGems))
	}
}

func TestCalculateSeasonRewards(t *testing.T) {
	// High rank should give better rewards
	highRewards := season.CalculateSeasonRewards(1, 2000)
	lowRewards := season.CalculateSeasonRewards(100, 500)

	testhelpers.AssertTrue(t, highRewards.Coins > lowRewards.Coins,
		"Higher rank should give more coins")
	testhelpers.AssertTrue(t, highRewards.Gems > lowRewards.Gems,
		"Higher rank should give more gems")
}

func TestApplyRankDecay(t *testing.T) {
	// No decay for active players
	score := season.ApplyRankDecay(1000, 3)
	testhelpers.AssertEqual(t, 1000, score, "Should not decay for active players")

	// Decay for inactive players
	score = season.ApplyRankDecay(1000, 14) // 2 weeks inactive
	testhelpers.AssertTrue(t, score < 1000, "Should decay for inactive players")
	testhelpers.AssertTrue(t, score >= season.RankDecayMinScore, "Should not decay below minimum")
}

func TestGetDaysInactive(t *testing.T) {
	now := time.Now().UnixMilli()
	
	// Active player (today)
	days := season.GetDaysInactive(now)
	testhelpers.AssertEqual(t, 0, days, "Should be 0 days inactive")

	// Inactive player (1 week ago)
	days = season.GetDaysInactive(now - 7*24*60*60*1000)
	testhelpers.AssertEqual(t, 7, days, "Should be 7 days inactive")
}

func TestSeasonInfoToJSON(t *testing.T) {
	seasonInfo := season.NewSeasonInfo(1, time.Now().UnixMilli(), time.Now().UnixMilli()+100000)

	jsonStr, err := seasonInfo.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := season.SeasonInfoFromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, seasonInfo.SeasonID, restored.SeasonID, "SeasonID should match")
}

func TestLeaderboardEntryToJSON(t *testing.T) {
	entry := season.NewLeaderboardEntry("user123", "Player1", 1000, 5)
	entry.Meta.Wins = 10
	entry.Meta.Losses = 5

	jsonStr, err := entry.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := season.LeaderboardEntryFromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, entry.OwnerID, restored.OwnerID, "OwnerID should match")
}

func TestSeasonRewardsToJSON(t *testing.T) {
	rewards := season.GetRewardsForTier(season.RankTierLegendary)

	jsonStr, err := rewards.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestSeasonInfoValidate(t *testing.T) {
	// Valid season info
	seasonInfo := season.NewSeasonInfo(1, time.Now().UnixMilli(), time.Now().UnixMilli()+100000)
	err := seasonInfo.Validate()
	testhelpers.AssertNoError(t, err, "Valid season should pass validation")

	// Invalid: empty season ID
	seasonInfo.SeasonID = ""
	err = seasonInfo.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty season ID")

	// Invalid: start after end
	seasonInfo.SeasonID = "season_1"
	seasonInfo.StartTime = 2000
	seasonInfo.EndTime = 1000
	err = seasonInfo.Validate()
	testhelpers.AssertError(t, err, "Should fail with start after end")

	// Invalid: invalid status
	seasonInfo.StartTime = 1000
	seasonInfo.EndTime = 2000
	seasonInfo.Status = "invalid"
	err = seasonInfo.Validate()
	testhelpers.AssertError(t, err, "Should fail with invalid status")
}

func TestGetSeasonNumberFromID(t *testing.T) {
	num, err := season.GetSeasonNumberFromID("season_5")
	testhelpers.AssertNoError(t, err, "Should parse valid season ID")
	testhelpers.AssertEqual(t, 5, num, "Season number should be 5")

	_, err = season.GetSeasonNumberFromID("invalid")
	testhelpers.AssertError(t, err, "Should fail with invalid season ID")
}

func TestGenerateSeasonID(t *testing.T) {
	seasonID := season.GenerateSeasonID(5)
	testhelpers.AssertEqual(t, "season_5", seasonID, "Season ID should match")
}

func TestGetNextSeason(t *testing.T) {
	current := season.NewSeasonInfo(1, 1000, 2000)
	next := season.GetNextSeason(current)

	testhelpers.AssertEqual(t, 2, next.SeasonNumber, "Next season number should be 2")
	testhelpers.AssertEqual(t, current.EndTime, next.StartTime, "Next season should start when current ends")
}

func TestGetPreviousSeason(t *testing.T) {
	current := season.NewSeasonInfo(2, 2000, 3000)
	prev := season.GetPreviousSeason(current)

	testhelpers.AssertNotNil(t, prev, "Previous season should exist")
	testhelpers.AssertEqual(t, 1, prev.SeasonNumber, "Previous season number should be 1")

	// First season has no previous
	first := season.NewSeasonInfo(1, 1000, 2000)
	prev = season.GetPreviousSeason(first)
	testhelpers.AssertNil(t, prev, "First season should have no previous")
}

func TestIsSeasonActive(t *testing.T) {
	now := time.Now().UnixMilli()
	
	// Active season
	activeSeason := season.NewSeasonInfo(1, now-1000, now+1000)
	testhelpers.AssertTrue(t, season.IsSeasonActive(activeSeason), "Should be active")

	// Future season
	futureSeason := season.NewSeasonInfo(2, now+1000, now+2000)
	testhelpers.AssertFalse(t, season.IsSeasonActive(futureSeason), "Should not be active (future)")

	// Past season
	pastSeason := season.NewSeasonInfo(0, now-2000, now-1000)
	testhelpers.AssertFalse(t, season.IsSeasonActive(pastSeason), "Should not be active (past)")
}

func TestGetWinRate(t *testing.T) {
	winRate := season.GetWinRate(5, 5)
	testhelpers.AssertEqual(t, 50.0, winRate, "Win rate should be 50%")

	winRate = season.GetWinRate(10, 0)
	testhelpers.AssertEqual(t, 100.0, winRate, "Win rate should be 100%")

	winRate = season.GetWinRate(0, 0)
	testhelpers.AssertEqual(t, 0.0, winRate, "Win rate should be 0% with no games")
}

func TestUpdateWinLoss(t *testing.T) {
	entry := season.NewLeaderboardEntry("user123", "Player1", 1000, 5)

	entry.UpdateWinLoss(true)
	testhelpers.AssertEqual(t, 1, entry.Meta.Wins, "Wins should be 1")
	testhelpers.AssertTrue(t, entry.Meta.WinRate > 0, "Win rate should be positive")

	entry.UpdateWinLoss(false)
	testhelpers.AssertEqual(t, 1, entry.Meta.Wins, "Wins should still be 1")
	testhelpers.AssertEqual(t, 1, entry.Meta.Losses, "Losses should be 1")
}

func TestRecordPunchUpWin(t *testing.T) {
	entry := season.NewLeaderboardEntry("user123", "Player1", 1000, 5)

	entry.RecordPunchUpWin()
	testhelpers.AssertEqual(t, 1, entry.Meta.PunchUpWins, "Punch-up wins should be 1")
}

func TestLeaderboardEntriesToJSON(t *testing.T) {
	entries := []*season.LeaderboardEntry{
		season.NewLeaderboardEntry("user1", "Player1", 1000, 1),
		season.NewLeaderboardEntry("user2", "Player2", 1200, 2),
	}

	jsonStr, err := season.LeaderboardEntriesToJSON(entries)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestSeasonInfosToJSON(t *testing.T) {
	infos := []*season.SeasonInfo{
		season.NewSeasonInfo(1, 1000, 2000),
		season.NewSeasonInfo(2, 2000, 3000),
	}

	jsonStr, err := season.SeasonInfosToJSON(infos)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestGetSeasonInfoResultToJSON(t *testing.T) {
	result := &season.GetSeasonInfoResult{
		Success:       true,
		Season:        season.NewSeasonInfo(1, 1000, 2000),
		PlayerScore:   1000,
		TimeRemaining: 500,
	}

	jsonStr, err := season.GetSeasonInfoResultToJSON(result)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestGetLeaderboardResultToJSON(t *testing.T) {
	result := &season.GetLeaderboardResult{
		Success: true,
		Entries: []*season.LeaderboardEntry{
			season.NewLeaderboardEntry("user1", "Player1", 1000, 1),
		},
		Total: 1,
	}

	jsonStr, err := season.GetLeaderboardResultToJSON(result)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}
