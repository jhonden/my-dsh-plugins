/**
 * User-settings section for session-notify (the `sessionNotify` namespace):
 * the sound, volume, and mode the bell plays with. Editable from the dsh
 * Settings page or the bell's own panel, stored in `$DSH_HOME/settings.yaml`
 * and hot-reloaded — no restart needed. The plugin's cordis config remains
 * the composition layer below the user section.
 */
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type { NotifyMode } from './types.ts'

/** Settings namespace owning the notification preferences (kebab-case per dsh rule). */
export const SESSION_NOTIFY_SETTINGS_NAMESPACE = settingsNamespace('session-notify')

/** The user-owned notification preferences. */
export interface SessionNotifySettings {
  /** Named system sound (macOS) or an absolute audio file path. */
  sound: string
  /** Playback volume 0..1; macOS afplay only (absent = platform default). */
  volume?: number
  /** `one-shot` plays once then auto-disarms; `sticky` keeps notifying. */
  mode: NotifyMode
}

/**
 * Schema resolving the namespace — the user-facing twin of the plugin Config
 * minus the internal `stateFile` seam.
 */
export const SESSION_NOTIFY_SETTINGS_SCHEMA = z.object({
  sound: z.string().default('Glass'),
  // `percent` both bounds 0..1 and renders as a slider in the Settings page.
  volume: z.percent().default(1),
  mode: z.union([z.const('one-shot'), z.const('sticky')]).default('one-shot'),
})