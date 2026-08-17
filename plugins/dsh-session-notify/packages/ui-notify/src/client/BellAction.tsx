/**
 * The completion bell: one compact control in the composer's tool row, right
 * after the resident access-mode chrome (`conversation.input.left`). It
 * reads the armed state for the current session from the Host's
 * `sessionNotify` Remote service, toggles it on click, and its popover is a
 * small sound-settings panel (system sounds, a custom file picker, volume,
 * and a preview).
 *
 * Preferences are read/written through the Host's `getPrefs`/`setPrefs`
 * Remotes rather than the browser settings transport, because dsh settings
 * RPCs only accept loopback clients — the bell must keep working when the GUI
 * is opened from a LAN IP (the Host writes into the same `session-notify`
 * settings namespace, so the Settings page and settings.yaml stay in sync).
 */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { NotifyPrefs } from '@gaowen/dsh-session-notify/types'
import { NS } from './locales.ts'
import { notifyRpc, uploadSound } from './rpc.ts'

/** Full props for the composer completion bell. */
export type BellActionProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS> & {
  /** The sessionNotify Remote caller (arm state, preview, prefs, sound list). */
  call: ReturnType<typeof notifyRpc>
}

/** Unknown/loading armed state — the bell renders muted until known. */
type ArmedState = boolean | null

/** select value for the custom-file option. */
const CUSTOM_KEY = '__custom__'

/** Bell outline (unarmed). */
function BellOutline() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

/** Filled bell (armed). */
function BellFilled() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

/** Small caret opening the settings popover. */
function Caret() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** Shared button look inside the composer tool row (compact, one row tall). */
const buttonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '22px',
  height: '22px',
  border: 'none',
  background: 'transparent',
  borderRadius: '6px',
  cursor: 'pointer',
  color: 'inherit',
  padding: 0,
}

const groupStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '1px',
  position: 'relative',
  borderRadius: '6px',
}

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  // Pop upward — the composer sits at the bottom of the view, so the space
  // above the bell is the conversation area; a downward panel gets clipped.
  bottom: 'calc(100% + 6px)',
  left: 0,
  zIndex: 40,
  width: '248px',
  padding: '10px',
  borderRadius: '10px',
  background: 'var(--dsh-color-bg-elevated, #ffffff)',
  border: '1px solid rgba(128, 128, 128, 0.25)',
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.14)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  fontSize: '12px',
}

const fieldStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: '1px solid rgba(128, 128, 128, 0.3)',
  borderRadius: '6px',
  background: 'transparent',
  color: 'inherit',
  padding: '4px 6px',
  fontSize: '12px',
}

const rangeStyle: React.CSSProperties = {
  flex: 1,
  accentColor: 'currentColor',
}

const previewButtonStyle: React.CSSProperties = {
  border: '1px solid rgba(128, 128, 128, 0.3)',
  background: 'transparent',
  borderRadius: '6px',
  padding: '4px 10px',
  fontSize: '12px',
  cursor: 'pointer',
  color: 'inherit',
}

const dotStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1px',
  right: '4px',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: '#f59e0b',
}

/**
 * The completion bell for one session, sitting beside the access-mode chrome:
 * click to arm/disarm; the caret opens the sound-settings panel backed by the
 * Host's prefs Remotes (LAN-safe, unlike the browser settings transport).
 * @param props - framework slot currency, the namespace translator, and the injected Remote face.
 */
