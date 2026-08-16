/**
 * Read-only Remote file access for the Web client, confined to the calling
 * session's workspace. Bounded directory listing, bounded text reading, and
 * an image preview HTTP route for markdown relative-image references. No
 * write, rename, or delete operation exists on this surface.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Session } from '@deepseek-ai/dsh-session';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import type { FilesErrorCode, FilesListRequest, FilesListResult, FilesReadRequest, FilesReadResult, FilesSearchRequest, FilesSearchResult } from './types.ts';
export type * from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Read-only workspace file access for the Web client (`filesRemote/list|read`). */
        filesRemote: FilesRemoteService;
    }
}
/** Deployment-tunable bounds; fixed security rules live in the method bodies. */
export type Config = z.infer<typeof FilesRemoteService.Config>;
/** Typed error carrying a stable machine-readable identity. */
export declare class FilesRemoteError extends Error {
    readonly code: FilesErrorCode;
    constructor(message: string, code: FilesErrorCode);
}
/**
 * Files Remote service (`ctx.filesRemote`): the Host half of the Web file
 * explorer. Every operation resolves the caller-supplied session-relative path
 * through `ctx.fs`, which canonicalizes it (following symlinks), and then
 * requires canonical containment inside the session's cwd. A symlink that
 * escapes the workspace therefore resolves outside and is rejected by the
 * containment check, not by string inspection.
 */
export declare class FilesRemoteService extends TypertRemoteService {
    static inject: string[];
    static Config: z.ZodDefault<z.ZodObject<{
        maxEntries: z.ZodDefault<z.ZodNumber>;
        maxReadChars: z.ZodDefault<z.ZodNumber>;
        maxSearchPaths: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    private readonly maxEntries;
    private readonly maxReadChars;
    private readonly maxSearchPaths;
    constructor(ctx: Context, config?: Config);
    /**
     * Serve one workspace image: `GET /plugins-web-files/preview?sessionId=…&path=…`.
     * Same-origin enforced, extension allowlisted, workspace-confined, byte-capped.
     */
    private servePreview;
    /**
     * Same-origin fence: a browser's own fetch/img requests to this origin carry
     * `Sec-Fetch-Site: same-origin` (or no Sec-Fetch headers at all for plain
     * navigation loads); a cross-site embed carries `cross-site`. Non-browser
     * clients (curl, tests) send none of these headers. This mirrors the /api
     * fence's intent for an image route: block cross-page reads, allow tools.
     */
    private isSameOrigin;
    /**
     * Recursively find workspace file paths whose path contains the query
     * (case-insensitive), newest-modified first, through the packaged ripgrep
     * binary. The session cwd is the rg workdir, so the search is
     * workspace-confined by construction; VCS metadata directories are pruned
     * and node_modules follows gitignore when present.
     * @param session - calling session; its immutable header cwd is the search root.
     * @param request - the path substring.
     * @returns matched workspace-relative paths, capped, with a truncated flag.
     */
    search(session: Session, request: FilesSearchRequest): Promise<FilesSearchResult>;
    /**
     * List one directory inside the session workspace.
     * @param session - calling session; its immutable header cwd is the boundary.
     * @param request - session-relative directory path (`''` = workspace root).
     * @returns bounded, stably ordered direct children.
     */
    list(session: Session, request: FilesListRequest): Promise<FilesListResult>;
    /**
     * Read one text file inside the session workspace, bounded by the decoded
     * character cap with an explicit `truncated` flag. Binary content is
     * rejected by the fs backend during text decoding.
     * @param session - calling session; its immutable header cwd is the boundary.
     * @param request - session-relative file path.
     * @returns bounded decoded content.
     */
    read(session: Session, request: FilesReadRequest): Promise<FilesReadResult>;
    /** The session's immutable workspace root; every access is relative to it. */
    private workspaceRoot;
    /**
     * Resolve one session-relative path and require canonical containment.
     * `''` names the workspace root itself (`FileSystem.resolve` rejects an
     * empty path, so the root resolves through the cached root target).
     * `contains(parent, child)` is the backend-owned canonical check; a
     * symlink escaping the workspace resolves outside and fails here.
     */
    private resolveInside;
    /** Root targets are stable per workspace; cache them per resolved path. */
    private readonly rootTargets;
    private cacheRootTarget;
}
export default FilesRemoteService;
//# sourceMappingURL=index.d.ts.map