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
    dir: string;
    /** The file name; never truncated. */
    name: string;
}
/** Split a path into directory (with trailing separator) and file name. */
export declare function splitPath(path: string): PathSegments;
/**
 * Compress a directory segment to at most `maxChars` characters with a middle
 * ellipsis, keeping the tail (the deepest directories, most discriminative).
 * Keeps whole path segments: it cuts at a `/` boundary near the middle.
 * @param dir - directory portion including the trailing `/`.
 * @param maxChars - inclusive cap on the rendered length.
 * @returns the compressed directory, ending with `/`; `…/` when nothing fits.
 */
export declare function compressDir(dir: string, maxChars: number): string;
//# sourceMappingURL=path-row.d.ts.map