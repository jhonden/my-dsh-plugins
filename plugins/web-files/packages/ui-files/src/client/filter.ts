/**
 * Client-side filename filtering over the loaded tree: a query keeps an entry
 * when its own name matches (case-insensitive substring) or any loaded
 * descendant matches; parents survive as the path to a match. This filters
 * what the browser has already listed — lazily-loaded directories that were
 * never expanded contribute nothing until opened.
 */
import type { FilesDirEntry } from '@gaowen/dsh-files-remote/types'

/** One filtered row: the entry plus the matched substring's range in its name. */
export interface FilteredEntry {
  entry: FilesDirEntry
  /** [start, end) character range of the query match in `entry.name`, or none. */
  match: readonly [number, number] | undefined
}

/**
 * Filter one loaded directory level. During a filter, directories are always
 * kept (a match may live in their loaded subtree — the tree renders them and
 * simply shows no children when nothing below matches); files are kept only
 * on a name match. The query must already be lowercase (see {@link activeQuery}).
 * @param entries - one directory's loaded children.
 * @param query - lowercase filter text; empty returns everything unmatched-free.
 * @returns kept entries with match ranges for highlighting.
 */
export function filterLevel(entries: readonly FilesDirEntry[], query: string): FilteredEntry[] {
  if (query === '') return entries.map(entry => ({ entry, match: undefined }))
  const kept: FilteredEntry[] = []
  for (const entry of entries) {
    if (entry.kind === 'file') {
      const index = entry.name.toLowerCase().indexOf(query)
      if (index === -1) continue
      kept.push({ entry, match: [index, index + query.length] })
    } else {
      const index = entry.name.toLowerCase().indexOf(query)
      kept.push({ entry, match: index === -1 ? undefined : [index, index + query.length] })
    }
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
