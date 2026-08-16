/**
 * The Files view: a full-area workspace explorer occupying the conversation
 * center region. A file tree on the left (lazy-expanding, bounded listings)
 * and a read-only text viewer on the right. All data access flows through the
 * injected call face; session identity through the injected current-session
 * getter.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MarkdownText, ReadBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ReadBlockLine } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FilesDirEntry, FilesListResult, FilesReadResult, FilesSearchResult } from '@gaowen/dsh-files-remote/types'
import { imageMediaTypeFor } from '@gaowen/dsh-files-remote/images'
import { langFromPath } from './lang.ts'
import { activeQuery, filterLevel } from './filter.ts'
import { compressDir, splitPath } from './path-row.ts'
import { rewriteMarkdownImages } from './md-images.ts'
import type { RpcOutcome } from './rpc.ts'

/** The data face the plugin injects into the view registration. */
export interface FilesCallFace {
  list: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesListResult>>
  read: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesReadResult>>
  search: (sessionId: string, query: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesSearchResult>>
}

/** Locale translate function bound to this plugin's namespace. */
type T = TranslateNS<'web-files'>

/** Inject face provided by the plugin's view registration. */
export interface FilesViewProps {
  t: T
  call: FilesCallFace
  currentSessionId: () => string | undefined
}

/** Join a directory path and an entry name. */
function joinPath(dir: string, name: string): string {
  return dir === '' ? name : `${dir}/${name}`
}

/** All locale keys the view renders. */
type Key = Parameters<T>[0]

/** Map a typed error code to viewer copy, falling back to the generic line. */
function errorKey(code: string): Key {
  if (code === 'FILES_NOT_FOUND') return 'viewer.error.notFound'
  if (code === 'FILES_BINARY_REJECTED') return 'viewer.error.binary'
  if (code === 'FILES_PATH_OUTSIDE_WORKSPACE') return 'viewer.error.outside'
  return 'viewer.error.other'
}

/** One directory listing's load state. */
type Listing =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'done'; entries: FilesDirEntry[]; truncated: boolean }

/** One file read's view state. */
type Reading =
  | { state: 'loading'; path: string }
  | { state: 'error'; path: string; message: string }
  | { state: 'done'; path: string; content: string; bytes: number | null; truncated: boolean }
  | { state: 'image'; path: string; url: string }
  | undefined

/** The preview route images render from; matches files-remote's Host route. */
const PREVIEW_ROUTE = '/plugins-web-files/preview'

/** An image-extension path renders through the preview route, not text read. */
function isImagePath(path: string): boolean {
  return imageMediaTypeFor(path) !== undefined
}

/** Absolute preview-route URL for one workspace image. */
function previewUrl(sessionId: string, path: string): string {
  return `${globalThis.location?.origin ?? ''}${PREVIEW_ROUTE}?sessionId=${encodeURIComponent(sessionId)}&path=${path.split('/').map(encodeURIComponent).join('/')}`
}

/** A `.md` path (case-insensitive) renders through the preview by default. */
function isMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
}

/** Height cap before ReadBlock collapses the middle; a viewer shows far more than a chat card. */
const VIEWER_MAX_LINES = 2000

/** Split whole-file content into 1-based numbered lines, dropping the trailing empty line. */
function toLines(content: string): ReadBlockLine[] {
  const split = content.split('\n')
  const rows = split[split.length - 1] === '' ? split.slice(0, -1) : split
  return rows.map((text, index) => ({ number: index + 1, text }))
}

/** Directory portion of a session-relative path (`''` for a root file). */
function dirOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

/**
 * The view component. The inject face (`props`) is recreated by the slot
 * renderer on its own schedule, so no effect depends on `props` identity:
 * everything reaches the effects through a ref, and the effects key on real
 * state only. Remounting (tab switch away/back) reloads from scratch.
 */
