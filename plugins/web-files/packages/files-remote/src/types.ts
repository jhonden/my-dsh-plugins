/**
 * Client-safe wire vocabulary for the files Remote namespace. Types only —
 * no runtime code, no Host imports, so `./types` is safe for the browser
 * bundle to reference.
 */

import type {} from '@deepseek-ai/dsh-session/types'

/** One direct child of a listed directory, in stable name order. */
export interface FilesDirEntry {
  /** Basename of the child inside the listed directory. */
  name: string
  /** `directory` sorts before `file`; `other` entries are omitted entirely. */
  kind: 'file' | 'directory'
}

/** Result of `files.list`. */
export interface FilesListResult {
  /** The session-cwd-relative path that was listed; `''` is the workspace root. */
  path: string
  /** Direct children in stable name order (directories first, then name). */
  entries: FilesDirEntry[]
  /** True when the listing exceeded `maxEntries` and was cut short. */
  truncated: boolean
}

/** Result of `files.read`. */
export interface FilesReadResult {
  /** The session-cwd-relative path that was read. */
  path: string
  /** Total file size in bytes, when the backend can report it. */
  bytes: number | null
  /** True when content was cut at `maxReadBytes` (in UTF-16 code units after decoding). */
  truncated: boolean
  /** The decoded UTF-8 content, possibly cut at the configured cap. */
  content: string
}

/** Request shape for `files.list`. */
export interface FilesListRequest {
  /** Session-cwd-relative directory path; `''` lists the workspace root. */
  path: string
}

/** Request shape for `files.read`. */
export interface FilesReadRequest {
  /** Session-cwd-relative file path. */
  path: string
}

/** Stable error identities surfaced through the Remote boundary. */
export type FilesErrorCode =
  | 'FILES_PATH_OUTSIDE_WORKSPACE'
  | 'FILES_NOT_FOUND'
  | 'FILES_NOT_A_DIRECTORY'
  | 'FILES_NOT_A_REGULAR_FILE'
  | 'FILES_SYMLINK_REJECTED'
  | 'FILES_TOO_LARGE'
  | 'FILES_BINARY_REJECTED'
  | 'FILES_SESSION_WITHOUT_CWD'
