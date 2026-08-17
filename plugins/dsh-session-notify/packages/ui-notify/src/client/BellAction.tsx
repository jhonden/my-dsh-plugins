/**
 * The completion bell: one compact control in the composer's tool row, right
 * after the resident access-mode chrome (`conversation.input.left`). It
 * reads the armed state for the current session from the Host's
 * `sessionNotify` Remote service, toggles it on click, offers a sound
 * preview in a tiny popover, and re-syncs after a run completes (the Host
 * auto-disarms in one-shot mode, so the bell must refetch to un-light).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { NS } from './locales.ts'
import { notifyRpc } from './rpc.ts'

/** Full props for the composer completion bell. */
export type BellActionProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS>

/** Unknown/loading armed state — the bell renders muted until known. */
type ArmedState = boolean | null

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

/** Small caret opening the preview popover. */
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

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  zIndex: 30,
  minWidth: '128px',
  padding: '4px',
  borderRadius: '8px',
  background: 'var(--dsh-color-bg-elevated, #ffffff)',
  border: '1px solid rgba(128, 128, 128, 0.25)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
  listStyle: 'none',
  margin: 0,
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  width: '100%',
  border: 'none',
  background: 'transparent',
  borderRadius: '4px',
  padding: '6px 8px',
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
 * click to arm/disarm, a caret opens the sound preview, and the run's
 * `running` flag drives a status dot plus the one-shot re-sync performed by
 * the Host.
 * @param props - framework slot currency plus the namespace translator.
 */
export function BellAction({ sessionId, useSession, t }: BellActionProps) {
  const [armed, setArmed] = useState<ArmedState>(null)
  const [open, setOpen] = useState(false)
  const rpc = useMemo(() => notifyRpc(), [])
  const running = useSession((snapshot) => snapshot.running)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Fetch armed state when the current session changes.
  useEffect(() => {
    let cancelled = false
    setArmed(null)
    void rpc.getState(sessionId).then((outcome) => {
      if (!cancelled && outcome.ok) setArmed(outcome.value.armed)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, rpc])

  // The Host auto-disarms in one-shot mode at run completion; refetch when a
  // run ends so the bell un-lights without a manual click.
  const prevRunning = useRef(running)
  useEffect(() => {
    const wasRunning = prevRunning.current
    prevRunning.current = running
    if (wasRunning && !running && armed === true) {
      void rpc.getState(sessionId).then((outcome) => {
        if (outcome.ok) setArmed(outcome.value.armed)
      })
    }
  }, [running, armed, sessionId, rpc])

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
    const outcome = await rpc.setArmed(sessionId, next)
    if (outcome.ok) setArmed(outcome.value.armed)
  }

  const preview = async (): Promise<void> => {
    setOpen(false)
    await rpc.preview(sessionId)
  }

  const isArmed = armed === true
  const isRunning = running && isArmed
  const label = isArmed ? (isRunning ? t('state.armedRunning') : t('action.disarm')) : t('action.arm')

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
        <ul style={menuStyle} role="menu" aria-label={t('action.preview')}>
          <li role="none">
            <button type="button" role="menuitem" style={menuItemStyle} onClick={() => void preview()}>
              {t('action.preview')}
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