export function FilesView(props: FilesViewProps) {
  const face = useRef(props)
  face.current = props

  const [rootListing, setRootListing] = useState<Listing | undefined>(undefined)
  const [reading, setReading] = useState<Reading>(undefined)
  /** Start-once sentinel: the loading state must not re-trigger the effect. */
  const rootStarted = useRef(false)

  useEffect(() => {
    if (rootStarted.current) return
    rootStarted.current = true
    const controller = new AbortController()
    void (async () => {
      const sessionId = face.current.currentSessionId()
      if (sessionId === undefined) { setRootListing({ state: 'error', message: face.current.t('tree.error') }); return }
      setRootListing({ state: 'loading' })
      const outcome = await face.current.call.list(sessionId, '', controller.signal)
      if (!outcome.ok) { setRootListing({ state: 'error', message: face.current.t('tree.error') }); return }
      setRootListing({ state: 'done', entries: outcome.value.entries, truncated: outcome.value.truncated })
    })()
    return () => controller.abort()
  }, [])

  const openFile = useCallback(async (path: string): Promise<void> => {
    const sessionId = face.current.currentSessionId()
    if (sessionId === undefined) return
    if (isImagePath(path)) {
      // Images bypass the text channel: the browser fetches the preview
      // route directly (same-origin, workspace-confined on the Host).
      setReading({ state: 'image', path, url: previewUrl(sessionId, path) })
      return
    }
    setReading({ state: 'loading', path })
    const outcome = await face.current.call.read(sessionId, path)
    if (!outcome.ok) {
      setReading({ state: 'error', path, message: face.current.t(errorKey(outcome.error.code)) })
      return
    }
    setReading({ state: 'done', path, content: outcome.value.content, bytes: outcome.value.bytes, truncated: outcome.value.truncated })
  }, [])

  const listDir = useCallback(async (path: string, signal?: AbortSignal): Promise<Listing> => {
    const sessionId = face.current.currentSessionId()
    if (sessionId === undefined) return { state: 'error', message: face.current.t('tree.error') }
    const outcome = await face.current.call.list(sessionId, path, signal)
    if (!outcome.ok) return { state: 'error', message: face.current.t('tree.error') }
    return { state: 'done', entries: outcome.value.entries, truncated: outcome.value.truncated }
  }, [])

  const t = props.t
  const [filterRaw, setFilterRaw] = useState('')
  const query = activeQuery(filterRaw)
  const filtering = query !== ''
  /** Loaded directory listings by path — TreeRows report in as they load. */
  const loadedRef = useRef(new Map<string, readonly FilesDirEntry[]>())
  const [, bumpLoaded] = useState(0)
  const childrenOf = useCallback((dir: string): readonly FilesDirEntry[] | undefined => loadedRef.current.get(dir), [])

  /**
   * Recursive search: debounced `filesRemote/search` (rg over the whole
   * workspace), generation-fenced so a stale response never lands. The
   * result replaces the tree with a flat path list until the query clears.
   */
  const [searchState, setSearchState] = useState<
    | { phase: 'idle' }
    | { phase: 'searching'; query: string }
    | { phase: 'done'; query: string; paths: string[]; truncated: boolean }
    | { phase: 'error'; query: string }
  >({ phase: 'idle' })
  const searchGen = useRef(0)

  useEffect(() => {
    if (query === '') {
      searchGen.current++
      setSearchState({ phase: 'idle' })
      return
    }
    const gen = ++searchGen.current
    setSearchState({ phase: 'searching', query })
    // The controller aborts the in-flight request when a newer keystroke
    // supersedes it; an aborted request must surface as stale, not as error.
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void (async () => {
        const sessionId = face.current.currentSessionId()
        if (sessionId === undefined) return
        const outcome = await face.current.call.search(sessionId, filterRaw, controller.signal)
        if (gen !== searchGen.current) return
        const aborted = !outcome.ok && (controller.signal.aborted || outcome.error.code === 'transport' && outcome.error.message.toLowerCase().includes('abort'))
        if (!outcome.ok) {
          if (!aborted) setSearchState({ phase: 'error', query })
          return
        }
        setSearchState({ phase: 'done', query, paths: outcome.value.paths, truncated: outcome.value.truncated })
      })()
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, filterRaw])

  const reportLoaded = useCallback((path: string, entries: readonly FilesDirEntry[] | null) => {
    const map = loadedRef.current
    const had = map.has(path)
    if (entries === null) { if (!had) return; map.delete(path) }
    else { if (had && map.get(path) === entries) return; map.set(path, entries) }
    bumpLoaded(n => n + 1)
  }, [])

  /** Root filter with whole-loaded-subtree pruning (only live paths stay). */
  const rootFiltered = rootListing?.state === 'done'
    ? filterLevel(rootListing.entries, '', query, childrenOf)
    : []
  const rootEmpty = rootListing?.state === 'done' && (filtering ? rootFiltered.length === 0 : rootListing.entries.length === 0)

  return (
    <div style={{ display: 'flex', width: '100%', flex: '1 1 0', minHeight: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-primary, inherit)' }}>
      <nav
        aria-label={t('view.files')}
        style={{ width: '280px', minWidth: '200px', flexShrink: 0, overflow: 'auto', borderRight: '1px solid var(--dsw-alias-border-l2, #ccc)', display: 'flex', flexDirection: 'column' }}
      >
        <FilterBox value={filterRaw} onChange={setFilterRaw} placeholder={t('filter.placeholder')} clearLabel={t('filter.clear')} t={t} searching={searchState.phase === 'searching'} />
        {searchState.phase === 'done' ? (
          <SearchResults state={searchState} query={query} t={t} onOpen={openFile} />
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 4px' }}>
            {searchState.phase === 'searching' && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{t('search.searching')}</div>}
            {searchState.phase === 'error' && <div style={{ padding: '4px 8px', color: 'var(--dsw-alias-state-error-primary, #e55)' }}>{t('search.error')}</div>}
            {/* While a search is pending, the pre-response tree view stays; a
                tree-load error from before the query started is not search
                state and would misread as a failed search. */}
            {rootListing?.state === 'loading' && !filtering && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{t('tree.loading')}</div>}
            {rootListing?.state === 'error' && !filtering && <div style={{ padding: '4px 8px', color: 'var(--dsw-alias-state-error-primary, #e55)' }}>{rootListing.message}</div>}
            {rootEmpty && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{filtering ? t('filter.noMatch') : t('tree.empty')}</div>}
            {rootFiltered.map(row => (
              <TreeRow key={row.entry.name} entry={row.entry} match={row.match} parentPath="" depth={0} t={t} listDir={listDir} onOpenFile={openFile} filtering={filtering} query={query} childrenOf={childrenOf} reportLoaded={reportLoaded} />
            ))}
            {rootListing?.state === 'done' && rootListing.truncated && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{t('tree.truncated')}</div>}
          </div>
        )}
      </nav>
      <ViewerColumn reading={reading} t={t} sessionId={face.current.currentSessionId()} />
    </div>
  )
}

/** The filter box: icon, focus ring, inline clear button, subtle scope hint. */
function FilterBox(props: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  clearLabel: string
  t: T
  searching: boolean
}) {
  const { value, onChange, placeholder, clearLabel, t, searching } = props
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.04))' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px',
          borderRadius: '8px',
          border: `1px solid ${focused ? 'var(--dsw-alias-state-business-primary, #4c6ef5)' : 'var(--dsw-alias-border-l2, rgba(0,0,0,0.1))'}`,
          background: 'var(--dsw-alias-bg-base, transparent)',
          boxShadow: focused ? '0 0 0 2px var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))' : 'none',
          transition: 'border-color .12s, box-shadow .12s',
        }}
      >
        <span aria-hidden style={{ opacity: 0.5, fontSize: '13px', flexShrink: 0 }}>{searching ? '⏳' : '🔍'}</span>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={event => { onChange(event.target.value) }}
          onFocus={() => { setFocused(true) }}
          onBlur={() => { setFocused(false) }}
          style={{ flex: 1, minWidth: 0, padding: '5px 0', fontSize: '12px', border: 'none', background: 'transparent', color: 'inherit', outline: 'none' }}
        />
        {value !== '' && (
          <button
            type="button"
            aria-label={clearLabel}
            title={clearLabel}
            onClick={() => { onChange('') }}
            style={{
              border: 'none', background: 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))', color: 'inherit',
              cursor: 'pointer', padding: '0', width: '16px', height: '16px', borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', lineHeight: 1, flexShrink: 0,
            }}
          >✕</button>
        )}
      </div>
      {value.trim() !== '' && (
        <div style={{ opacity: 0.5, fontSize: '11px', padding: '4px 2px 0' }}>{t('filter.loadedOnly')}</div>
      )}
    </div>
  )
}

