/**
 * Read-only Remote file access for the Web client, confined to the calling
 * session's workspace. Two operations: bounded directory listing and bounded
 * text reading. No write, rename, or delete operation exists on this surface.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { FileSystem, FsTarget } from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-fs'
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
} from './types.ts'

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

/**
 * Files Remote service (`ctx.filesRemote`): the Host half of the Web file
 * explorer. Every operation resolves the caller-supplied session-relative path
 * through `ctx.fs`, which canonicalizes it (following symlinks), and then
 * requires canonical containment inside the session's cwd. A symlink that
 * escapes the workspace therefore resolves outside and is rejected by the
 * containment check, not by string inspection.
 */
export class FilesRemoteService extends TypertRemoteService {
  static inject = ['fs']

  static Config = z.object({
    maxEntries: z.number().int().positive().default(1000),
    maxReadChars: z.number().int().positive().default(512 * 1024),
  }).default(() => ({ maxEntries: 1000, maxReadChars: 512 * 1024 }))

  private readonly maxEntries: number
  private readonly maxReadChars: number

  constructor(ctx: Context, config: Config = { maxEntries: 1000, maxReadChars: 512 * 1024 }) {
    super(ctx, 'filesRemote')
    this.maxEntries = config.maxEntries
    this.maxReadChars = config.maxReadChars
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
