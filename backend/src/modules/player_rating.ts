## Player rating module for ELO-based skill tracking.
## Manages rating validation, storage, and leaderboard snapshots.

import { z } from "https://deno.land/x/zod/mod.ts";

// --- Types ---
interface PlayerRating {
	player_id: string;
	mode: "1v1" | "2v2";
	rating: number;
	matches: number;
	wins: number;
	losses: number;
	created_at: number;
	updated_at: number;
}

interface RatingHistory {
	id: string;
	player_id: string;
	mode: "1v1" | "2v2";
	old_rating: number;
	new_rating: number;
	opponent_rating: number;
	is_win: boolean;
	timestamp: number;
}

interface RatingChange {
	player_id: string;
	old_rating: number;
	new_rating: number;
	change_amount: number;
	adjustment_type: "win" | "loss";
	mode: "1v1" | "2v2";
	timestamp: number;
}

// --- Constants ---
const DEFAULT_RATING = 1200;
const MINIMUM_RATING = 1000;
const MAXIMUM_RATING = 3000;
const K_FACTOR_NEW = 40.0;
const K_FACTOR_ESTABLISHED = 20.0;
const ESTABLISHED_MATCHES = 10;
const MAX_RATING_CHANGE = 200; // Prevent manipulation from extreme ratings

// --- Storage Keys ---
const STORAGE_KEY_RATINGS = "player_ratings";
const STORAGE_KEY_HISTORY = "rating_history";

/**
 * Validate rating change to prevent manipulation
 */
export function validateRatingChange(
	oldRating: number,
	newRating: number,
	changeType: "win" | "loss"
): { valid: boolean; error?: string } {
	const changeAmount = Math.abs(newRating - oldRating);

	// Prevent extreme rating changes
	if (changeAmount > MAX_RATING_CHANGE) {
		return {
			valid: false,
			error: `Rating change ${changeAmount} exceeds maximum ${MAX_RATING_CHANGE}`
		};
	}

	// Ensure rating stays within bounds
	if (newRating < MINIMUM_RATING || newRating > MAXIMUM_RATING) {
		return {
			valid: false,
			error: `New rating ${newRating} outside valid range [${MINIMUM_RATING}, ${MAXIMUM_RATING}]`
		};
	}

	return { valid: true };
}

/**
 * Apply rating adjustment and update storage
 */
export function applyRatingAdjustment(
	nkctx: nkruntime.NkContext,
	playerId: string,
	oldRating: number,
	newRating: number,
	changeType: "win" | "loss",
	mode: "1v1" | "2v2"
): Promise<PlayerRating> {
	// Validate change
	const validation = validateRatingChange(oldRating, newRating, changeType);
	if (!validation.valid) {
		throw new Error(validation.error);
	}

	// Get current ratings
	const storage = await nk.storageRead([STORAGE_KEY_RATINGS]);
	const ratingsData = storage[STORAGE_KEY_RATINGS]
		? JSON.parse(storage[STORAGE_KEY_RATINGS] as string)
		: {};

	const now = Date.now() / 1000; // Unix timestamp in seconds

	// Update or create rating
	const ratingKey = `${playerId}_${mode}`;
	const existing = ratingsData[ratingKey] as PlayerRating | undefined;

	if (existing) {
		// Update existing rating
		const ratingChange = newRating - oldRating;

		ratingsData[ratingKey] = {
			...existing,
			rating: newRating,
			matches: existing.matches + 1,
			wins: changeType === "win" ? existing.wins + 1 : existing.wins,
			losses: changeType === "loss" ? existing.losses + 1 : existing.losses,
			updated_at: now
		};

		// Log rating change
		nk.logger.info("Rating updated",
			{
					player_id: playerId,
					mode,
					old_rating: oldRating,
					new_rating: newRating,
					change: ratingChange
			}
		);
	} else {
		// Create new rating entry
		ratingsData[ratingKey] = {
			player_id: playerId,
			mode,
			rating: newRating,
			matches: 1,
			wins: changeType === "win" ? 1 : 0,
			losses: changeType === "loss" ? 1 : 0,
			created_at: now,
			updated_at: now
		};

		nk.logger.info("Rating created", { player_id: playerId, mode, rating: newRating });
	}

	// Save to storage
	await nk.storageWrite({
		[STORAGE_KEY_RATINGS]: JSON.stringify(ratingsData)
	});

	return ratingsData[ratingKey] as PlayerRating;
}

