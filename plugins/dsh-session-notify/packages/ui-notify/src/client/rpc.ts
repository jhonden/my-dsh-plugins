/**
 * Direct `/api/sessionNotify/*` carrier calls, mirroring the wire protocol of
 * the generated Typert client: a client-request envelope POSTed to the
 * endpoint URL with a random rpcId matched on the response. Calling directly
 * keeps this distribution free of generated Remote contributions while still
 * using the Gateway-claimed, schema-validated endpoint.
 */
import type { NotifyMode, NotifyPrefs, NotifyPreviewResult, NotifySetArmedResult, NotifySetPrefsRequest, NotifySoundListResult, NotifyState } from '@gaowen/dsh-session-notify/types'

/** One RPC carrier outcome: a value, or a typed error identity. */
export type RpcOutcome<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

/** Random rpcId in the same UUID shape the shipped client uses. */
function randomRpcId(): string {
  return crypto.randomUUID()
}

/**
 * Build the `sessionNotify` caller bound to the browser origin.
 * @returns typed getState/setArmed/preview functions returning carrier outcomes.
 */
export function notifyRpc(): {
  getState: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifyState>>
  setArmed: (sessionId: string, armed: boolean, signal?: AbortSignal) => Promise<RpcOutcome<NotifySetArmedResult>>
  preview: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifyPreviewResult>>
  listSounds: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifySoundListResult>>
  getPrefs: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifyPrefs>>
  setPrefs: (sessionId: string, patch: NotifySetPrefsRequest, signal?: AbortSignal) => Promise<RpcOutcome<NotifyPrefs>>
} {
  async function call<T>(method: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<RpcOutcome<T>> {
    const rpcId = randomRpcId()
    try {
      const response = await fetch(new URL(`/api/sessionNotify/${method}`, globalThis.location.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method: `sessionNotify/${method}`, payload: { args } }),
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
    getState: (sessionId, signal) => call<NotifyState>('getState', { sessionId, request: {} }, signal),
    setArmed: (sessionId, armed, signal) => call<NotifySetArmedResult>('setArmed', { sessionId, request: { armed } }, signal),
    preview: (sessionId, signal) => call<NotifyPreviewResult>('preview', { sessionId, request: {} }, signal),
    listSounds: (sessionId, signal) => call<NotifySoundListResult>('listSounds', { sessionId, request: {} }, signal),
    getPrefs: (sessionId, signal) => call<NotifyPrefs>('getPrefs', { sessionId, request: {} }, signal),
    setPrefs: (sessionId, patch, signal) => call<NotifyPrefs>('setPrefs', { sessionId, request: patch }, signal),
  }
}