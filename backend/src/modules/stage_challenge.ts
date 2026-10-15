/**
 * Server-issued stage challenge (reward integration contract, option B).
 *
 * `stage_start` opens a run: the server snapshots the stage's tier from its
 * own campaign configuration (campaigns.json), an RNG seed, and an expiry
 * into a per-user storage record, and returns the opaque challenge ID.
 * `stage_complete` presenting that ID has its tier read from the server
 * snapshot - never from client input, satisfying the difficulty_reward_plan
 * contract - and the challenge is consumed so it cannot be reused.
 *
 * Offline finishes have no challenge and keep the existing allowlist-clamped
 * behavior; bonuses stay gated on challenge-verified completions.
 */

import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Runtime } from '../types/nakama';
import { toStorageValue, getStorageRawValue } from '../utils/storage-helpers';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

export const STAGE_CHALLENGE_COLLECTION = 'stage_challenges';
/** A challenge lives long enough for one stage run plus reconnect slack. */
export const STAGE_CHALLENGE_TTL_MS = 2 * 60 * 60 * 1000;

export type ChallengeTier = 'easy' | 'medium' | 'hard';

export interface StageChallenge {
  challenge_id: string;
  user_id: string;
  stage_id: string;
  tier: ChallengeTier;
  seed: number;
  issued_at: number;
  expires_at: number;
  consumed_at?: number;
}

/** campaigns.json numeric tier -> reward tier (tiers 1-3 map easy/medium/hard). */
const CAMPAIGN_TIER_MAP: { [tier: number]: ChallengeTier } = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
};

let stageTierCache: { [stageId: string]: ChallengeTier } | undefined;

/** Loads stage_id -> tier from campaigns.json (cached per process). */
function loadStageTiers(): { [stageId: string]: ChallengeTier } {
  if (stageTierCache) return stageTierCache;
  const campaignsPath = path.join(__dirname, '../../data/campaigns.json');
  const data = JSON.parse(fs.readFileSync(campaignsPath, 'utf8')) as {
    campaigns: { stages: { id: string; difficulty: number }[] }[];
  };
  const tiers: { [stageId: string]: ChallengeTier } = {};
  for (const campaign of data.campaigns) {
    for (const stage of campaign.stages) {
      const tier = CAMPAIGN_TIER_MAP[stage.difficulty];
      if (tier) tiers[stage.id] = tier;
    }
  }
  stageTierCache = tiers;
  return tiers;
}

/** Server-side tier for a configured stage, or undefined for an unknown stage. */
export function resolveStageTier(stageId: string): ChallengeTier | undefined {
  return loadStageTiers()[stageId];
}

function challengeError(error: string, code: string): string {
  return JSON.stringify({ success: false, error, error_code: code });
}

/**
 * Loads and identity-checks a challenge record, shared by the read and
 * consume paths. Fails closed on storage errors, missing or unreadable
 * records, and user/stage mismatch.
 */
function loadStageChallenge(
  nk: Runtime.Nakama,
  userId: string,
  challengeId: string,
  stageId: string
): { challenge: StageChallenge; version?: string } | { error: string } {
  let stored: Runtime.StorageObject[] = [];
  try {
    stored = nk.storageRead([{ collection: STAGE_CHALLENGE_COLLECTION, key: challengeId, userId }]);
  } catch {
    return {
      error: challengeError('Stage challenge could not be verified', 'CHALLENGE_READ_FAILED'),
    };
  }
  if (stored.length === 0 || !stored[0].value) {
    return { error: challengeError('Unknown stage challenge', 'INVALID_CHALLENGE') };
  }
  let challenge: StageChallenge;
  try {
    challenge = JSON.parse(getStorageRawValue(stored[0].value) ?? '') as StageChallenge;
  } catch {
    return { error: challengeError('Stage challenge record is unreadable', 'INVALID_CHALLENGE') };
  }
  if (challenge.user_id !== userId || challenge.stage_id !== stageId) {
    return {
      error: challengeError('Stage challenge does not match this completion', 'CHALLENGE_MISMATCH'),
    };
  }
  return { challenge, version: stored[0].version };
}

