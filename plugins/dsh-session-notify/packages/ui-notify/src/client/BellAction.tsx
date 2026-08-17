/**
 * The completion bell: one compact control in the composer's tool row, right
 * after the resident access-mode chrome (`conversation.input.left`). It
 * reads the armed state for the current session from the Host's
 * `sessionNotify` Remote service, toggles it on click, and its popover is a
 * small sound-settings panel (system sounds, a custom file path, volume, and
 * a preview) bound to the `session-notify` settings namespace — hot-reloaded
 * from `$DSH_HOME/settings.yaml`, shared with the Settings page.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import { NS } from './locales.ts'
import { notifyRpc } from './rpc.ts'

/** Full props for the composer completion bell. */
export type BellActionProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS> & BellInjected

/** The settings section this bell binds (mirror of the Host namespace). */
export interface BellSettings {
  sound: string
  volume?: number
  mode?: 'one-shot' | 'sticky'
}

/** Host-facing services injected by the plugin registration. */
export interface BellInjected {
  /** The `session-notify` settings scope (read/subscribe/write). */
  settings: SettingsScope<BellSettings>
  /** The sessionNotify Remote caller (arm state, preview, sound list). */
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
  top: 'calc(100% + 6px)',
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
 * click to arm/disarm; the caret opens the sound-settings panel bound to the
 * shared `session-notify` settings namespace.
 * @param props - framework slot currency, the namespace translator, and the injected faces.
 */
export function BellAction({ sessionId, useSession, t, settings, call }: BellActionProps) {
  const [armed, setArmed] = useState<ArmedState>(null)
  const [open, setOpen] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [customPath, setCustomPath] = useState('')
  const [volDraft, setVolDraft] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const running = useSession((snapshot) => snapshot.running)

  // Reactive settings section (stable snapshot reference until a change).
  const settingsSnapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot)
  const value = settingsSnapshot.value

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
  const currentSound = value?.sound ?? ''
  const isCustom = currentSound !== '' && !names.includes(currentSound)
  const volume = volDraft ?? ((value?.volume ?? 1) * 100)

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
                  setCustomPath(isCustom ? currentSound : '')
                  return
                }
                void settings.set('sound', picked)
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
            <div style={rowStyle}>
              <input
                style={fieldStyle}
                type="text"
                value={customPath === '' ? currentSound : customPath}
                placeholder={t('sound.customPlaceholder')}
                aria-label={t('sound.customPlaceholder')}
                onChange={(event) => setCustomPath(event.target.value)}
                onBlur={(event) => {
                  const path = event.target.value.trim()
                  if (path !== '') void settings.set('sound', path)
                  setCustomPath('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const path = (event.target as HTMLInputElement).value.trim()
                    if (path !== '') void settings.set('sound', path)
                    setCustomPath('')
                  }
                }}
              />
            </div>
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
                if (volDraft !== null) void settings.set('volume', volDraft / 100)
                setVolDraft(null)
              }}
              onKeyUp={() => {
                if (volDraft !== null) void settings.set('volume', volDraft / 100)
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
