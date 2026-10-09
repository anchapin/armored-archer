/** nakama-js already decodes JSON RPC payloads; older adapters returned strings. */
export function parseRpcPayload(payload: unknown): Record<string, unknown> {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (parsed === null || parsed === undefined) return {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('RPC payload must be an object');
  }
  return parsed as Record<string, unknown>;
}
