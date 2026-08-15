/**
 * The Files view: a full-area workspace explorer occupying the conversation
 * center region. A file tree on the left (lazy-expanding, bounded listings)
 * and a read-only text viewer on the right. All data access flows through the
 * injected call face; session identity through the injected current-session
 * getter.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { FilesDirEntry, FilesListResult, FilesReadResult } from '@gaowen/dsh-files-remote/types'
import type { RpcOutcome } from './rpc.ts'

/** The data face the plugin injects into the view registration. */
export interface FilesCallFace {
  list: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesListResult>>
  read: (sessionId: string, path: string, signal?: AbortSignal) => Promise<RpcOutcome<FilesReadResult>>
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
  | undefined

/** A `.md` path (case-insensitive) renders through the preview by default. */
function isMarkdown(path: string): boolean {
  return path.toLowerCase().endsWith('.md')
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

  return (
    <div style={{ display: 'flex', width: '100%', flex: '1 1 0', minHeight: 0, overflow: 'hidden', color: 'var(--dsw-alias-label-primary, inherit)' }}>
      <nav
        aria-label={t('view.files')}
        style={{ width: '280px', minWidth: '200px', flexShrink: 0, overflow: 'auto', padding: '8px 4px', borderRight: '1px solid var(--dsw-alias-border-l2, #ccc)' }}
      >
        {rootListing?.state === 'loading' && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{t('tree.loading')}</div>}
        {rootListing?.state === 'error' && <div style={{ padding: '4px 8px', color: 'var(--dsw-alias-state-error-primary, #e55)' }}>{rootListing.message}</div>}
        {rootListing?.state === 'done' && rootListing.entries.length === 0 && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{t('tree.empty')}</div>}
        {rootListing?.state === 'done' && rootListing.entries.map(child => (
          <TreeRow key={child.name} entry={child} parentPath="" depth={0} t={t} listDir={listDir} onOpenFile={openFile} />
        ))}
        {rootListing?.state === 'done' && rootListing.truncated && <div style={{ opacity: 0.6, padding: '4px 8px' }}>{t('tree.truncated')}</div>}
      </nav>
      <ViewerColumn reading={reading} t={t} />
    </div>
  )
}

/** One tree row; directories expand lazily in place, files open in the viewer. */
function TreeRow(props: {
  entry: FilesDirEntry
  parentPath: string
  depth: number
  t: T
  listDir: (path: string, signal?: AbortSignal) => Promise<Listing>
  onOpenFile: (path: string) => void
}) {
  const { entry, parentPath, depth, t, listDir, onOpenFile } = props
  const path = joinPath(parentPath, entry.name)
  const [expanded, setExpanded] = useState(false)
  const [listing, setListing] = useState<Listing | undefined>(undefined)
  /** Load-once sentinel per expansion: `listing` doubles as the data and must not re-trigger the effect. */
  const started = useRef(false)

  useEffect(() => {
    if (!expanded || started.current) return
    started.current = true
    const controller = new AbortController()
    setListing({ state: 'loading' })
    void listDir(path, controller.signal).then(setListing)
    return () => controller.abort()
  }, [expanded, path, listDir])

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
        onClick={() => { if (entry.kind === 'directory') { setExpanded(e => !e) } else { onOpenFile(path) } }}
      >
        <span style={{ display: 'inline-block', width: '16px', opacity: 0.7 }}>
          {entry.kind === 'directory' ? (expanded ? '▾' : '▸') : ''}
        </span>
        {entry.kind === 'directory' ? '📁' : '📄'} {entry.name}
      </button>
      {expanded && listing?.state === 'loading' && <div style={{ opacity: 0.6, padding: '2px 8px 2px 0', paddingLeft: `${(depth + 1) * 14 + 28}px` }}>{t('tree.loading')}</div>}
      {expanded && listing?.state === 'error' && <div style={{ padding: '2px 8px 2px 0', paddingLeft: `${(depth + 1) * 14 + 28}px`, color: 'var(--dsw-alias-state-error-primary, #e55)' }}>{listing.message}</div>}
      {expanded && listing?.state === 'done' && listing.entries.map(child => (
        <TreeRow key={child.name} entry={child} parentPath={path} depth={depth + 1} t={t} listDir={listDir} onOpenFile={onOpenFile} />
      ))}
      {expanded && listing?.state === 'done' && listing.truncated && (
        <div style={{ opacity: 0.6, paddingLeft: `${(depth + 1) * 14 + 28}px` }}>{t('tree.truncated')}</div>
      )}
    </div>
  )
}

/** The viewer column: empty, loading, error, or content (markdown preview for `.md`). */
function ViewerColumn(props: { reading: Reading; t: T }) {
  const { reading, t } = props
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
  const markdown = isMarkdown(reading.path)
  const showPreview = markdown && preview
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
          <MarkdownText text={reading.content} />
        </div>
      ) : (
        <pre style={{ flex: 1, overflow: 'auto', margin: 0, padding: '12px 16px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', lineHeight: '20px', fontFamily: 'var(--dsw-alias-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)' }}>
          {reading.content}
        </pre>
      )}
    </div>
  )
}
