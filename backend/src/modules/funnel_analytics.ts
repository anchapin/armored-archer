/**
 * Funnel Analytics Module
 * @fileoverview Tracks player progression through the core conversion funnel:
 * Install -> First PvE Completion -> First PvP Match -> First Purchase.
 */

import { logger } from '../config/logger';
import { Runtime } from '../types/nakama';
import {
  registerRpcWithMetrics,
  setFunnelPlayers,
  setFunnelConversionRate,
  setFunnelDropoff,
} from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

const COLLECTION = 'funnel_analytics';
const KEY_PLAYER_STATE = 'player_funnel_state';
const KEY_GLOBAL_COUNTS = 'global_funnel_counts';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface PlayerFunnelState {
  user_id: string;
  install_timestamp: number | null;
  first_pve_timestamp: number | null;
  first_pvp_timestamp: number | null;
  first_purchase_timestamp: number | null;
  last_updated: number;
}

interface FunnelCounts {
  install: number;
  first_pve_completed: number;
  first_pvp_completed: number;
  first_purchase: number;
  updated_at: number;
}

type FunnelStep = keyof FunnelCounts;

const FUNNEL_STEP_EVENTS: Record<string, FunnelStep> = {
  first_session: 'install',
  pve_stage_completed: 'first_pve_completed',
  pvp_match_completed: 'first_pvp_completed',
  purchase_completed: 'first_purchase',
};

const STEP_TIMESTAMP_FIELDS: Record<Exclude<FunnelStep, 'updated_at'>, keyof PlayerFunnelState> = {
  install: 'install_timestamp',
  first_pve_completed: 'first_pve_timestamp',
  first_pvp_completed: 'first_pvp_timestamp',
  first_purchase: 'first_purchase_timestamp',
};

function makeEmptyState(userId: string): PlayerFunnelState {
  return {
    user_id: userId,
    install_timestamp: null,
    first_pve_timestamp: null,
    first_pvp_timestamp: null,
    first_purchase_timestamp: null,
    last_updated: Date.now(),
  };
}

function makeEmptyCounts(): FunnelCounts {
  return {
    install: 0,
    first_pve_completed: 0,
    first_pvp_completed: 0,
    first_purchase: 0,
    updated_at: Date.now(),
  };
}

function readPlayerState(nk: Runtime.Nakama, userId: string): PlayerFunnelState | null {
  try {
    const objects = nk.storageRead([{ collection: COLLECTION, key: KEY_PLAYER_STATE, userId }]);
    if (objects.length > 0) {
      return JSON.parse(objects[0].value) as PlayerFunnelState;
    }
  } catch (err) {
    logger.error('Failed to read player funnel state for %s: %s', userId, err);
  }
  return null;
}

function writePlayerState(nk: Runtime.Nakama, userId: string, state: PlayerFunnelState): void {
  try {
    nk.storageWrite([
      {
        collection: COLLECTION,
        key: KEY_PLAYER_STATE,
        userId,
        value: JSON.stringify(state),
      },
    ]);
  } catch (err) {
    logger.error('Failed to write player funnel state for %s: %s', userId, err);
  }
}

function readGlobalCounts(nk: Runtime.Nakama): FunnelCounts {
  try {
    const objects = nk.storageRead([
      { collection: COLLECTION, key: KEY_GLOBAL_COUNTS, userId: SYSTEM_USER_ID },
    ]);
    if (objects.length > 0) {
      return JSON.parse(objects[0].value) as FunnelCounts;
    }
  } catch (err) {
    logger.error('Failed to read global funnel counts: %s', err);
  }
  return makeEmptyCounts();
}

function writeGlobalCounts(nk: Runtime.Nakama, counts: FunnelCounts): void {
  try {
    nk.storageWrite([
      {
        collection: COLLECTION,
        key: KEY_GLOBAL_COUNTS,
        userId: SYSTEM_USER_ID,
        value: JSON.stringify(counts),
      },
    ]);
  } catch (err) {
    logger.error('Failed to write global funnel counts: %s', err);
  }
}

function updatePrometheusMetrics(counts: FunnelCounts): void {
  setFunnelPlayers('install', counts.install);
  setFunnelPlayers('first_pve_completed', counts.first_pve_completed);
  setFunnelPlayers('first_pvp_completed', counts.first_pvp_completed);
  setFunnelPlayers('first_purchase', counts.first_purchase);

  if (counts.install > 0) {
    setFunnelConversionRate(
      'install',
      'first_pve_completed',
      counts.first_pve_completed / counts.install
    );
    setFunnelConversionRate('install', 'first_purchase', counts.first_purchase / counts.install);
  }
  if (counts.first_pve_completed > 0) {
    setFunnelConversionRate(
      'first_pve_completed',
      'first_pvp_completed',
      counts.first_pvp_completed / counts.first_pve_completed
    );
  }
  if (counts.first_pvp_completed > 0) {
    setFunnelConversionRate(
      'first_pvp_completed',
      'first_purchase',
      counts.first_purchase / counts.first_pvp_completed
    );
  }

  setFunnelDropoff('install', counts.install - counts.first_pve_completed);
  setFunnelDropoff('first_pve_completed', counts.first_pve_completed - counts.first_pvp_completed);
  setFunnelDropoff('first_pvp_completed', counts.first_pvp_completed - counts.first_purchase);
}

