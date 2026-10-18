/**
 * Async-RPC registration guard (#1674).
 *
 * ADR-0008: Nakama's goja runtime has no promise-job scheduler, so an async
 * RPC handler is broken in production no matter how it is registered:
 *  - via registerRpcWithMetrics / registerRpcWithRateLimit: the metrics
 *    wrapper throws "returned a non-string result" on EVERY call;
 *  - via bare initializer.registerRpc: the pending Promise is rejected by
 *    Nakama as "Runtime function returned invalid data".
 *
 * Unit tests never see this because they call handlers directly (unwrapped).
 * This test closes the hole two ways:
 *
 *  1. STATIC: scans src/modules/*.ts sources and asserts no async handler
 *     (declared async fn, or const produced by a factory returning an async
 *     fn) is registered through any path — wrapped, direct, or admin-guarded
 *     (#1683: withAdminGuard also breaks on async handlers, silently for
 *     admin callers) — outside KNOWN_BROKEN.
 *  2. RUNTIME: invokes the wrapped handlers of the affected modules with a
 *     junk payload; every non-allowlisted handler must return a string
 *     (a validation error is a string; the ADR-0008 throw is not).
 *
 * KNOWN_BROKEN is a ratchet: it must only SHRINK. When a fix PR converts a
 * handler to sync, delete its id here — the test fails until you do.
 */

import * as fs from 'fs';
import * as path from 'path';
import { registerFairnessTelemetryEndpoints } from '../fairness_telemetry';
import { registerSeasonTelemetryEndpoints } from '../season_telemetry';
import { registerMatchmakingAnalyticsEndpoints } from '../matchmaking_analytics';
import { registerBalanceAnalyticsEndpoints } from '../balance_analytics';
import { registerRpcRunBalanceSession } from '../balance_session';
import { createMockLogger, createMockContext, createMockNakama } from '../../__mocks__/nakama';
import type { Runtime } from '../../types/nakama';

/** RPC ids known broken by the async-registration bug (#1674). Shrink-only. */
const KNOWN_BROKEN = new Set([]);

const MODULES_DIR = path.join(__dirname, '..');

interface Registration {
  rpcId: string;
  handler: string;
  via: 'wrapped' | 'direct' | 'admin-guarded';
  file: string;
}

function collectAsyncProducers(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(/(?:export\s+)?async function (\w+)/g)) {
    names.add(m[1]);
  }
  // Factories returning an async function, e.g. makeFairnessEventLogRpc:
  // `return async function fairnessEventLogRpc(` — mark the factory's products.
  const factories = new Set<string>();
  // Generics-tolerant: `function makeFoo<E>(...) { ... return async function`.
  // The bounded window may also capture a tiny unrelated function preceding a
  // factory; such false positives have no products, so they are inert.
  for (const m of source.matchAll(/function (\w+)[\s\S]{0,600}?return async function/g)) {
    factories.add(m[1]);
  }
  for (const f of factories) {
    // Products may call the factory with generics: makeFoo<Spec>({...})
    for (const m of source.matchAll(
      new RegExp(`(?:const|let|var) (\\w+) = ${f}\\s*(?:<[^>]*>)?\\s*\\(`, 'g')
    )) {
      names.add(m[1]);
    }
  }
  return names;
}

function collectRegistrations(source: string, file: string): Registration[] {
  const out: Registration[] = [];
  const wrapped =
    /registerRpcWith(?:Metrics|RateLimit)\(\s*initializer,\s*['"]([^'"]+)['"]\s*,\s*['"][^'"]+['"]\s*,\s*(\w+)\s*\)/g;
  for (const m of source.matchAll(wrapped)) {
    out.push({ rpcId: m[1], handler: m[2], via: 'wrapped', file });
  }
  const direct = /initializer\.registerRpc\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;
  for (const m of source.matchAll(direct)) {
    out.push({ rpcId: m[1], handler: m[2], via: 'direct', file });
  }
  // #1683: admin-gated RPCs wrap the real handler in withAdminGuard(...), so
  // the wrapped scan above only sees the guard itself. Catch the inner name.
  const guarded = /withAdminGuard\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)\s*\)/g;
  for (const m of source.matchAll(guarded)) {
    out.push({ rpcId: m[1], handler: m[2], via: 'admin-guarded', file });
  }
  return out;
}

describe('async-RPC registration guard (#1674)', () => {
  const sources = fs
    .readdirSync(MODULES_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, source: fs.readFileSync(path.join(MODULES_DIR, f), 'utf8') }));

  it('static: no async handler is registered outside KNOWN_BROKEN', () => {
    const offenders: string[] = [];
    const stillBroken = new Set<string>();
    for (const { file, source } of sources) {
      const asyncNames = collectAsyncProducers(source);
      for (const reg of collectRegistrations(source, file)) {
        if (asyncNames.has(reg.handler)) {
          if (KNOWN_BROKEN.has(reg.rpcId)) {
            stillBroken.add(reg.rpcId);
          } else {
            offenders.push(`${reg.rpcId} (${reg.handler}, ${reg.via}, ${reg.file})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
    // Ratchet bookkeeping: every allowlisted id that is STATICALLY VISIBLE
    // must still be detected as broken. When a fix lands, delete the id from
    // KNOWN_BROKEN. Loop-registered ids (the three season-telemetry query
    // RPCs) are invisible to this scan; the runtime check below covers them.
    const LOOP_REGISTERED = new Set([]);
    const fixedButNotRemoved = [...KNOWN_BROKEN].filter(
      (id) => !stillBroken.has(id) && !LOOP_REGISTERED.has(id)
    );
    expect(fixedButNotRemoved).toEqual([]);
  });

  it('runtime: wrapped handlers return strings (outside KNOWN_BROKEN)', () => {
    const registrars = [
      registerFairnessTelemetryEndpoints,
      registerSeasonTelemetryEndpoints,
      registerMatchmakingAnalyticsEndpoints,
      registerBalanceAnalyticsEndpoints,
      registerRpcRunBalanceSession,
    ];
    const handlers = new Map<string, Function>();
    for (const registrar of registrars) {
      const init = {
        registerRpc: jest.fn((id: string, handler: Function) => {
          handlers.set(id, handler);
        }),
      } as unknown as Runtime.Initializer;
      registrar(init);
    }
    expect(handlers.size).toBeGreaterThan(10);

    const ctx = createMockContext();
    const logger = createMockLogger();
    const wrongThrow: string[] = [];
    const noLongerBroken: string[] = [];
    for (const [id, handler] of handlers) {
      let result: string | null = null;
      let threw = false;
      try {
        result = handler(ctx, logger, createMockNakama(), 'not-json{') as string;
      } catch {
        threw = true;
      }
      if (KNOWN_BROKEN.has(id)) {
        // Allowlisted handlers must still fail loud (the ADR-0008 guard
        // throw). If one starts returning a string, it is fixed - remove it
        // from KNOWN_BROKEN.
        if (!threw && typeof result === 'string') {
          noLongerBroken.push(id);
        }
      } else {
        if (threw || typeof result !== 'string') {
          wrongThrow.push(id);
        }
      }
    }
    expect(wrongThrow).toEqual([]);
    expect(noLongerBroken).toEqual([]);
  });
});
