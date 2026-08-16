/**
 * Direct `/api/filesRemote/*` carrier calls. Mirrors the wire protocol of the
 * generated Typert client (`connection.rpc.call('/api', endpoint, { args })`):
 * a client-request envelope POSTed to the endpoint URL, with a random rpcId
 * matched on the response. Calling directly keeps this distribution free of
 * generated Remote contributions while still using the Gateway-claimed,
 * schema-validated endpoint.
 */
import type { FilesListResult, FilesReadResult, FilesSearchResult } from '@gaowen/dsh-files-remote/types'

/** One RPC carrier outcome: a value, or a typed error identity. */
export type RpcOutcome<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

/** Random rpcId in the same UUID shape the shipped client uses. */
function randomRpcId(): string {
  return crypto.randomUUID()
}

/**
 * Build the `filesRemote` caller bound to the browser origin.
 * @returns typed list/read functions returning carrier outcomes.
 */
export function filesRpc(): {
  list: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesListResult>>
  read: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesReadResult>>
  search: (sessionId: string, query: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesSearchResult>>
} {
  async function call<T>(method: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<RpcOutcome<T>> {
    const rpcId = randomRpcId()
    try {
      const response = await fetch(new URL(`/api/filesRemote/${method}`, globalThis.location.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method: `filesRemote/${method}`, payload: { args } }),
        ...(signal === undefined ? {} : { signal }),
      })
      if (!response.ok) {
        return { ok: false, error: { code: 'transport', message: `HTTP ${response.status}` } }
      }
      const full = await response.json() as { rpcId: string; result: { ok: boolean; value?: T; error?: { code?: string; message?: string } } }
      if (full.rpcId !== rpcId) {
        return { ok: false, error: { code: 'rpc-id-mismatch', message: 'carrier returned a mismatched rpcId' } }
      }
      if (!full.result.ok) {
        return { ok: false, error: { code: full.result.error?.code ?? 'unknown', message: full.result.error?.message ?? 'unknown error' } }
      }
      return { ok: true, value: full.result.value as T }
    } catch (error) {
      return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } }
    }
  }
  return {
    // The gateway descriptor maps the Session parameter to `sessionId` and
    // keeps the request object under its declared `request` wire name.
    list: (sessionId, path, signal) => call<FilesListResult>('list', { sessionId, request: { path } }, signal),
    read: (sessionId, path, signal) => call<FilesReadResult>('read', { sessionId, request: { path } }, signal),
    search: (sessionId, query, signal) => call<FilesSearchResult>('search', { sessionId, request: { query } }, signal),
  }
}