/**
 * Get player leaderboard snapshot (top N players)
 */
export function getLeaderboardSnapshot(
	nkctx: nkruntime.NkContext,
	mode: "1v1" | "2v2",
	limit: number = 100
): Promise<PlayerRating[]> {
	const storage = await nk.storageRead([STORAGE_KEY_RATINGS]);
	const ratingsData = storage[STORAGE_KEY_RATINGS]
		? JSON.parse(storage[STORAGE_KEY_RATINGS] as string)
		: {};

	// Filter by mode and sort by rating (descending)
	const modeSuffix = `_${mode}`;
	const ratings = Object.values(ratingsData)
		.filter((r: any) => (r as PlayerRating).mode === mode)
		.map((r: any) => r as PlayerRating)
		.sort((a, b) => b.rating - a.rating)
		.slice(0, limit);

	return ratings;
}

/**
 * Track match outcome for statistics
 */
export async function trackMatchOutcome(
	nkctx: nkruntime.NkContext,
	playerId: string,
	opponentId: string,
	playerRating: number,
	opponentRating: number,
	isWin: boolean,
	mode: "1v1" | "2v2",
	matchDuration: number
): Promise<void> {
	// Store match outcome in history
	const storage = await nk.storageRead([STORAGE_KEY_HISTORY]);
	const historyData = storage[STORAGE_KEY_HISTORY]
		? JSON.parse(storage[STORAGE_KEY_HISTORY] as string)
		: {};

	const history = historyData[`${playerId}_${mode}`] as RatingHistory[] || [];

	const historyEntry: RatingHistory = {
		id: `${playerId}_${mode}_${Date.now()}`,
		player_id: playerId,
		mode,
		old_rating: playerRating,
		new_rating: calculateElo(playerRating, opponentRating, isWin),
		opponent_rating: opponentRating,
		is_win: isWin,
		timestamp: Date.now() / 1000
	};

	history.push(historyEntry);

	// Keep only last 100 entries
	if (history.length > 100) {
		historyData[`${playerId}_${mode}`] = history.slice(-100);
	} else {
		historyData[`${playerId}_${mode}`] = history;
	}

	await nk.storageWrite({
		[STORAGE_KEY_HISTORY]: JSON.stringify(historyData)
	});

	nk.logger.info("Match outcome tracked", {
		player_id: playerId,
		opponent_id: opponentId,
		mode,
		is_win: isWin,
		match_duration: matchDuration
	});
}

/**
 * Calculate ELO rating change
 */
function calculateElo(
	playerRating: number,
	opponentRating: number,
	isWin: boolean
): number {
	const ratingDifference = opponentRating - playerRating;
	const expectedScore = 1.0 / (1.0 + Math.pow(10.0, ratingDifference / 400.0));
	const actualScore = isWin ? 1.0 : 0.0;

	// Use K=32 for calculation (middle ground)
	const kFactor = 32.0;
	const ratingChange = kFactor * (actualScore - expectedScore);
	const newRating = Math.max(
		Math.min(playerRating + ratingChange, MAXIMUM_RATING),
		MINIMUM_RATING
	);

	return Math.round(newRating);
}

/**
 * Get K-factor based on player experience
 */
export function getKFactor(matchesPlayed: number): number {
	return matchesPlayed < ESTABLISHED_MATCHES ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED;
}

/**
 * Get player rating from storage
 */
export async function getPlayerRating(
	nkctx: nkruntime.NkContext,
	playerId: string,
	mode: "1v1" | "2v2"
): Promise<number | null> {
	const storage = await nk.storageRead([STORAGE_KEY_RATINGS]);
	const ratingsData = storage[STORAGE_KEY_RATINGS]
		? JSON.parse(storage[STORAGE_KEY_RATINGS] as string)
		: {};

	const ratingKey = `${playerId}_${mode}`;
	const ratingData = ratingsData[ratingKey] as PlayerRating | undefined;

	return ratingData ? ratingData.rating : null;
}
