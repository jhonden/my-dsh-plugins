/**
 * Read-only Remote file access for the Web client, confined to the calling
 * session's workspace. Bounded directory listing, bounded text reading, and
 * an image preview HTTP route for markdown relative-image references. No
 * write, rename, or delete operation exists on this surface.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { FileSystem, FsTarget } from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { Session } from '@deepseek-ai/dsh-session'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import type {
  FilesDirEntry,
  FilesErrorCode,
  FilesListRequest,
  FilesListResult,
  FilesReadRequest,
  FilesReadResult,
  FilesSearchRequest,
  FilesSearchResult,
} from './types.ts'
import { runRipgrep } from '@deepseek-ai/dsh-tool-fs-search'
import { MAX_IMAGE_BYTES, imageMediaTypeFor } from './images.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Read-only workspace file access for the Web client (`filesRemote/list|read`). */
    filesRemote: FilesRemoteService
  }
}

/** Deployment-tunable bounds; fixed security rules live in the method bodies. */
export type Config = z.infer<typeof FilesRemoteService.Config>

/** Typed error carrying a stable machine-readable identity. */
export class FilesRemoteError extends Error {
  readonly code: FilesErrorCode

  constructor(message: string, code: FilesErrorCode) {
    super(message)
    this.code = code
  }
}

/** Escape glob metacharacters so the query matches literally inside the glob. */
function globEscape(value: string): string {
  return value.replaceAll(/[\\*?[\]{}!]/g, char => `[${char === '\\' ? '\\\\' : char}]`)
}

/**
 * Files Remote service (`ctx.filesRemote`): the Host half of the Web file
 * explorer. Every operation resolves the caller-supplied session-relative path
 * through `ctx.fs`, which canonicalizes it (following symlinks), and then
 * requires canonical containment inside the session's cwd. A symlink that
 * escapes the workspace therefore resolves outside and is rejected by the
 * containment check, not by string inspection.
 */
export class FilesRemoteService extends TypertRemoteService {
  static inject = ['fs', 'subprocess']

  static Config = z.object({
    maxEntries: z.number().int().positive().default(1000),
    maxReadChars: z.number().int().positive().default(512 * 1024),
    maxSearchPaths: z.number().int().positive().default(200),
  }).default(() => ({ maxEntries: 1000, maxReadChars: 512 * 1024, maxSearchPaths: 200 }))

  private readonly maxEntries: number
  private readonly maxReadChars: number
  private readonly maxSearchPaths: number

  constructor(ctx: Context, config: Config = { maxEntries: 1000, maxReadChars: 512 * 1024, maxSearchPaths: 200 }) {
    super(ctx, 'filesRemote')
    this.maxEntries = config.maxEntries
    this.maxReadChars = config.maxReadChars
    this.maxSearchPaths = config.maxSearchPaths
    // Image preview route for markdown relative-image references. The /api
    // trust fence does not cover custom routes, so this handler enforces its
    // own same-origin check (a malicious page must not read local images via
    // <img src="http://127.0.0.1:...">).
    ctx.inject(['webServer'], webCtx => {
      ctx.effect(() => webCtx.webServer.register({
        kind: 'prefix',
        path: '/plugins-web-files/preview',
        handler: (req, res) => { void this.servePreview(req, res) },
      }), 'files-remote: preview route')
    })
  }

  /**
   * Serve one workspace image: `GET /plugins-web-files/preview?sessionId=…&path=…`.
   * Same-origin enforced, extension allowlisted, workspace-confined, byte-capped.
   */
  private async servePreview(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const fail = (status: number, code: string): void => {
      if (res.headersSent) { res.destroy(); return }
      res.writeHead(status, { 'content-type': 'text/plain' })
      res.end(code)
    }
    if (!this.isSameOrigin(req)) { fail(403, 'cross-origin denied'); return }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId') ?? ''
    const path = url.searchParams.get('path') ?? ''
    const mediaType = imageMediaTypeFor(path)
    if (sessionId === '' || path === '' || mediaType === undefined) {
      fail(400, 'bad request')
      return
    }

    const sessions = this.ctx.get('sessions') as
      | { get(id: string): Session | undefined }
      | undefined
    const session = sessions?.get(sessionId)
    if (session === undefined) { fail(404, 'unknown session'); return }

    try {
      const fs = this.ctx.fs
      const root = this.workspaceRoot(session)
      const target = await this.resolveInside(fs, root, path)
      const info = await fs.stat(target)
      if (info === undefined) { fail(404, 'not found'); return }
      if (info.type !== 'file') { fail(404, 'not an image file'); return }
      const bytes = await fs.readBytes(target, undefined, MAX_IMAGE_BYTES)
      res.writeHead(200, {
        'content-type': mediaType,
        'content-length': String(bytes.byteLength),
        'cache-control': 'private, max-age=60',
        'x-content-type-options': 'nosniff',
      })
      res.end(bytes)
    } catch (error) {
      if (error instanceof FilesRemoteError) { fail(403, error.code); return }
      fail(500, 'read failed')
    }
  }

