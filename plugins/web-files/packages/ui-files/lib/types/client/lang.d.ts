/**
 * File-extension → language-id mapping for the viewer's syntax highlighting.
 * Vendored from dsh-tool-fs's read-render.ts (upstream ships no `src/` in the
 * npm tarball, so the map cannot be imported from the published package); the
 * short-form ids align with ui-primitives' `LANG_ALIASES`, which resolves them
 * to shiki grammars. Keep in sync with upstream when it grows.
 */
/**
 * Derive a highlighting language hint from a file path's extension.
 * Pure, case-insensitive on the extension; a dotfile (`.gitignore`) and an
 * unknown extension both yield `undefined`.
 * @param path - session-workspace-relative file path.
 * @returns the short-form language id, or `undefined` when none maps.
 */
export declare function langFromPath(path: string): string | undefined;
//# sourceMappingURL=lang.d.ts.map