/**
 * Currency module — the single authoritative currency ledger (issue #860).
 *
 * @fileoverview Owns all player-currency reads and writes.
 *
 * LEDGER DESIGN DECISION (issue #860):
 * The `player_currency` STORAGE record is the single source of truth for
 * gems and coins. The Nakama wallet is NOT a ledger going forward — before
 * this fix it was write-only (nothing in the backend or the Godot client
 * ever read it), which is how match/season rewards landed somewhere the
 * store could not see. Every earn path now writes to this storage record
 * and every read path (notably `armored_archer/get_currency` and
 * `armored_archer/spend_gems` in store.ts) reads it.
 *
 * FIELD NAMING:
 * `gold` is the storage field that holds the canonical "Coins" soft
 * currency (CONTEXT.md ratified "Coins" as the canonical name; `gold` is
 * the legacy field the client already displays). A later change (#866)
 * renames this field to `coins` — this module isolates that rename to the
 * `PlayerCurrency` interface plus the `coinsToLedgerField` mapping below.
 *
 * LEGACY WALLET BRIDGE (zero balance loss):
 * Players may hold balances in the wallet from the pre-fix write paths
 * (match rewards, punch-up gems, season rewards). A lazy, one-time,
 * read-through bridge folds those balances into the storage record the
 * first time it is read after this fix: the merged record is stamped with
 * `wallet_bridged: true` so the fold is never applied twice. Because no
 * code writes the wallet anymore, the wallet is frozen at its pre-fix
 * value and the bridge captures exactly the stranded earnings.
 *
 * The bridge intentionally ignores the wallet `gem` (singular) key: the
 * old rpg respec path debited that key, so it can only be zero or
 * negative — folding it would subtract legitimately earned currency.
 */

import { logger as fallbackLogger } from '../config/logger';
import { Runtime } from '../types/nakama';
import { getCacheManager } from '../utils/cache';
import { safeParse } from '../utils/safeParse';
import { logAudit } from './audit';

/**
 * Storage collection holding the authoritative currency record.
 */
export const PLAYER_CURRENCY_COLLECTION = 'player_currency';

/**
 * Maximum gem balance allowed to prevent overflow exploits.
 * Shared by store purchase validation and the ledger award path.
 */
export const MAX_GEM_BALANCE = 10000000; // 10 million gems

/**
 * Player currency data structure — the authoritative ledger record.
 *
 * @property user_id - Unique identifier for the player
 * @property gems - Premium currency balance (IAP + earned)
 * @property gold - Soft currency ("Coins") balance; field rename to `coins` tracked in #866
 * @property wallet_bridged - One-time marker set when legacy wallet balances were folded in (#860)
 */
export interface PlayerCurrency {
  user_id: string;
  gems: number;
  gold: number;
  wallet_bridged?: boolean;
}

/**
 * A change to apply to the ledger. Positive values credit, negative debit.
 *
 * @property gems - Gems to add/remove
 * @property gold - Coins (stored as `gold`, see field naming note above) to add/remove
 */
export interface CurrencyDelta {
  gems?: number;
  gold?: number;
}

/**
 * Result of a raw (uncached, unbridged) ledger read.
 */
interface RawCurrencyRead {
  currency: PlayerCurrency;
  version: string | undefined;
}

/**
 * Reads the raw ledger record from storage without caching or bridging.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Logger instance
 * @returns The currency record plus its storage version for conditional writes
 */
function readCurrencyRecord(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger
): RawCurrencyRead {
  const objects = nk.storageRead([
    {
      collection: PLAYER_CURRENCY_COLLECTION,
      key: userId,
      userId: userId,
    },
  ]);

  if (objects.length === 0 || !objects[0].value) {
    return { currency: defaultCurrency(userId), version: undefined };
  }

  const parseResult = safeParse<PlayerCurrency>(
    objects[0].value,
    null,
    logger,
    'currency:player_currency'
  );
  if (!parseResult.success || !parseResult.data) {
    return { currency: defaultCurrency(userId), version: undefined };
  }

  const parsed = parseResult.data;
  const currency: PlayerCurrency = {
    user_id: parsed.user_id || userId,
    gems: typeof parsed.gems === 'number' && Number.isFinite(parsed.gems) ? parsed.gems : 0,
    gold: typeof parsed.gold === 'number' && Number.isFinite(parsed.gold) ? parsed.gold : 0,
    wallet_bridged: parsed.wallet_bridged,
  };

  return { currency, version: objects[0].version };
}

/**
 * Builds an empty ledger record for a player.
 *
 * @param userId - ID of the player
 * @returns A zero-balance currency record
 */
function defaultCurrency(userId: string): PlayerCurrency {
  return { user_id: userId, gems: 0, gold: 0 };
}

