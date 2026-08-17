/**
 * Wire vocabulary for the session-notify Remote service. Every payload is
 * strict JSON so the Typert gateway can validate it at the boundary.
 */

/** One session's notification state. */
export interface NotifyState {
  /** Whether this session is armed to play a sound when its run finishes. */
  armed: boolean
}

/** getState request — deliberately empty (the session id already addresses the row). */
export interface NotifyGetStateRequest {
}

/** setArmed request. */
export interface NotifySetArmedRequest {
  /** The armed flag to persist for the calling session. */
  armed: boolean
}

/** setArmed response — echoes the accepted flag for the UI. */
export interface NotifySetArmedResult {
  armed: boolean
}

/** preview response. */
export interface NotifyPreviewResult {
  /** Whether a playback was actually launched. */
  ok: boolean
}

/** listSounds response. */
export interface NotifySoundListResult {
  /** Named sounds the host can play directly (platform-dependent; empty off macOS). */
  names: string[]
}

/**
 * Notification mode. 'one-shot' plays once and auto-disarms at the first run
 * completion after arming; 'sticky' keeps the session armed so every
 * completed run plays the sound until the user disarms.
 */
export type NotifyMode = 'one-shot' | 'sticky'