export function BellAction({ sessionId, useSession, t, call }: BellActionProps) {
  const [armed, setArmed] = useState<ArmedState>(null)
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [prefs, setPrefs] = useState<NotifyPrefs | null>(null)
  /** Explicit "custom file" selection — drives the file-picker row's visibility. */
  const [customMode, setCustomMode] = useState(false)
  /** Custom-file upload progress; the error text when a pick failed. */
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [volDraft, setVolDraft] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const running = useSession((snapshot) => snapshot.running)

  // Fetch armed state when the current session changes.
  useEffect(() => {
    let cancelled = false
    setArmed(null)
    void call.getState(sessionId).then((outcome) => {
      if (!cancelled && outcome.ok) setArmed(outcome.value.armed)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, call])

  // The Host auto-disarms in one-shot mode at run completion; refetch when a
  // run ends so the bell un-lights without a manual click.
  const prevRunning = useRef(running)
  useEffect(() => {
    const wasRunning = prevRunning.current
    prevRunning.current = running
    if (wasRunning && !running && armed === true) {
      void call.getState(sessionId).then((outcome) => {
        if (outcome.ok) setArmed(outcome.value.armed)
      })
    }
  }, [running, armed, sessionId, call])

  // Available named sounds from the Host (platform-dependent).
  useEffect(() => {
    let cancelled = false
    void call.listSounds(sessionId).then((outcome) => {
      if (!cancelled && outcome.ok) setNames(outcome.value.names)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, call])

  // Playback prefs: refresh on mount/session change and every time the panel
  // opens (the Host value can move via the Settings page or settings.yaml).
  // Reset the custom-file UI so the saved value decides the panel's shape.
  useEffect(() => {
    setCustomMode(false)
    setUploadError(null)
    let cancelled = false
    void call.getPrefs(sessionId).then((outcome) => {
      if (!cancelled && outcome.ok) setPrefs(outcome.value)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, call, open])

  // Close the popover on outside clicks.
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
    }
  }, [open])

  /** Write one prefs patch and adopt the echoed value. */
  const writePrefs = (patch: Parameters<ReturnType<typeof notifyRpc>['setPrefs']>[1]): void => {
    void call.setPrefs(sessionId, patch).then((outcome) => {
      if (outcome.ok) setPrefs(outcome.value)
    })
  }

  const toggle = async (): Promise<void> => {
    const next = !(armed ?? false)
    setArmed(next)
    const outcome = await call.setArmed(sessionId, next)
    if (outcome.ok) setArmed(outcome.value.armed)
  }

  const preview = async (): Promise<void> => {
    await call.preview(sessionId)
  }

  const isArmed = armed === true
  const isRunning = running && isArmed
  const label = isArmed ? (isRunning ? t('state.armedRunning') : t('action.disarm')) : t('action.arm')

  /** The last path component of a stored sound path (for display). */
  const fileName = (path: string): string => path.split('/').pop() ?? path

  /** Upload a picked file, save its stored path into the prefs, and preview it. */
  const onFilePicked = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    setUploading(true)
    setUploadError(null)
    const outcome = await uploadSound(file)
    setUploading(false)
    if (!outcome.ok) {
      setUploadError(outcome.error.message)
      return
    }
    writePrefs({ sound: outcome.value.path })
    await call.preview(sessionId)
  }
  const currentSound = prefs?.sound ?? ''
  const isCustom = customMode || (currentSound !== '' && !names.includes(currentSound))
  const volume = volDraft ?? ((prefs?.volume ?? 1) * 100)

  return (
    <div ref={rootRef} style={groupStyle}>
      <button
        type="button"
        style={buttonStyle}
        aria-label={label}
        aria-pressed={isArmed}
        title={label}
        onClick={() => void toggle()}
      >
        {isArmed ? <BellFilled /> : <BellOutline />}
      </button>
      <button
        type="button"
        style={{ ...buttonStyle, width: '14px' }}
        aria-label={t('action.preview')}
        aria-expanded={open}
        title={t('action.preview')}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <Caret />
      </button>
      {isRunning ? <span style={dotStyle} aria-hidden="true" /> : null}
      {open ? (
        <div style={panelStyle} role="dialog" aria-label={t('sound.label')}>
          <div style={rowStyle}>
            <span>{t('sound.label')}</span>
            <select
              style={fieldStyle}
              value={isCustom ? CUSTOM_KEY : currentSound}
              onChange={(event) => {
                const picked = event.target.value
                if (picked === CUSTOM_KEY) {
                  setCustomMode(true)
                  setUploadError(null)
                  return
                }
                setCustomMode(false)
                setUploadError(null)
                writePrefs({ sound: picked })
              }}
              aria-label={t('sound.label')}
            >
              {names.length === 0 ? <option value="">{t('sound.unavailable')}</option> : null}
              {names.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value={CUSTOM_KEY}>{t('sound.custom')}</option>
            </select>
          </div>
          {isCustom ? (
            <div style={{ ...rowStyle, alignItems: 'center' }}>
              <button
                type="button"
                style={previewButtonStyle}
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? t('sound.uploading') : t('sound.chooseFile')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                onChange={(event) => {
                  void onFilePicked(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '12px',
                  textAlign: 'right',
                }}
                title={currentSound}
              >
                {fileName(currentSound)}
              </span>
            </div>
          ) : null}
          {uploadError !== null ? (
            <div style={{ fontSize: '11px', color: '#e5484d' }}>{t('sound.uploadError', { reason: uploadError })}</div>
          ) : null}
          <div style={rowStyle}>
            <span>{t('volume.label')}</span>
            <input
              style={rangeStyle}
              type="range"
              min={0}
              max={100}
              value={Math.round(volume)}
              aria-label={t('volume.label')}
              onChange={(event) => setVolDraft(Number(event.target.value))}
              onPointerUp={() => {
                if (volDraft !== null) writePrefs({ volume: volDraft / 100 })
                setVolDraft(null)
              }}
              onKeyUp={() => {
                if (volDraft !== null) writePrefs({ volume: volDraft / 100 })
                setVolDraft(null)
              }}
            />
            <span style={{ width: '34px', textAlign: 'right' }}>{Math.round(volume)}%</span>
          </div>
          <div style={{ ...rowStyle, justifyContent: 'center' }}>
            <button type="button" style={previewButtonStyle} onClick={() => void preview()}>
              {t('action.preview')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