/**
 * Extracts legacy wallet balances that must be folded into the ledger.
 *
 * Recognized wallet keys (clamped at zero — a negative key can only be a
 * legacy debit and must never reduce the ledger):
 * - `gems`: written by store purchases and punch-up gem rewards
 * - `coins`: written by match and season coin rewards
 * - `gold`: defensive — no known writer used it, but folding is harmless
 *
 * The `gem` (singular) key is deliberately ignored: only the old respec
 * path debited it, so it can only be zero or negative debt.
 *
 * @param wallet - Parsed wallet map from the Nakama account
 * @returns Sane balances to fold into the ledger
 */
function extractBridgeableWalletBalances(wallet: Record<string, unknown>): {
  gems: number;
  gold: number;
} {
  const clamp = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

  return {
    gems: clamp(wallet.gems),
    gold: clamp(wallet.coins) + clamp(wallet.gold),
  };
}

/**
 * One-time lazy bridge: folds legacy wallet balances into the ledger.
 *
 * Runs only when the record has no `wallet_bridged` marker. Writes the
 * merged record back with the version observed during the read so a
 * concurrent update aborts the bridge (it simply retries on the next
 * read). Best-effort by design: failures never block the read path.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Logger instance
 * @param read - The raw ledger read to bridge
 * @returns The merged currency record (unbridged input on any failure)
 */
function bridgeLegacyWalletIntoLedger(
  nk: Runtime.Nakama,
  userId: string,
  logger: Runtime.Logger,
  read: RawCurrencyRead
): PlayerCurrency {
  // Capability check keeps hand-rolled test mocks (and any runtime without
  // account read access) working: without accountGetId there is nothing we
  // can bridge, so return the record untouched and unstamped.
  if (typeof nk.accountGetId !== 'function') {
    return read.currency;
  }

  let wallet: Record<string, unknown> = {};
  try {
    const account = nk.accountGetId(userId);
    if (account && account.wallet) {
      const parsedWallet = safeParse<Record<string, unknown>>(
        account.wallet,
        null,
        logger,
        'currency:wallet_bridge'
      );
      if (parsedWallet.success && parsedWallet.data) {
        wallet = parsedWallet.data;
      }
    }
  } catch (error) {
    logger.warn('Currency wallet bridge: account read failed for %s: %s', userId, error);
    return read.currency;
  }

  const bridge = extractBridgeableWalletBalances(wallet);

  const merged: PlayerCurrency = {
    user_id: userId,
    gems: Math.min(read.currency.gems + bridge.gems, MAX_GEM_BALANCE),
    gold: read.currency.gold + bridge.gold,
    wallet_bridged: true,
  };

  if (bridge.gems > MAX_GEM_BALANCE || read.currency.gems + bridge.gems > MAX_GEM_BALANCE) {
    logger.warn(
      'Currency wallet bridge for %s saturated gems at MAX_GEM_BALANCE (%d)',
      userId,
      MAX_GEM_BALANCE
    );
  }

  if (bridge.gems === 0 && bridge.gold === 0) {
    // Nothing stranded in the wallet — stamp the marker so we never rescan,
    // but only persist when a record already exists (avoid creating empty
    // records for every fresh read).
    if (read.version !== undefined) {
      try {
        writeCurrencyRecord(nk, userId, { ...read.currency, wallet_bridged: true }, read.version);
      } catch (error) {
        logger.debug('Currency wallet bridge stamp failed for %s: %s', userId, error);
      }
    }
    return read.currency;
  }

  try {
    writeCurrencyRecord(nk, userId, merged, read.version);
    logAudit(
      nk,
      userId,
      null,
      'currency_wallet_bridge',
      PLAYER_CURRENCY_COLLECTION,
      {
        bridged_gems: bridge.gems,
        bridged_coins: bridge.gold,
        new_gem_balance: merged.gems,
        new_coin_balance: merged.gold,
      },
      'success'
    );
    logger.info(
      'Bridged legacy wallet into currency ledger for %s: +%d gems, +%d coins',
      userId,
      bridge.gems,
      bridge.gold
    );
    return merged;
  } catch (error) {
    // Version conflict or write failure — the wallet is unchanged, so the
    // next read will attempt the bridge again.
    logger.warn('Currency wallet bridge write failed for %s: %s', userId, error);
    return read.currency;
  }
}

/**
 * Persists a ledger record with optimistic-concurrency protection.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param currency - The record to persist
 * @param version - Storage version observed when the record was read, if any
 */
function writeCurrencyRecord(
  nk: Runtime.Nakama,
  userId: string,
  currency: PlayerCurrency,
  version: string | undefined
): void {
  nk.storageWrite([
    {
      collection: PLAYER_CURRENCY_COLLECTION,
      key: userId,
      userId: userId,
      value: JSON.stringify(currency),
      version: version,
    },
  ]);
}

