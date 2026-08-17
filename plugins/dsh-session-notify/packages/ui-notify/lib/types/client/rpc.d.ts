/**
 * Direct `/api/sessionNotify/*` carrier calls, mirroring the wire protocol of
 * the generated Typert client: a client-request envelope POSTed to the
 * endpoint URL with a random rpcId matched on the response. Calling directly
 * keeps this distribution free of generated Remote contributions while still
 * using the Gateway-claimed, schema-validated endpoint.
 */
import type { NotifyPreviewResult, NotifySetArmedResult, NotifySoundListResult, NotifyState } from '@gaowen/dsh-session-notify/types';
/** One RPC carrier outcome: a value, or a typed error identity. */
export type RpcOutcome<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
/**
 * Build the `sessionNotify` caller bound to the browser origin.
 * @returns typed getState/setArmed/preview functions returning carrier outcomes.
 */
export declare function notifyRpc(): {
    getState: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifyState>>;
    setArmed: (sessionId: string, armed: boolean, signal?: AbortSignal) => Promise<RpcOutcome<NotifySetArmedResult>>;
    preview: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifyPreviewResult>>;
    listSounds: (sessionId: string, signal?: AbortSignal) => Promise<RpcOutcome<NotifySoundListResult>>;
};
//# sourceMappingURL=rpc.d.ts.map