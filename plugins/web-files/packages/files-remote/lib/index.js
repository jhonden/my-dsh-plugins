/**
 * Read-only Remote file access for the Web client, confined to the calling
 * session's workspace. Bounded directory listing, bounded text reading, and
 * an image preview HTTP route for markdown relative-image references. No
 * write, rename, or delete operation exists on this surface.
 */
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import { runRipgrep } from '@deepseek-ai/dsh-tool-fs-search';
import { MAX_IMAGE_BYTES, imageMediaTypeFor } from "./images.js";
/** Typed error carrying a stable machine-readable identity. */
export class FilesRemoteError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}
/** Escape glob metacharacters so the query matches literally inside the glob. */
function globEscape(value) {
    return value.replaceAll(/[\\*?[\]{}!]/g, char => `[${char === '\\' ? '\\\\' : char}]`);
}
/**
 * Files Remote service (`ctx.filesRemote`): the Host half of the Web file
 * explorer. Every operation resolves the caller-supplied session-relative path
 * through `ctx.fs`, which canonicalizes it (following symlinks), and then
 * requires canonical containment inside the session's cwd. A symlink that
 * escapes the workspace therefore resolves outside and is rejected by the
 * containment check, not by string inspection.
 */
let FilesRemoteService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _search_decorators;
    let _list_decorators;
    let _read_decorators;
    return class FilesRemoteService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _search_decorators = [Remote('search')];
            _list_decorators = [Remote('list')];
            _read_decorators = [Remote('read')];
            __esDecorate(this, null, _search_decorators, { kind: "method", name: "search", static: false, private: false, access: { has: obj => "search" in obj, get: obj => obj.search }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _read_decorators, { kind: "method", name: "read", static: false, private: false, access: { has: obj => "read" in obj, get: obj => obj.read }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['fs', 'subprocess'];
        static Config = z.object({
            maxEntries: z.number().int().positive().default(1000),
            maxReadChars: z.number().int().positive().default(512 * 1024),
            maxSearchPaths: z.number().int().positive().default(200),
        }).default(() => ({ maxEntries: 1000, maxReadChars: 512 * 1024, maxSearchPaths: 200 }));
        maxEntries = __runInitializers(this, _instanceExtraInitializers);
        maxReadChars;
        maxSearchPaths;
        constructor(ctx, config = { maxEntries: 1000, maxReadChars: 512 * 1024, maxSearchPaths: 200 }) {
            super(ctx, 'filesRemote');
            this.maxEntries = config.maxEntries;
            this.maxReadChars = config.maxReadChars;
            this.maxSearchPaths = config.maxSearchPaths;
            // Image preview route for markdown relative-image references. The /api
            // trust fence does not cover custom routes, so this handler enforces its
            // own same-origin check (a malicious page must not read local images via
            // <img src="http://127.0.0.1:...">).
            ctx.inject(['webServer'], webCtx => {
                ctx.effect(() => webCtx.webServer.register({
                    kind: 'prefix',
                    path: '/plugins-web-files/preview',
                    handler: (req, res) => { void this.servePreview(req, res); },
                }), 'files-remote: preview route');
            });
        }
        /**
         * Serve one workspace image: `GET /plugins-web-files/preview?sessionId=…&path=…`.
         * Same-origin enforced, extension allowlisted, workspace-confined, byte-capped.
         */
        async servePreview(req, res) {
            const fail = (status, code) => {
                if (res.headersSent) {
                    res.destroy();
                    return;
                }
                res.writeHead(status, { 'content-type': 'text/plain' });
                res.end(code);
            };
            if (!this.isSameOrigin(req)) {
                fail(403, 'cross-origin denied');
                return;
            }
            const url = new URL(req.url ?? '/', 'http://localhost');
            const sessionId = url.searchParams.get('sessionId') ?? '';
            const path = url.searchParams.get('path') ?? '';
            const mediaType = imageMediaTypeFor(path);
            if (sessionId === '' || path === '' || mediaType === undefined) {
                fail(400, 'bad request');
                return;
            }
            const sessions = this.ctx.get('sessions');
            const session = sessions?.get(sessionId);
            if (session === undefined) {
                fail(404, 'unknown session');
                return;
            }
            try {
                const fs = this.ctx.fs;
                const root = this.workspaceRoot(session);
                const target = await this.resolveInside(fs, root, path);
                const info = await fs.stat(target);
                if (info === undefined) {
                    fail(404, 'not found');
                    return;
                }
                if (info.type !== 'file') {
                    fail(404, 'not an image file');
                    return;
                }
                const bytes = await fs.readBytes(target, undefined, MAX_IMAGE_BYTES);
                res.writeHead(200, {
                    'content-type': mediaType,
                    'content-length': String(bytes.byteLength),
                    'cache-control': 'private, max-age=60',
                    'x-content-type-options': 'nosniff',
                });
                res.end(bytes);
            }
            catch (error) {
                if (error instanceof FilesRemoteError) {
                    fail(403, error.code);
                    return;
                }
                fail(500, 'read failed');
            }
        }
        /**
         * Same-origin fence: a browser's own fetch/img requests to this origin carry
         * `Sec-Fetch-Site: same-origin` (or no Sec-Fetch headers at all for plain
         * navigation loads); a cross-site embed carries `cross-site`. Non-browser
         * clients (curl, tests) send none of these headers. This mirrors the /api
         * fence's intent for an image route: block cross-page reads, allow tools.
         */
        isSameOrigin(req) {
            const site = req.headers['sec-fetch-site'];
            if (site === undefined)
                return req.headers.origin === undefined || req.headers.referer === undefined
                    ? true
                    : false;
            return site === 'same-origin' || site === 'same-site' || site === 'none';
        }
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
        async search(session, request) {
            const query = request.query.trim();
            if (query === '')
                return { paths: [], truncated: false };
            const run = await runRipgrep(this.ctx, 
            // runRipgrep consumes exactly exec.signal and exec.agent.session.header.cwd.
            { signal: new AbortController().signal, agent: { session } }, 'filesRemote/search', 
            // --iglob: case-insensitive glob matching (README matches readme).
            ['--files', '--sort=modified', `--iglob=**/*${globEscape(query)}*`,
                '--glob=!**/.git', '--glob=!**/.git/**', '--glob=!**/.hg', '--glob=!**/.hg/**',
                '--glob=!**/.svn', '--glob=!**/.svn/**'], 4 * 1024 * 1024, 5_000, 8 * 1024);
            const lines = run.stdout.split('\n').filter(line => line !== '');
            const truncated = lines.length > this.maxSearchPaths;
            const paths = (truncated ? lines.slice(0, this.maxSearchPaths) : lines)
                .map(line => line.replaceAll('\\', '/'));
            return { paths, truncated };
        }
        /**
         * List one directory inside the session workspace.
         * @param session - calling session; its immutable header cwd is the boundary.
         * @param request - session-relative directory path (`''` = workspace root).
         * @returns bounded, stably ordered direct children.
         */
        async list(session, request) {
            const fs = this.ctx.fs;
            const root = this.workspaceRoot(session);
            const target = await this.resolveInside(fs, root, request.path);
            const info = await fs.stat(target);
            if (info === undefined)
                throw new FilesRemoteError(`no such directory: ${request.path}`, 'FILES_NOT_FOUND');
            if (info.type !== 'directory') {
                throw new FilesRemoteError(`not a directory: ${request.path}`, 'FILES_NOT_A_DIRECTORY');
            }
            const children = await fs.listDir(target);
            const entries = [];
            let truncated = false;
            for (const child of children) {
                // `other` children (sockets, devices, broken links) carry no useful
                // explorer affordance; dropping them keeps the wire vocabulary closed.
                if (child.type === 'other')
                    continue;
                if (entries.length >= this.maxEntries) {
                    truncated = true;
                    break;
                }
                entries.push({ name: child.name, kind: child.type });
            }
            entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
            return { path: request.path, entries, truncated };
        }
        /**
         * Read one text file inside the session workspace, bounded by the decoded
         * character cap with an explicit `truncated` flag. Binary content is
         * rejected by the fs backend during text decoding.
         * @param session - calling session; its immutable header cwd is the boundary.
         * @param request - session-relative file path.
         * @returns bounded decoded content.
         */
        async read(session, request) {
            const fs = this.ctx.fs;
            const root = this.workspaceRoot(session);
            const target = await this.resolveInside(fs, root, request.path);
            const info = await fs.stat(target);
            if (info === undefined)
                throw new FilesRemoteError(`no such file: ${request.path}`, 'FILES_NOT_FOUND');
            if (info.type !== 'file') {
                throw new FilesRemoteError(`not a regular file: ${request.path}`, 'FILES_NOT_A_REGULAR_FILE');
            }
            // The path's final component may itself be a symlink; the explorer only
            // serves regular files, and a link inside the workspace still resolves
            // within it (already proven above), so lstat is a display fact, not a
            // security gate. Containment is the gate.
            const content = await fs.readText(target);
            return {
                path: request.path,
                bytes: info.size ?? null,
                truncated: content.length > this.maxReadChars,
                content: content.length > this.maxReadChars ? content.slice(0, this.maxReadChars) : content,
            };
        }
        /** The session's immutable workspace root; every access is relative to it. */
        workspaceRoot(session) {
            const cwd = session.header.cwd;
            if (typeof cwd !== 'string' || cwd.length === 0) {
                throw new FilesRemoteError('session has no workspace cwd', 'FILES_SESSION_WITHOUT_CWD');
            }
            return cwd;
        }
        /**
         * Resolve one session-relative path and require canonical containment.
         * `''` names the workspace root itself (`FileSystem.resolve` rejects an
         * empty path, so the root resolves through the cached root target).
         * `contains(parent, child)` is the backend-owned canonical check; a
         * symlink escaping the workspace resolves outside and fails here.
         */
        async resolveInside(fs, root, path) {
            const rootTarget = await (this.rootTargets.get(root) ?? this.cacheRootTarget(fs, root));
            if (path === '')
                return rootTarget;
            const target = await fs.resolve(path, { cwd: root });
            if (!fs.contains(rootTarget, target)) {
                throw new FilesRemoteError('path resolves outside the session workspace', 'FILES_PATH_OUTSIDE_WORKSPACE');
            }
            return target;
        }
        /** Root targets are stable per workspace; cache them per resolved path. */
        rootTargets = new Map();
        cacheRootTarget(fs, root) {
            const resolved = fs.resolve(root);
            this.rootTargets.set(root, resolved);
            return resolved;
        }
    };
})();
export { FilesRemoteService };
export default FilesRemoteService;
//# sourceMappingURL=index.js.map