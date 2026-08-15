/**
 * Direct `/api/filesRemote/*` carrier calls. Mirrors the wire protocol of the
 * generated Typert client (`connection.rpc.call('/api', endpoint, { args })`):
 * a client-request envelope POSTed to the endpoint URL, with a random rpcId
 * matched on the response. Calling directly keeps this distribution free of
 * generated Remote contributions while still using the Gateway-claimed,
 * schema-validated endpoint.
 */
import type { FilesListResult, FilesReadResult } from '@gaowen/dsh-files-remote/types';
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
 * Build the `filesRemote` caller bound to the browser origin.
 * @returns typed list/read functions returning carrier outcomes.
 */
export declare function filesRpc(): {
    list: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesListResult>>;
    read: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesReadResult>>;
};
//# sourceMappingURL=rpc.d.ts.map