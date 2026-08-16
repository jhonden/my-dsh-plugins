/**
 * Document-level capture interception of the chat tool rows' file links.
 *
 * The shipped `openFile` chain (tool row → workspaces.openPath → Host native
 * opener) has no override seam, and the upstream row components are neither
 * package-exported nor platform modules, so a takeover or wrapper cannot
 * import them. A capture-phase click listener is the one zero-upstream-change
 * seam: the tool rows render the path as a button whose text is the display
 * path inside a row rooted at `[data-tool]`, so a click there is diverted to
 * this plugin's in-app viewer before React's own handlers run.
 *
 * The listener must be conservative: only buttons inside a `[data-tool]` row,
 * never inside our own Files view, and only when the row looks like a file
 * link (single path-like text). Anything unrecognized falls through to the
 * shipped behavior untouched.
 */
/**
 * Resolve the intercepted display path against the session cwd.
 * @param displayPath - the link text (already the row's display form).
 * @param cwd - the current session's workspace root, when known.
 * @returns the workspace-relative path for the viewer, or undefined when the
 *   link cannot be resolved into the workspace.
 */
export declare function resolveLinkPath(displayPath: string, cwd: string | undefined): string | undefined;
/**
 * Install the capture listener on the document.
 * @param open - open one workspace-relative path in the Files viewer.
 * @param isOwnSurface - whether an element sits inside this plugin's own view
 *   (those clicks never intercept).
 * @returns the disposer removing the listener.
 */
export declare function installLinkInterception(open: (path: string) => void, isOwnSurface: (element: Element) => boolean): () => void;
/**
 * Bind the cwd source the interceptor resolves against.
 * @param cwd - accessor for the current session's workspace root.
 */
export declare function bindLinkCwd(cwd: () => string | undefined): void;
//# sourceMappingURL=link-intercept.d.ts.map