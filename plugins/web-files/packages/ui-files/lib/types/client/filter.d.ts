/**
 * Client-side filename filtering over the loaded tree: a query keeps an entry
 * when its own name matches (case-insensitive substring) or any loaded
 * descendant matches; directories with no match in their loaded subtree are
 * pruned, so the filtered view shows only live paths to matches. This
 * filters what the browser has already listed — lazily-loaded directories
 * that were never expanded contribute nothing until opened.
 */
import type { FilesDirEntry } from '@gaowen/dsh-files-remote/types';
/** One filtered row: the entry plus the matched substring's range in its name. */
export interface FilteredEntry {
    entry: FilesDirEntry;
    /** [start, end) character range of the query match in `entry.name`, or none. */
    match: readonly [number, number] | undefined;
}
/** The loaded-children lookup the tree walk consults (a dir may not be loaded). */
export type ChildrenOf = (dirPath: string) => readonly FilesDirEntry[] | undefined;
/**
 * Filter one loaded directory level against the whole loaded subtree.
 * @param entries - one directory's loaded children.
 * @param dirPath - that directory's workspace-relative path (`''` = root).
 * @param query - lowercase filter text; empty returns everything unmatched-free.
 * @param childrenOf - loaded-children accessor for descendant walks.
 * @returns kept entries with match ranges for highlighting.
 */
export declare function filterLevel(entries: readonly FilesDirEntry[], dirPath: string, query: string, childrenOf: ChildrenOf): FilteredEntry[];
/**
 * The empty-query test after trimming; whitespace-only input filters nothing.
 * @param raw - the filter box's current value.
 */
export declare function activeQuery(raw: string): string;
//# sourceMappingURL=filter.d.ts.map