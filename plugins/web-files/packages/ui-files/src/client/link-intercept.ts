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

/** Whether one display path is absolute (workspace-rooted or drive/UNC). */
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('\\\\')
}

/**
 * Resolve the intercepted display path against the session cwd.
 * @param displayPath - the link text (already the row's display form).
 * @param cwd - the current session's workspace root, when known.
 * @returns the workspace-relative path for the viewer, or undefined when the
 *   link cannot be resolved into the workspace.
 */
export function resolveLinkPath(displayPath: string, cwd: string | undefined): string | undefined {
  if (displayPath === '' || displayPath.includes('\n')) return undefined
  if (isAbsolutePath(displayPath)) {
    if (cwd === undefined || cwd === '') return undefined
    const normalized = displayPath.replaceAll('\\', '/')
    const base = cwd.replaceAll('\\', '/').replace(/\/$/, '')
    if (!normalized.startsWith(`${base}/`)) return undefined
    return normalized.slice(base.length + 1)
  }
  return displayPath
}

/**
 * Install the capture listener on the document.
 * @param open - open one workspace-relative path in the Files viewer.
 * @param isOwnSurface - whether an element sits inside this plugin's own view
 *   (those clicks never intercept).
 * @returns the disposer removing the listener.
 */
export function installLinkInterception(
  open: (path: string) => void,
  isOwnSurface: (element: Element) => boolean,
): () => void {
  const handler = (event: Event): void => {
    if (!(event instanceof MouseEvent) || event.button !== 0) return
    if (event.defaultPrevented) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (isOwnSurface(target)) return
    // Only the tool row's file-link button: a button inside a [data-tool] row.
    const button = target.closest('button')
    if (button === null || button.closest('[data-tool]') === null) return
    const row = button.closest('[data-tool]') as HTMLElement
    // The file link is the row-summary button whose text is one path; the row
    // root itself carries the display title. Require the button to sit in the
    // row's summary line (no nested [data-tool] between) and read its text.
    if (button.closest('[data-tool]') !== row) return
    const text = (button.textContent ?? '').trim()
    if (text === '' || text.includes(' ')) return
    // Resolve lazily against the session cwd; unmatched clicks fall through.
    const cwd = documentLinkCwd()
    const resolved = resolveLinkPath(text, cwd)
    if (resolved === undefined) return
    event.preventDefault()
    event.stopPropagation()
    open(resolved)
  }
  document.addEventListener('click', handler, true)
  return () => { document.removeEventListener('click', handler, true) }
}

/** The current session cwd, supplied by the plugin at install time. */
let currentCwd: () => string | undefined = () => undefined

/**
 * Bind the cwd source the interceptor resolves against.
 * @param cwd - accessor for the current session's workspace root.
 */
export function bindLinkCwd(cwd: () => string | undefined): void {
  currentCwd = cwd
}

function documentLinkCwd(): string | undefined {
  return currentCwd()
}