  /**
   * Same-origin fence: a browser's own fetch/img requests to this origin carry
   * `Sec-Fetch-Site: same-origin` (or no Sec-Fetch headers at all for plain
   * navigation loads); a cross-site embed carries `cross-site`. Non-browser
   * clients (curl, tests) send none of these headers. This mirrors the /api
   * fence's intent for an image route: block cross-page reads, allow tools.
   */
  private isSameOrigin(req: IncomingMessage): boolean {
    const site = req.headers['sec-fetch-site']
    if (site === undefined) return req.headers.origin === undefined || req.headers.referer === undefined
      ? true
      : false
    return site === 'same-origin' || site === 'same-site' || site === 'none'
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
  @Remote('search')
  async search(session: Session, request: FilesSearchRequest): Promise<FilesSearchResult> {
    const query = request.query.trim()
    if (query === '') return { paths: [], truncated: false }
    const run = await runRipgrep(
      this.ctx,
      // runRipgrep consumes exactly exec.signal and exec.agent.session.header.cwd.
      { signal: new AbortController().signal, agent: { session } } as never,
      'filesRemote/search',
      // --iglob: case-insensitive glob matching (README matches readme).
      ['--files', '--sort=modified', `--iglob=**/*${globEscape(query)}*`,
        '--glob=!**/.git', '--glob=!**/.git/**', '--glob=!**/.hg', '--glob=!**/.hg/**',
        '--glob=!**/.svn', '--glob=!**/.svn/**'],
      4 * 1024 * 1024,
      5_000,
      8 * 1024,
    )
    const lines = run.stdout.split('\n').filter(line => line !== '')
    const truncated = lines.length > this.maxSearchPaths
    const paths = (truncated ? lines.slice(0, this.maxSearchPaths) : lines)
      .map(line => line.replaceAll('\\', '/'))
    return { paths, truncated }
  }

  /**
   * List one directory inside the session workspace.
   * @param session - calling session; its immutable header cwd is the boundary.
   * @param request - session-relative directory path (`''` = workspace root).
   * @returns bounded, stably ordered direct children.
   */
  @Remote('list')
  async list(session: Session, request: FilesListRequest): Promise<FilesListResult> {
    const fs = this.ctx.fs
    const root = this.workspaceRoot(session)
    const target = await this.resolveInside(fs, root, request.path)
    const info = await fs.stat(target)
    if (info === undefined) throw new FilesRemoteError(`no such directory: ${request.path}`, 'FILES_NOT_FOUND')
    if (info.type !== 'directory') {
      throw new FilesRemoteError(`not a directory: ${request.path}`, 'FILES_NOT_A_DIRECTORY')
    }
    const children = await fs.listDir(target)
    const entries: FilesDirEntry[] = []
    let truncated = false
    for (const child of children) {
      // `other` children (sockets, devices, broken links) carry no useful
      // explorer affordance; dropping them keeps the wire vocabulary closed.
      if (child.type === 'other') continue
      if (entries.length >= this.maxEntries) {
        truncated = true
        break
      }
      entries.push({ name: child.name, kind: child.type })
    }
    entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1))
    return { path: request.path, entries, truncated }
  }

  /**
   * Read one text file inside the session workspace, bounded by the decoded
   * character cap with an explicit `truncated` flag. Binary content is
   * rejected by the fs backend during text decoding.
   * @param session - calling session; its immutable header cwd is the boundary.
   * @param request - session-relative file path.
   * @returns bounded decoded content.
   */
  @Remote('read')
  async read(session: Session, request: FilesReadRequest): Promise<FilesReadResult> {
    const fs = this.ctx.fs
    const root = this.workspaceRoot(session)
    const target = await this.resolveInside(fs, root, request.path)
    const info = await fs.stat(target)
    if (info === undefined) throw new FilesRemoteError(`no such file: ${request.path}`, 'FILES_NOT_FOUND')
    if (info.type !== 'file') {
      throw new FilesRemoteError(`not a regular file: ${request.path}`, 'FILES_NOT_A_REGULAR_FILE')
    }
    // The path's final component may itself be a symlink; the explorer only
    // serves regular files, and a link inside the workspace still resolves
    // within it (already proven above), so lstat is a display fact, not a
    // security gate. Containment is the gate.
    const content = await fs.readText(target)
    return {
      path: request.path,
      bytes: info.size ?? null,
      truncated: content.length > this.maxReadChars,
      content: content.length > this.maxReadChars ? content.slice(0, this.maxReadChars) : content,
    }
  }

  /** The session's immutable workspace root; every access is relative to it. */
  private workspaceRoot(session: Session): string {
    const cwd = session.header.cwd
    if (typeof cwd !== 'string' || cwd.length === 0) {
      throw new FilesRemoteError('session has no workspace cwd', 'FILES_SESSION_WITHOUT_CWD')
    }
    return cwd
  }

  /**
   * Resolve one session-relative path and require canonical containment.
   * `''` names the workspace root itself (`FileSystem.resolve` rejects an
   * empty path, so the root resolves through the cached root target).
   * `contains(parent, child)` is the backend-owned canonical check; a
   * symlink escaping the workspace resolves outside and fails here.
   */
  private async resolveInside(fs: FileSystem, root: string, path: string): Promise<FsTarget> {
    const rootTarget = await (this.rootTargets.get(root) ?? this.cacheRootTarget(fs, root))
    if (path === '') return rootTarget
    const target = await fs.resolve(path, { cwd: root })
    if (!fs.contains(rootTarget, target)) {
      throw new FilesRemoteError('path resolves outside the session workspace', 'FILES_PATH_OUTSIDE_WORKSPACE')
    }
    return target
  }

  /** Root targets are stable per workspace; cache them per resolved path. */
  private readonly rootTargets = new Map<string, Promise<FsTarget>>()

  private cacheRootTarget(fs: FileSystem, root: string): Promise<FsTarget> {
    const resolved = fs.resolve(root)
    this.rootTargets.set(root, resolved)
    return resolved
  }
}

export default FilesRemoteService