/**
 * Reads the authoritative currency balance for a player, running the
 * one-time legacy wallet bridge on first read.
 *
 * This is the choke point every currency consumer should use. Mirrors the
 * cache semantics of the store module ('player_currency' LRU cache — a
 * no-op until that cache is registered via initializeCaches).
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param logger - Optional logger; falls back to the winston logger
 * @returns The player's current currency record
 */
export function getCurrency(
  nk: Runtime.Nakama,
  userId: string,
  logger?: Runtime.Logger
): PlayerCurrency {
  const log = logger ?? fallbackLogger;
  const cacheManager = getCacheManager(log);
  const cached = cacheManager.get<PlayerCurrency>(PLAYER_CURRENCY_COLLECTION, userId);
  if (cached !== undefined) {
    return cached;
  }

  const read = readCurrencyRecord(nk, userId, log);
  const currency =
    read.currency.wallet_bridged === true
      ? read.currency
      : bridgeLegacyWalletIntoLedger(nk, userId, log, read);

  cacheManager.set(PLAYER_CURRENCY_COLLECTION, userId, currency);
  return currency;
}

/**
 * Invalidates the cached currency record for a player.
 *
 * @param userId - ID of the player
 * @param logger - Optional logger; falls back to the winston logger
 */
export function invalidateCurrencyCache(userId: string, logger?: Runtime.Logger): void {
  const cacheManager = getCacheManager(logger ?? fallbackLogger);
  cacheManager.delete(PLAYER_CURRENCY_COLLECTION, userId);
}

/**
 * Applies a credit or debit to the authoritative ledger.
 *
 * Server-authoritative read-modify-write with optimistic concurrency: the
 * record is written with the version observed during the read; on a
 * version conflict (concurrent settlement/store write) the operation is
 * retried once against fresh state. Debits are floored at zero so a
 * concurrent spend can never push a balance negative. Gem credits are
 * capped at MAX_GEM_BALANCE.
 *
 * @param nk - Nakama server interface
 * @param userId - ID of the player
 * @param delta - Change to apply (gems and/or gold)
 * @param source - Audit identifier for the calling path (e.g. 'match_rewards')
 * @param logger - Optional logger; falls back to the winston logger
 * @returns The updated currency record
 */
export function applyCurrencyDelta(
  nk: Runtime.Nakama,
  userId: string,
  delta: CurrencyDelta,
  source: string,
  logger?: Runtime.Logger
): PlayerCurrency {
  const log = logger ?? fallbackLogger;
  const gemsDelta = Math.trunc(delta.gems ?? 0);
  const goldDelta = Math.trunc(delta.gold ?? 0);

  if (gemsDelta === 0 && goldDelta === 0) {
    // Nothing to apply — return the current state without a write.
    return getCurrency(nk, userId, log);
  }

  invalidateCurrencyCache(userId, log);

  for (let attempt = 0; attempt < 2; attempt++) {
    const read = readCurrencyRecord(nk, userId, log);
    const current = read.currency;

    let newGems = current.gems + gemsDelta;
    const newGold = Math.max(0, current.gold + goldDelta);
    if (newGems > MAX_GEM_BALANCE) {
      log.warn(
        'Currency award for %s via %s saturated gems at MAX_GEM_BALANCE (%d)',
        userId,
        source,
        MAX_GEM_BALANCE
      );
      newGems = MAX_GEM_BALANCE;
    }
    // Debits floor at zero; credits always keep the floor harmless.
    newGems = Math.max(0, newGems);

    const updated: PlayerCurrency = {
      user_id: userId,
      gems: newGems,
      gold: newGold,
      // Preserve an absent bridge marker so a stranded legacy wallet is
      // still folded in on the next read.
      wallet_bridged: current.wallet_bridged,
    };

    try {
      writeCurrencyRecord(nk, userId, updated, read.version);
    } catch (error) {
      if (attempt === 0) {
        log.warn('Currency write conflict for %s via %s, retrying: %s', userId, source, error);
        continue;
      }
      // Let the conflict propagate: award callers (match settlement,
      // season distribution) abort before stamping their idempotency
      // markers, so a retry of the whole operation re-applies safely.
      throw error;
    }

    invalidateCurrencyCache(userId, log);
    getCacheManager(log).set(PLAYER_CURRENCY_COLLECTION, userId, updated);

    logAudit(
      nk,
      userId,
      null,
      'currency_delta',
      PLAYER_CURRENCY_COLLECTION,
      {
        source,
        gems_delta: gemsDelta,
        gold_delta: goldDelta,
        new_gem_balance: updated.gems,
        new_coin_balance: updated.gold,
      },
      'success'
    );

    log.info(
      'Currency delta for %s via %s: gems %d, coins %d (new balances: %d gems, %d coins)',
      userId,
      source,
      gemsDelta,
      goldDelta,
      updated.gems,
      updated.gold
    );

    return updated;
  }

  // Unreachable: the loop either returns or throws.
  throw new Error(`currency: failed to apply delta for ${userId} via ${source}`);
}
