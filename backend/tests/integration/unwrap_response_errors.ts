/**
 * Integration-test diagnostics: nakama-js rejects with the raw fetch
 * `Response` on any non-2xx reply, which Jest prints as `thrown: Response {}`
 * and hides the status code and server message. This setup file wraps every
 * async method on the nakama-js `Client` prototype so a rejected `Response`
 * is rethrown as an `Error` naming the method, HTTP status and response body.
 *
 * Wired via `setupFilesAfterEnv` in jest.integration.config.js so it applies
 * to every integration suite, not just the ones importing helpers.ts.
 */
import { Client } from '@heroiclabs/nakama-js';

const WRAPPED = Symbol.for('armored_archer.unwrapResponseErrors');

function isFetchResponse(value: unknown): value is Response {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Response).status === 'number' &&
    typeof (value as Response).text === 'function'
  );
}

export async function responseToError(method: string, res: Response): Promise<Error> {
  let body = '';
  try {
    body = (await res.text()).slice(0, 500);
  } catch {
    body = '<body unreadable>';
  }
  const err = new Error(`nakama ${method} -> HTTP ${res.status} ${res.statusText || ''}: ${body}`);
  (err as Error & { status?: number }).status = res.status;
  return err;
}

export function installResponseUnwrapper(target: Record<string | symbol, unknown>): void {
  if (target[WRAPPED]) return;
  for (const name of Object.getOwnPropertyNames(target)) {
    if (name === 'constructor') continue;
    const desc = Object.getOwnPropertyDescriptor(target, name);
    if (!desc || typeof desc.value !== 'function') continue;
    const original = desc.value as (...args: unknown[]) => unknown;
    target[name] = function (this: unknown, ...args: unknown[]) {
      const out = original.apply(this, args);
      if (out && typeof (out as Promise<unknown>).catch === 'function') {
        return (out as Promise<unknown>).catch(async (e: unknown) => {
          throw isFetchResponse(e) ? await responseToError(name, e) : e;
        });
      }
      return out;
    };
  }
  target[WRAPPED] = true;
}

installResponseUnwrapper(Client.prototype as unknown as Record<string | symbol, unknown>);
