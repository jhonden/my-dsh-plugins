/** Random rpcId in the same UUID shape the shipped client uses. */
function randomRpcId() {
    return crypto.randomUUID();
}
/**
 * Build the `filesRemote` caller bound to the browser origin.
 * @returns typed list/read functions returning carrier outcomes.
 */
export function filesRpc() {
    async function call(method, args, signal) {
        const rpcId = randomRpcId();
        try {
            const response = await fetch(new URL(`/api/filesRemote/${method}`, globalThis.location.origin), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'client-request', rpcId, method: `filesRemote/${method}`, payload: { args } }),
                ...(signal === undefined ? {} : { signal }),
            });
            if (!response.ok) {
                return { ok: false, error: { code: 'transport', message: `HTTP ${response.status}` } };
            }
            const full = await response.json();
            if (full.rpcId !== rpcId) {
                return { ok: false, error: { code: 'rpc-id-mismatch', message: 'carrier returned a mismatched rpcId' } };
            }
            if (!full.result.ok) {
                return { ok: false, error: { code: full.result.error?.code ?? 'unknown', message: full.result.error?.message ?? 'unknown error' } };
            }
            return { ok: true, value: full.result.value };
        }
        catch (error) {
            return { ok: false, error: { code: 'transport', message: error instanceof Error ? error.message : String(error) } };
        }
    }
    return {
        list: (sessionId, path, signal) => call('list', { sessionId, path }, signal),
        read: (sessionId, path, signal) => call('read', { sessionId, path }, signal),
    };
}
//# sourceMappingURL=rpc.js.map