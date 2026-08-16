import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { FilesListResult, FilesReadResult, FilesSearchResult } from '@gaowen/dsh-files-remote/types';
import type { RpcOutcome } from './rpc.ts';
/** The data face the plugin injects into the view registration. */
export interface FilesCallFace {
    list: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesListResult>>;
    read: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesReadResult>>;
    search: (sessionId: string, query: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesSearchResult>>;
}
/** Locale translate function bound to this plugin's namespace. */
type T = TranslateNS<'web-files'>;
/** Inject face provided by the plugin's view registration. */
export interface FilesViewProps {
    t: T;
    call: FilesCallFace;
    currentSessionId: () => string | undefined;
}
/**
 * The view component. The inject face (`props`) is recreated by the slot
 * renderer on its own schedule, so no effect depends on `props` identity:
 * everything reaches the effects through a ref, and the effects key on real
 * state only. Remounting (tab switch away/back) reloads from scratch.
 */
export declare function FilesView(props: FilesViewProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=FilesView.d.ts.map