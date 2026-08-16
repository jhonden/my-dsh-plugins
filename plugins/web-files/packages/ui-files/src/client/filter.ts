/**
 * Client-side filename filtering over the loaded tree: a query keeps an entry
 * when its own name matches (case-insensitive substring) or any loaded
 * descendant matches; directories with no match in their loaded subtree are
 * pruned, so the filtered view shows only live paths to matches. This
 * filters what the browser has already listed — lazily-loaded directories
 * that were never expanded contribute nothing until opened.
 */
import type { FilesDirEntry } from '@gaowen/dsh-files-remote/types'

/** One filtered row: the entry plus the matched substring's range in its name. */
export interface FilteredEntry {
  entry: FilesDirEntry
  /** [start, end) character range of the query match in `entry.name`, or none. */
  match: readonly [number, number] | undefined
}

/** The loaded-children lookup the tree walk consults (a dir may not be loaded). */
export type ChildrenOf = (dirPath: string) => readonly FilesDirEntry[] | undefined

/** Match range of a name against a lowercase query, or undefined. */
function matchRange(name: string, query: string): readonly [number, number] | undefined {
  const index = name.toLowerCase().indexOf(query)
  return index === -1 ? undefined : [index, index + query.length]
}

/**
 * Keep one entry when its name matches, or (for directories) any loaded
 * descendant matches. Synchronous recursion over already-loaded state.
 * @param entry - the row candidate.
 * @param path - its workspace-relative path.
 * @param query - lowercase filter text; empty keeps everything.
 * @param childrenOf - loaded-children accessor for directories.
 * @returns the kept row, or undefined to prune.
 */
function keep(entry: FilesDirEntry, path: string, query: string, childrenOf: ChildrenOf): FilteredEntry | undefined {
  const match = matchRange(entry.name, query)
  if (entry.kind === 'file') return match === undefined ? undefined : { entry, match }
  if (match !== undefined) return { entry, match }
  const children = childrenOf(path) ?? []
  for (const child of children) {
    if (keep(child, joinPath(path, child.name), query, childrenOf) !== undefined) return { entry, match: undefined }
  }
  return undefined
}

/** Join a directory path and an entry name. */
function joinPath(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`
}

/**
 * Filter one loaded directory level against the whole loaded subtree.
 * @param entries - one directory's loaded children.
 * @param dirPath - that directory's workspace-relative path (`''` = root).
 * @param query - lowercase filter text; empty returns everything unmatched-free.
 * @param childrenOf - loaded-children accessor for descendant walks.
 * @returns kept entries with match ranges for highlighting.
 */
export function filterLevel(
  entries: readonly FilesDirEntry[],
  dirPath: string,
  query: string,
  childrenOf: ChildrenOf,
): FilteredEntry[] {
  if (query === '') return entries.map(entry => ({ entry, match: undefined }))
  const kept: FilteredEntry[] = []
  for (const entry of entries) {
    const row = keep(entry, joinPath(dirPath, entry.name), query, childrenOf)
    if (row !== undefined) kept.push(row)
  }
  return kept
}

/**
 * The empty-query test after trimming; whitespace-only input filters nothing.
 * @param raw - the filter box's current value.
 */
export function activeQuery(raw: string): string {
  return raw.trim().toLowerCase()
}
