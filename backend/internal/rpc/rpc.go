// Package rpc provides RPC handler implementations for the Armored Archer backend.
package rpc

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// GetPlayerStats retrieves player statistics.
func GetPlayerStats(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetPlayerStats called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}
	if userID == "" {
		return errorResponse(false, "Invalid user ID", nil)
	}

	// Query player stats from database
	query := `SELECT level, experience, ability_points, stats FROM player_stats WHERE user_id = $1`

	var level int
	var experience int64
	var abilityPoints int
	var stats string

	err = db.QueryRowContext(ctx, query, userID).Scan(&level, &experience, &abilityPoints, &stats)

	if err == sql.ErrNoRows {
		// No stats found - create default stats for new player
		logger.Info("No stats found for user %s, creating default stats", userID)

		insertQuery := `
			INSERT INTO player_stats (user_id, level, experience, ability_points, stats)
			VALUES ($1, 1, 0, 0, '{}')
			RETURNING level, experience, ability_points, stats
		`

		err = db.QueryRowContext(ctx, insertQuery, userID).Scan(&level, &experience, &abilityPoints, &stats)
		if err != nil {
			logger.Error("Failed to create default player stats: %v", err)
			return errorResponse(false, "Failed to create player stats", err)
		}
	} else if err != nil {
		logger.Error("Failed to query player stats: %v", err)
		return errorResponse(false, "Failed to retrieve player stats", err)
	}

	// Parse stats JSON
	var statsMap map[string]interface{}
	if err := json.Unmarshal([]byte(stats), &statsMap); err != nil {
		logger.Warn("Failed to parse stats JSON, using empty map: %v", err)
		statsMap = make(map[string]interface{})
	}

	// Return response
	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"user_id":         userID,
			"level":           level,
			"experience":      experience,
			"ability_points":  abilityPoints,
			"stats":           statsMap,
		},
	}

	return jsonResponse(response)
}

