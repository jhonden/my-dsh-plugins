import type { FilesListResult, FilesReadResult } from '@gaowen/dsh-files-remote/types';
import type { RpcOutcome } from './rpc.ts';
/** The data face the plugin injects into both slot registrations. */
export interface FilesCallFace {
    list: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesListResult>>;
    read: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesReadResult>>;
}
/** Inject face provided by the plugin's overlay registration. */
export interface FilesExplorerProps {
    t: (key: string) => string;
    call: FilesCallFace;
    currentSessionId: () => string | undefined;
    close: () => void;
    subscribe: (listener: () => void) => () => void;
    isOpen: () => boolean;
}
/**
 * The drawer component. Visibility follows the frame-level open flag; the
 * tree starts at the workspace root and expands lazily per directory.
 */
export declare function FilesExplorer(props: FilesExplorerProps): import("react").JSX.Element | null;
//# sourceMappingURL=FilesExplorer.d.ts.map