/**
 * Consumes a stage challenge for a completion request.
 *
 * Fails closed on every mismatch: unknown challenge, stage mismatch, expiry,
 * prior consumption, and storage read/write errors all reject the request.
 * The consume write is version-checked, so two concurrent completions
 * carrying the same challenge cannot both pass.
 *
 * @returns The server-snapshotted tier and seed, or an error response string
 */
export function consumeStageChallenge(
  nk: Runtime.Nakama,
  userId: string,
  challengeId: string,
  stageId: string
): { tier: ChallengeTier; seed: number } | { error: string } {
  const loaded = loadStageChallenge(nk, userId, challengeId, stageId);
  if ('error' in loaded) return loaded;
  const challenge = loaded.challenge;
  if (Date.now() > challenge.expires_at) {
    return { error: challengeError('Stage challenge expired', 'CHALLENGE_EXPIRED') };
  }
  if (challenge.consumed_at) {
    return { error: challengeError('Stage challenge already consumed', 'CHALLENGE_CONSUMED') };
  }
  try {
    nk.storageWrite([
      {
        collection: STAGE_CHALLENGE_COLLECTION,
        key: challengeId,
        userId,
        value: toStorageValue({ ...challenge, consumed_at: Date.now() }),
        version: loaded.version ?? '*',
      },
    ]);
  } catch {
    return { error: challengeError('Stage challenge could not be consumed', 'CHALLENGE_CONFLICT') };
  }
  return { tier: challenge.tier, seed: challenge.seed };
}

/**
 * Reads a stage challenge without consuming it, for a same-attempt resume:
 * the original attempt already consumed it, so consumption state is
 * accepted either way, but the record must still exist and match.
 *
 * @returns The server-snapshotted tier and seed, or an error response string
 */
export function readStageChallenge(
  nk: Runtime.Nakama,
  userId: string,
  challengeId: string,
  stageId: string
): { tier: ChallengeTier; seed: number } | { error: string } {
  const loaded = loadStageChallenge(nk, userId, challengeId, stageId);
  if ('error' in loaded) return loaded;
  const challenge = loaded.challenge;
  return { tier: challenge.tier, seed: challenge.seed };
}

/**
 * Handle stage_start RPC: issue a server-snapshotted challenge for a run.
 */
export function rpcStageStart(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  if (!ctx.userId) {
    logger.warn('stage_start attempted without authentication');
    return challengeError('Authentication required', 'UNAUTHORIZED');
  }
  const validation = validatePayload(ZodSchemas.stage_start, payload, 'stage_start');
  if (!validation.success) {
    return createValidationErrorResponse('stage_start', validation.error);
  }
  const { stage_id: stageId } = validation.data;
  const tier = resolveStageTier(stageId);
  if (!tier) {
    logger.warn('stage_start for unknown stage %s user %s', stageId, ctx.userId);
    return challengeError('Unknown stage', 'UNKNOWN_STAGE');
  }
  const now = Date.now();
  const challenge: StageChallenge = {
    challenge_id: randomBytes(16).toString('hex'),
    user_id: ctx.userId,
    stage_id: stageId,
    tier,
    seed: randomBytes(4).readUInt32BE(0),
    issued_at: now,
    expires_at: now + STAGE_CHALLENGE_TTL_MS,
  };
  nk.storageWrite([
    {
      collection: STAGE_CHALLENGE_COLLECTION,
      key: challenge.challenge_id,
      userId: ctx.userId,
      value: toStorageValue(challenge),
      version: '*',
      permissionRead: 1,
      permissionWrite: 0,
    },
  ]);
  logger.info('Stage challenge issued for user %s stage %s tier %s', ctx.userId, stageId, tier);
  return JSON.stringify({
    success: true,
    challenge_id: challenge.challenge_id,
    stage_id: stageId,
    tier,
    seed: challenge.seed,
    expires_at: challenge.expires_at,
  });
}

/** Registers the stage start RPC endpoint. */
export function registerRpcStageStart(initializer: Runtime.Initializer): void {
  initializer.registerRpc('armored_archer/stage_start', rpcStageStart);
}
