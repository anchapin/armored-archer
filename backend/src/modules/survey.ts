/**
 * Survey feedback module.
 * @fileoverview RPC endpoints for collecting post-match and post-purchase player feedback.
 */

import { getStructuredLogger } from '../index';
import { Runtime } from '../types/nakama';
import { registerRpcWithMetrics } from './metrics';
import { validatePayload, ZodSchemas, createValidationErrorResponse } from './validation';

const SURVEY_COLLECTION = 'surveys';
const MAX_SUBMISSIONS_PER_DAY = 3;
const COOLDOWN_SECONDS: Record<string, number> = {
  post_match: 4 * 60 * 60,
  post_purchase: 24 * 60 * 60,
};

function getLogger() {
  return getStructuredLogger();
}

/**
 * Registers the submit survey RPC endpoint.
 */
export function registerRpcSubmitSurvey(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/submit_survey',
    'submit_survey',
    rpcSubmitSurvey
  );
}

/**
 * Registers the get survey status RPC endpoint.
 */
export function registerRpcGetSurveyStatus(initializer: Runtime.Initializer): void {
  registerRpcWithMetrics(
    initializer,
    'armored_archer/get_survey_status',
    'get_survey_status',
    rpcGetSurveyStatus
  );
}

/**
 * Submit a survey response. Rate-limited to MAX_SUBMISSIONS_PER_DAY per survey type per 24h.
 */
export function rpcSubmitSurvey(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  getLogger().info('Survey submission requested', {
    rpcName: 'armored_archer/submit_survey',
    userId: ctx.userId,
  });

  const validation = validatePayload(ZodSchemas.submit_survey, payload, 'submit_survey');
  if (!validation.success) {
    return createValidationErrorResponse('submit_survey', validation.error);
  }

  const data = validation.data;
  const surveyType: string = data.survey_type;
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  // Check rate limit by listing recent submissions
  const storageObjects = nk.storageList(
    ctx.userId,
    SURVEY_COLLECTION,
    100,
    '',
    `${surveyType}_${ctx.userId}`
  );
  const recentSubmissions = storageObjects.filter(
    (obj: any) => obj.updateTime !== null && new Date(obj.updateTime).getTime() > twentyFourHoursAgo
  );

  if (recentSubmissions.length >= MAX_SUBMISSIONS_PER_DAY) {
    getLogger().warn('Survey rate limit exceeded', {
      userId: ctx.userId,
      surveyType,
      recentCount: recentSubmissions.length,
    });
    return JSON.stringify({
      error: 'Rate limit exceeded. Maximum 3 survey submissions per type per 24 hours.',
    });
  }

  // Store the survey response
  const storageKey = `${surveyType}_${ctx.userId}_${now}`;
  const storageValue = JSON.stringify({
    survey_type: surveyType,
    survey_data: data.survey_data,
    client_timestamp: data.client_timestamp,
    server_timestamp: now,
  });

  nk.storageWrite([
    {
      collection: SURVEY_COLLECTION,
      key: storageKey,
      userId: ctx.userId,
      value: storageValue,
    },
  ]);

  getLogger().info('Survey response recorded', {
    userId: ctx.userId,
    surveyType,
    storageKey,
  });

  return JSON.stringify({ success: true, survey_id: storageKey });
}

/**
 * Get survey eligibility status for the current user. Returns whether the user
 * can be shown a survey prompt and how long until they become eligible.
 */
export function rpcGetSurveyStatus(
  ctx: Runtime.Context,
  logger: Runtime.Logger,
  nk: Runtime.Nakama,
  payload: string
): string {
  getLogger().info('Survey status requested', {
    rpcName: 'armored_archer/get_survey_status',
    userId: ctx.userId,
  });

  const validation = validatePayload(ZodSchemas.get_survey_status, payload, 'get_survey_status');
  if (!validation.success) {
    return createValidationErrorResponse('get_survey_status', validation.error);
  }

  const surveyType: string = validation.data.survey_type;
  const cooldownSec = COOLDOWN_SECONDS[surveyType] ?? 4 * 60 * 60;
  const now = Date.now();

  // Find most recent submission of this type
  const storageObjects = nk.storageList(
    ctx.userId,
    SURVEY_COLLECTION,
    1,
    '',
    `${surveyType}_${ctx.userId}`
  );
  let eligible = true;
  let cooldownRemainingSec = 0;

  if (storageObjects && storageObjects.length > 0) {
    const latest = storageObjects[0];
    if (latest.updateTime) {
      const lastTime = new Date(latest.updateTime).getTime();
      const elapsed = now - lastTime;
      if (elapsed < cooldownSec * 1000) {
        eligible = false;
        cooldownRemainingSec = Math.ceil((cooldownSec * 1000 - elapsed) / 1000);
      }
    }
  }

  return JSON.stringify({ eligible, cooldown_remaining_sec: cooldownRemainingSec });
}
