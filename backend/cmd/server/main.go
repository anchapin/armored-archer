// Package main provides the Nakama Go module entry point for Armored Archer backend.
package main

import (
	"context"
	"database/sql"
	"time"

	"github.com/anchapin/armored-archer/backend/internal/config"
	"github.com/anchapin/armored-archer/backend/internal/rpc"
	"github.com/anchapin/armored-archer/backend/internal/utils"
	"github.com/heroiclabs/nakama-common/runtime"
)

// globalConfig holds the loaded configuration accessible to all modules.
var globalConfig *config.Config

// globalCache holds the cache manager accessible to all modules.
var globalCache *utils.CacheManager

// InitModule is the entry point for the Nakama Go module.
// This function is called by Nakama when the module loads.
func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	logger.Info("=== Armored Archer Backend Initializing ===")
	logger.Info("Environment: Go %s", "1.21")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Error("Failed to load config: %v", err)
		return err
	}

	// Validate configuration
	if err := cfg.Validate(); err != nil {
		logger.Error("Config validation failed: %v", err)
		return err
	}

	globalConfig = cfg
	logger.Info("Configuration loaded successfully")

	// Initialize cache manager with optimized settings
	globalCache = utils.NewCacheManager(logger)
	
	// Initialize caches with appropriate sizes and TTLs for performance
	// Player stats cache - frequently accessed, changes occasionally
	globalCache.CreateCache("player_stats", 500, 60*time.Second)
	
	// Leaderboard cache - frequently read, changes on match completion
	globalCache.CreateCache("leaderboards", 100, 60*time.Second)
	
	// Season info cache - rarely changes
	globalCache.CreateCache("season_info", 100, 5*time.Minute)
	
	// Store catalog cache - static data, very rarely changes
	globalCache.CreateCache("store_catalog", 100, 30*time.Minute)
	
	// Gear definitions cache - static game config
	globalCache.CreateCache("gear_definitions", 100, 30*time.Minute)
	
	logger.Info("Cache manager initialized with optimized settings")

	// Register RPC handlers
	if err := registerRPCs(logger, initializer); err != nil {
		logger.Error("Failed to register RPCs: %v", err)
		return err
	}
	logger.Info("RPC handlers registered")

	// Register matchmakers (using RegisterMatch for custom match logic)
	// Matchmaker registration will be added in Phase 6
	logger.Info("Matchmakers skipped for now - to be added in Phase 6")

	// Register hooks (to be implemented in later phases)
	logger.Info("Hooks skipped for now - to be added in later phases")

	logger.Info("=== Armored Archer Backend Ready ===")
	return nil
}

// registerRPCs registers all RPC handlers with Nakama.
func registerRPCs(logger runtime.Logger, initializer runtime.Initializer) error {
	// Player RPCs
	if err := initializer.RegisterRpc("get_player_stats", rpc.GetPlayerStats); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("report_player", rpc.ReportPlayer); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_player_reports", rpc.GetPlayerReports); err != nil {
		return err
	}

	// RPG System RPCs
	if err := initializer.RegisterRpc("gain_xp", rpc.GainXP); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("allocate_stats", rpc.AllocateStats); err != nil {
		return err
	}

	// Matchmaker RPCs
	if err := initializer.RegisterRpc("list_matches", rpc.ListMatches); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("create_match", rpc.CreateMatch); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("accept_match", rpc.AcceptMatch); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_player_rank", rpc.GetPlayerRank); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("complete_match", rpc.CompleteMatch); err != nil {
		return err
	}

	// Combat System RPCs
	if err := initializer.RegisterRpc("submit_combat_action", rpc.SubmitCombatAction); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_match_state", rpc.GetMatchState); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("player_disconnect", rpc.PlayerDisconnect); err != nil {
		return err
	}

	// Season System RPCs
	if err := initializer.RegisterRpc("get_season_info", rpc.GetSeasonInfo); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_leaderboard", rpc.GetLeaderboard); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("update_rank", rpc.UpdateRank); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_season_rewards", rpc.GetSeasonRewards); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("claim_season_rewards", rpc.ClaimSeasonRewards); err != nil {
		return err
	}

	// Store RPCs
	if err := initializer.RegisterRpc("validate_purchase", rpc.ValidatePurchase); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_currency", rpc.GetCurrency); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("spend_gems", rpc.SpendGems); err != nil {
		return err
	}

	// Gear System RPCs
	if err := initializer.RegisterRpc("generate_gear", rpc.GenerateGear); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_inventory", rpc.GetInventory); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("equip_gear", rpc.EquipGear); err != nil {
		return err
	}

	// Feedback System RPCs
	if err := initializer.RegisterRpc("submit_feedback", rpc.SubmitFeedback); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_feedback", rpc.GetFeedback); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("list_feedback", rpc.ListFeedback); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("vote_feedback", rpc.VoteFeedback); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("add_feedback_response", rpc.AddFeedbackResponse); err != nil {
		return err
	}
	if err := initializer.RegisterRpc("get_feedback_statistics", rpc.GetFeedbackStatistics); err != nil {
		return err
	}

	return nil
}

// GetGlobalCache returns the global cache manager.
func GetGlobalCache() *utils.CacheManager {
	return globalCache
}

// GetGlobalConfig returns the global configuration.
func GetGlobalConfig() *config.Config {
	return globalConfig
}