export function processFunnelEvent(
  nk: Runtime.Nakama,
  loggerParam: Runtime.Logger,
  userId: string,
  eventName: string
): void {
  const step = FUNNEL_STEP_EVENTS[eventName];
  if (!step) return;

  let state = readPlayerState(nk, userId);
  if (!state) {
    state = makeEmptyState(userId);
  }

  const timestampField = STEP_TIMESTAMP_FIELDS[step];
  if ((state[timestampField] as number | null) !== null) return;

  (state[timestampField] as number | null) = Date.now();
  state.last_updated = Date.now();
  writePlayerState(nk, userId, state);

  const counts = readGlobalCounts(nk);
  counts[step]++;
  counts.updated_at = Date.now();
  writeGlobalCounts(nk, counts);

  updatePrometheusMetrics(counts);
  loggerParam.info('Funnel step %s completed for user %s', step, userId);
}

function computeCurrentStep(state: PlayerFunnelState): string {
  if (state.first_purchase_timestamp !== null) return 'first_purchase';
  if (state.first_pvp_timestamp !== null) return 'first_pvp_completed';
  if (state.first_pve_timestamp !== null) return 'first_pve_completed';
  if (state.install_timestamp !== null) return 'install';
  return 'none';
}

export function rpcGetFunnelConversion(
  _ctx: Runtime.Context,
  loggerParam: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  loggerParam.info('Funnel conversion requested');

  const validation = validatePayload(
    ZodSchemas.get_funnel_conversion,
    payload,
    'get_funnel_conversion'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_funnel_conversion', validation.error);
  }

  const counts = readGlobalCounts(nk);

  const installToPve = counts.install > 0 ? counts.first_pve_completed / counts.install : 0;
  const pveToPvp =
    counts.first_pve_completed > 0 ? counts.first_pvp_completed / counts.first_pve_completed : 0;
  const pvpToPurchase =
    counts.first_pvp_completed > 0 ? counts.first_purchase / counts.first_pvp_completed : 0;
  const overall = counts.install > 0 ? counts.first_purchase / counts.install : 0;

  const dropoff: Record<string, number> = {
    install: counts.install - counts.first_pve_completed,
    first_pve_completed: counts.first_pve_completed - counts.first_pvp_completed,
    first_pvp_completed: counts.first_pvp_completed - counts.first_purchase,
  };

  return JSON.stringify({
    success: true,
    counts: {
      install: counts.install,
      first_pve_completed: counts.first_pve_completed,
      first_pvp_completed: counts.first_pvp_completed,
      first_purchase: counts.first_purchase,
    },
    conversion_rates: {
      install_to_first_pve: Math.round(installToPve * 10000) / 100,
      first_pve_to_first_pvp: Math.round(pveToPvp * 10000) / 100,
      first_pvp_to_first_purchase: Math.round(pvpToPurchase * 10000) / 100,
      overall: Math.round(overall * 10000) / 100,
    },
    dropoff,
  });
}

export function rpcGetPlayerFunnelState(
  ctx: Runtime.Context,
  loggerParam: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  loggerParam.info('Player funnel state requested by user: %s', ctx.userId);

  const validation = validatePayload(
    ZodSchemas.get_player_funnel_state,
    payload,
    'get_player_funnel_state'
  );
  if (!validation.success) {
    return createValidationErrorResponse('get_player_funnel_state', validation.error);
  }

  const state = readPlayerState(nk, ctx.userId);

  if (!state) {
    return JSON.stringify({
      success: true,
      funnel_state: {
        current_step: 'none',
        steps_completed: [],
        days_since_install: 0,
      },
    });
  }

  const stepsCompleted: string[] = [];
  if (state.install_timestamp !== null) stepsCompleted.push('install');
  if (state.first_pve_timestamp !== null) stepsCompleted.push('first_pve_completed');
  if (state.first_pvp_timestamp !== null) stepsCompleted.push('first_pvp_completed');
  if (state.first_purchase_timestamp !== null) stepsCompleted.push('first_purchase');

  const daysSinceInstall =
    state.install_timestamp !== null
      ? Math.floor((Date.now() - state.install_timestamp) / 86400000)
      : 0;

  return JSON.stringify({
    success: true,
    funnel_state: {
      current_step: computeCurrentStep(state),
      steps_completed: stepsCompleted,
      install_timestamp: state.install_timestamp,
      first_pve_timestamp: state.first_pve_timestamp,
      first_pvp_timestamp: state.first_pvp_timestamp,
      first_purchase_timestamp: state.first_purchase_timestamp,
      days_since_install: daysSinceInstall,
    },
  });
}

export function registerFunnelAnalyticsEndpoints(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_funnel_conversion',
    'get_funnel_conversion',
    rpcGetFunnelConversion
  );
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_player_funnel_state',
    'get_player_funnel_state',
    rpcGetPlayerFunnelState
  );
}
