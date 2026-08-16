/**
 * Search-result path presentation: split a workspace-relative path into a
 * dim directory segment and a file-name segment, and when the directory
 * segment is too long compress it with a middle ellipsis — the tail of the
 * directory (the most discriminative part) and the full file name always
 * stay visible.
 */

/** One rendered path row's segments. */
export interface PathSegments {
  /** Directory portion including the trailing `/`, or `''` for a root file. */
  dir: string
  /** The file name; never truncated. */
  name: string
}

/** Split a path into directory (with trailing separator) and file name. */
export function splitPath(path: string): PathSegments {
  const slash = path.lastIndexOf('/')
  if (slash === -1) return { dir: '', name: path }
  return { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) }
}

/**
 * Compress a directory segment to at most `maxChars` characters with a middle
 * ellipsis, keeping the tail (the deepest directories, most discriminative).
 * Keeps whole path segments: it cuts at a `/` boundary near the middle.
 * @param dir - directory portion including the trailing `/`.
 * @param maxChars - inclusive cap on the rendered length.
 * @returns the compressed directory, ending with `/`; `…/` when nothing fits.
 */
export function compressDir(dir: string, maxChars: number): string {
  if (dir.length <= maxChars) return dir
  const budget = Math.max(maxChars - 1, 2) // reserve one char for `…`
  // Keep as many trailing segments as fit in the budget.
  const segments: string[] = []
  let used = 0
  let end = dir.length
  while (end > 0) {
    const slash = dir.lastIndexOf('/', end - 1)
    const segment = dir.slice(slash + 1, end) + (dir[end] === '/' ? '' : '/')
    const cost = segment.length
    if (used + cost > budget && segments.length > 0) break
    if (used + cost > budget) break
    segments.unshift(segment)
    used += cost
    end = slash
    if (end === dir.length - 1 && dir[end] === '/') end = slash // skip the separator we consumed
  }
  if (segments.length === 0) return '…/'
  return `…${segments.join('')}`
}