// ReportPlayer submits a player report.
func ReportPlayer(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("ReportPlayer called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetPlayerReports retrieves reports for a player.
func GetPlayerReports(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetPlayerReports called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GainXP awards XP to a player.
func GainXP(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GainXP called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// AllocateStats allocates stat points for a player.
func AllocateStats(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("AllocateStats called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// ListMatches lists available matches.
func ListMatches(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("ListMatches called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// CreateMatch creates a new match.
func CreateMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("CreateMatch called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// AcceptMatch accepts a match invitation.
func AcceptMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("AcceptMatch called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetPlayerRank retrieves a player's rank.
func GetPlayerRank(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetPlayerRank called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// CompleteMatch completes a match and processes rewards.
func CompleteMatch(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("CompleteMatch called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// SubmitCombatAction submits a combat action.
func SubmitCombatAction(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("SubmitCombatAction called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetMatchState retrieves the current match state.
func GetMatchState(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetMatchState called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// PlayerDisconnect handles a player disconnect.
func PlayerDisconnect(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("PlayerDisconnect called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetSeasonInfo retrieves season information.
func GetSeasonInfo(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetSeasonInfo called with payload: %s", payload)

	// Parse request for optional season_id
	var req struct {
		SeasonID *int `json:"season_id"`
	}

	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse get season info request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Default to season 1 if not specified
	seasonID := 1
	if req.SeasonID != nil {
		seasonID = *req.SeasonID
	}

	// For now, return hardcoded season information
	// Future: Query from seasons table when schema is added
	seasonStart := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
	seasonEnd := time.Date(2024, 12, 31, 23, 59, 59, 0, time.UTC)
	now := time.Now().UTC()

	daysRemaining := int(seasonEnd.Sub(now).Hours() / 24)
	isActive := now.After(seasonStart) && now.Before(seasonEnd)

	if daysRemaining < 0 {
		daysRemaining = 0
	}

	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"season_id":      seasonID,
			"name":           fmt.Sprintf("Season %d", seasonID),
			"starts_at":      seasonStart.Format(time.RFC3339),
			"ends_at":        seasonEnd.Format(time.RFC3339),
			"days_remaining": daysRemaining,
			"is_active":      isActive,
		},
	}

	return jsonResponse(response)
}

// GetLeaderboard retrieves leaderboard entries.
func GetLeaderboard(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetLeaderboard called with payload: %s", payload)

	// Parse request
	var req struct {
		SeasonID *int `json:"season_id"`
		Limit    *int `json:"limit"`
		Offset   *int `json:"offset"`
	}

	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		logger.Error("Failed to parse get leaderboard request: %v", err)
		return errorResponse(false, "Invalid request format", err)
	}

	// Set defaults
	seasonID := 1
	if req.SeasonID != nil {
		seasonID = *req.SeasonID
	}

	limit := 100
	if req.Limit != nil {
		limit = *req.Limit
		if limit > 1000 {
			limit = 1000
		}
		if limit <= 0 {
			limit = 100
		}
	}

	offset := 0
	if req.Offset != nil {
		offset = *req.Offset
		if offset < 0 {
			offset = 0
		}
	}

	// Query leaderboard by joining player_stats with users
	query := `
		SELECT ps.user_id, u.username, ps.level, ps.experience
		FROM player_stats ps
		JOIN users u ON ps.user_id = u.id
		ORDER BY ps.experience DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		logger.Error("Failed to query leaderboard: %v", err)
		return errorResponse(false, "Failed to retrieve leaderboard", err)
	}
	defer rows.Close()

	leaderboard := make([]map[string]interface{}, 0)
	rank := offset + 1

	for rows.Next() {
		var userID string
		var username string
		var level int
		var experience int64

		err := rows.Scan(&userID, &username, &level, &experience)
		if err != nil {
			logger.Error("Failed to scan leaderboard row: %v", err)
			continue
		}

		entry := map[string]interface{}{
			"rank":      rank,
			"user_id":   userID,
			"username":  username,
			"level":     level,
			"experience": experience,
		}

		leaderboard = append(leaderboard, entry)
		rank++
	}

	// Get total player count for this season
	var totalPlayers int64
	countQuery := `SELECT COUNT(*) FROM player_stats`
	err = db.QueryRowContext(ctx, countQuery).Scan(&totalPlayers)
	if err != nil {
		logger.Warn("Failed to get total player count: %v", err)
		totalPlayers = int64(len(leaderboard))
	}

	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"season_id":   seasonID,
			"leaderboard": leaderboard,
			"total_players": totalPlayers,
		},
	}

	return jsonResponse(response)
}

// UpdateRank updates a player's rank.
func UpdateRank(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("UpdateRank called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetSeasonRewards retrieves season reward information.
func GetSeasonRewards(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetSeasonRewards called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// ClaimSeasonRewards claims season rewards.
func ClaimSeasonRewards(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("ClaimSeasonRewards called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// ValidatePurchase validates an IAP purchase.
func ValidatePurchase(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("ValidatePurchase called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetCurrency retrieves player currency balances.
func GetCurrency(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetCurrency called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// SpendGems processes gem spending.
func SpendGems(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("SpendGems called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GenerateGear generates a new gear item.
func GenerateGear(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GenerateGear called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}

// GetInventory retrieves player inventory.
func GetInventory(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("GetInventory called with payload: %s", payload)

	// Get user ID from context
	userID, err := getUserIDFromContext(ctx, nk)
	if err != nil {
		return errorResponse(false, "Authentication required", err)
	}
	if userID == "" {
		return errorResponse(false, "Invalid user ID", nil)
	}

	// Query inventory with catalog details
	query := `
		SELECT
			i.inventory_id, i.gear_id, i.acquired_at,
			c.gear_type, c.name, c.rarity, c.base_stats, c.modifiers, c.icon_url
		FROM inventory i
		JOIN catalog c ON i.gear_id = c.gear_id
		WHERE i.user_id = $1
		ORDER BY c.gear_type, c.rarity DESC, i.acquired_at DESC
	`

	rows, err := db.QueryContext(ctx, query, userID)
	if err != nil {
		logger.Error("Failed to query inventory: %v", err)
		return errorResponse(false, "Failed to retrieve inventory", err)
	}
	defer rows.Close()

	items := make([]map[string]interface{}, 0)

	for rows.Next() {
		var inventoryID string
		var gearID string
		var acquiredAt time.Time
		var gearType string
		var name string
		var rarity string
		var baseStats string
		var modifiers string
		var iconURL sql.NullString

		err := rows.Scan(
			&inventoryID,
			&gearID,
			&acquiredAt,
			&gearType,
			&name,
			&rarity,
			&baseStats,
			&modifiers,
			&iconURL,
		)
		if err != nil {
			logger.Error("Failed to scan inventory row: %v", err)
			continue
		}

		// Parse base_stats JSON
		var baseStatsMap map[string]interface{}
		if err := json.Unmarshal([]byte(baseStats), &baseStatsMap); err != nil {
			logger.Warn("Failed to parse base_stats JSON, using empty map: %v", err)
			baseStatsMap = make(map[string]interface{})
		}

		// Parse modifiers JSON
		var modifiersArray []interface{}
		if err := json.Unmarshal([]byte(modifiers), &modifiersArray); err != nil {
			logger.Warn("Failed to parse modifiers JSON, using empty array: %v", err)
			modifiersArray = make([]interface{}, 0)
		}

		item := map[string]interface{}{
			"inventory_id": inventoryID,
			"gear_id":      gearID,
			"gear_type":    gearType,
			"name":         name,
			"rarity":       rarity,
			"base_stats":   baseStatsMap,
			"modifiers":    modifiersArray,
			"acquired_at":  acquiredAt.Format(time.RFC3339),
		}

		if iconURL.Valid {
			item["icon_url"] = iconURL.String
		}

		items = append(items, item)
	}

	response := map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"user_id":     userID,
			"items":       items,
			"total_items": len(items),
		},
	}

	return jsonResponse(response)
}

// EquipGear equips a gear item.
func EquipGear(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, payload string) (string, error) {
	logger.Debug("EquipGear called")
	
	response := map[string]interface{}{
		"success": false,
		"message": "Not yet implemented",
	}
	
	result, err := json.Marshal(response)
	if err != nil {
		return "", err
	}
	
	return string(result), nil
}
