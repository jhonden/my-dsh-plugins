/**
 * Read-only Remote file access for the Web client, confined to the calling
 * session's workspace. Two operations: bounded directory listing and bounded
 * text reading. No write, rename, or delete operation exists on this surface.
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
/** Typed error carrying a stable machine-readable identity. */
export class FilesRemoteError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
    }
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
    let _list_decorators;
    let _read_decorators;
    return class FilesRemoteService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _list_decorators = [Remote('list')];
            _read_decorators = [Remote('read')];
            __esDecorate(this, null, _list_decorators, { kind: "method", name: "list", static: false, private: false, access: { has: obj => "list" in obj, get: obj => obj.list }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _read_decorators, { kind: "method", name: "read", static: false, private: false, access: { has: obj => "read" in obj, get: obj => obj.read }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['fs'];
        static Config = z.object({
            maxEntries: z.number().int().positive().default(1000),
            maxReadChars: z.number().int().positive().default(512 * 1024),
        }).default(() => ({ maxEntries: 1000, maxReadChars: 512 * 1024 }));
        maxEntries = __runInitializers(this, _instanceExtraInitializers);
        maxReadChars;
        constructor(ctx, config = { maxEntries: 1000, maxReadChars: 512 * 1024 }) {
            super(ctx, 'filesRemote');
            this.maxEntries = config.maxEntries;
            this.maxReadChars = config.maxReadChars;
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