/** Flat recursive-search results: dim compressed dir + full file name, click to open. */
function SearchResults(props: {
  state: { phase: 'done'; query: string; paths: string[]; truncated: boolean }
  query: string
  t: T
  onOpen: (path: string) => void
}) {
  const { state, query, t, onOpen } = props
  if (state.paths.length === 0) {
    return <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px', opacity: 0.6 }}>{t('search.noMatch')}</div>
  }
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '4px 4px' }}>
      <div style={{ opacity: 0.55, fontSize: '11px', padding: '2px 6px 6px' }}>
        {t('search.count').replace('{n}', String(state.paths.length))}{state.truncated ? ` · ${t('search.truncated')}` : ''}
      </div>
      {state.paths.map(path => {
        const { dir, name } = splitPath(path)
        // Budget the dir to roughly the column width minus the file name;
        // the name never truncates (it wraps below when extreme).
        const dirBudget = Math.max(18, 44 - name.length)
        const shownDir = compressDir(dir, dirBudget)
        const nameIndex = name.toLowerCase().indexOf(query)
        return (
          <button
            key={path}
            type="button"
            title={path}
            onClick={() => { onOpen(path) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px',
              background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
              fontSize: '12px', lineHeight: '18px', borderRadius: '4px',
              fontFamily: 'var(--dsw-alias-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)',
              wordBreak: 'break-all',
            }}
            onMouseEnter={event => { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))' }}
            onMouseLeave={event => { event.currentTarget.style.background = 'none' }}
          >
            <span style={{ opacity: 0.55, fontSize: 11 }}>{shownDir}</span>
            {nameIndex === -1 ? name : (
              <>
                {name.slice(0, nameIndex)}
                <mark style={{ background: 'var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>
                  {name.slice(nameIndex, nameIndex + query.length)}
                </mark>
                {name.slice(nameIndex + query.length)}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** One tree row; directories expand lazily in place, files open in the viewer. */
function TreeRow(props: {
  entry: FilesDirEntry
  match: readonly [number, number] | undefined
  parentPath: string
  depth: number
  t: T
  filtering: boolean
  query: string
  childrenOf: (dir: string) => readonly FilesDirEntry[] | undefined
  reportLoaded: (path: string, entries: readonly FilesDirEntry[] | null) => void
  listDir: (path: string, signal?: AbortSignal) => Promise<Listing>
  onOpenFile: (path: string) => void
}) {
  const { entry, match, parentPath, depth, t, filtering, query, childrenOf, reportLoaded, listDir, onOpenFile } = props
  const path = joinPath(parentPath, entry.name)
  const isDir = entry.kind === 'directory'
  const [userExpanded, setUserExpanded] = useState(false)
  const [listing, setListing] = useState<Listing | undefined>(undefined)
  /** Filter mode force-expands loaded DIRECTORIES so matches stay reachable;
   *  a file row never expands and never lists — its path is not a directory. */
  const expanded = isDir && (filtering || userExpanded)
  /** Load-once sentinel per expansion: `listing` doubles as the data and must not re-trigger the effect. */
  const started = useRef(false)

  useEffect(() => {
    if (!isDir || !expanded || started.current) return
    started.current = true
    const controller = new AbortController()
    setListing({ state: 'loading' })
    let disposed = false
    void listDir(path, controller.signal).then(result => {
      // Cleanup (row unmounted — e.g. the search list replaced the tree)
      // aborts the fetch; an aborted result is stale, never an error state,
      // and a disposed row must not re-render at all.
      if (disposed || controller.signal.aborted) return
      setListing(result)
      reportLoaded(path, result.state === 'done' ? result.entries : null)
    })
    return () => { disposed = true; controller.abort() }
  }, [isDir, expanded, path, listDir, reportLoaded])

  /** Children: during filtering, whole-loaded-subtree pruning like the root. */
  const childRows = listing?.state === 'done'
    ? (query === ''
        ? listing.entries.map(entry => ({ entry, match: undefined as [number, number] | undefined }))
        : filterLevel(listing.entries, path, query, childrenOf))
    : []

  return (
    <div>
      <button
        type="button"
        style={{
          display: 'block', width: '100%', textAlign: 'left', padding: '3px 8px',
          background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
          fontSize: '13px', lineHeight: '20px', borderRadius: '4px',
          paddingLeft: `${depth * 14 + 8}px`,
        }}
        onMouseEnter={event => { event.currentTarget.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.06))' }}
        onMouseLeave={event => { event.currentTarget.style.background = 'none' }}
        onClick={() => { if (entry.kind === 'directory') { setUserExpanded(e => !e) } else { onOpenFile(path) } }}
      >
        <span style={{ display: 'inline-block', width: '16px', opacity: 0.7 }}>
          {entry.kind === 'directory' ? (expanded ? '▾' : '▸') : ''}
        </span>
        {entry.kind === 'directory' ? '📁' : '📄'} <HighlightedName name={entry.name} match={match} />
      </button>
      {expanded && listing?.state === 'loading' && <div style={{ opacity: 0.6, padding: '2px 8px 2px 0', paddingLeft: `${(depth + 1) * 14 + 28}px` }}>{t('tree.loading')}</div>}
      {expanded && listing?.state === 'error' && <div style={{ padding: '2px 8px 2px 0', paddingLeft: `${(depth + 1) * 14 + 28}px`, color: 'var(--dsw-alias-state-error-primary, #e55)' }}>{listing.message}</div>}
      {expanded && childRows.map(row => (
        <TreeRow key={row.entry.name} entry={row.entry} match={row.match} parentPath={path} depth={depth + 1} t={t} listDir={listDir} onOpenFile={onOpenFile} filtering={filtering} query={query} childrenOf={childrenOf} reportLoaded={reportLoaded} />
      ))}
      {expanded && listing?.state === 'done' && listing.truncated && (
        <div style={{ opacity: 0.6, paddingLeft: `${(depth + 1) * 14 + 28}px` }}>{t('tree.truncated')}</div>
      )}
    </div>
  )
}

/** Name text with the matched range marked. */
function HighlightedName(props: { name: string; match: readonly [number, number] | undefined }) {
  const { name, match } = props
  if (match === undefined) return <>{name}</>
  const [start, end] = match
  return (
    <>
      {name.slice(0, start)}
      <mark style={{ background: 'var(--dsw-alias-interactive-bg-hover-accent, rgba(38,49,72,0.14))', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>
        {name.slice(start, end)}
      </mark>
      {name.slice(end)}
    </>
  )
}

/** The viewer column: empty, loading, error, or content (markdown preview for `.md`). */
function ViewerColumn(props: { reading: Reading; t: T; sessionId: string | undefined }) {
  const { reading, t } = props
  const sessionId = props.sessionId
  const [preview, setPreview] = useState(true)
  // A different file opening resets the toggle to the markdown default.
  const openPath = reading?.state === 'done' || reading?.state === 'error' || reading?.state === 'loading' ? reading.path : undefined
  const shownPath = useRef<string | undefined>(undefined)
  if (openPath !== shownPath.current) {
    shownPath.current = openPath
    if (preview !== true) setPreview(true)
  }

  if (reading === undefined) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
        {t('viewer.empty')}
      </div>
    )
  }
  if (reading.state === 'loading') {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>{t('viewer.loading')}</div>
  }
  if (reading.state === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dsw-alias-state-error-primary, #e55)' }}>
        {reading.message}
      </div>
    )
  }
  if (reading.state === 'image') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '8px 16px', opacity: 0.65, display: 'flex', gap: '12px', fontSize: '12px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06))' }}>
          <span style={{ fontWeight: 600 }}>{reading.path}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px' }}>
          <img
            src={reading.url}
            alt={reading.path}
            style={{ maxWidth: '100%', objectFit: 'contain', borderRadius: '4px' }}
          />
        </div>
      </div>
    )
  }
  const markdown = isMarkdown(reading.path)
  const showPreview = markdown && preview
  const lines = showPreview ? undefined : toLines(reading.content)
  // Relative image refs become preview-route URLs so the platform renderer
  // (which only permits absolute http(s)) can display workspace images.
  const previewSource = showPreview
    ? rewriteMarkdownImages(reading.content, sessionId ?? '', dirOf(reading.path))
    : reading.content
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '8px 16px', opacity: 0.65, display: 'flex', gap: '12px', fontSize: '12px', borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.06))', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>{reading.path}</span>
        {reading.bytes != null && <span>{reading.bytes} {t('viewer.bytes')}</span>}
        {reading.truncated && <span>{t('viewer.truncated')}</span>}
        {markdown && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--dsw-alias-border-l2, #ccc)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              aria-pressed={showPreview}
              onClick={() => { setPreview(true) }}
              style={{ padding: '2px 10px', border: 'none', cursor: 'pointer', fontSize: '12px', background: showPreview ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.08))' : 'transparent', color: 'inherit' }}
            >
              {t('viewer.preview')}
            </button>
            <button
              type="button"
              aria-pressed={!showPreview}
              onClick={() => { setPreview(false) }}
              style={{ padding: '2px 10px', border: 'none', borderLeft: '1px solid var(--dsw-alias-border-l2, #ccc)', cursor: 'pointer', fontSize: '12px', background: !showPreview ? 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,0.08))' : 'transparent', color: 'inherit' }}
            >
              {t('viewer.source')}
            </button>
          </span>
        )}
      </div>
      {showPreview ? (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          <MarkdownText text={previewSource} />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <ReadBlock
            lines={lines ?? []}
            totalLines={lines?.length ?? 0}
            lang={langFromPath(reading.path)}
            maxLines={VIEWER_MAX_LINES}
            className="web-files-code"
          />
        </div>
      )}
    </div>
  )
}
