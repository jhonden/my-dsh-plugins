/**
 * User-settings section for session-notify (the `sessionNotify` namespace):
 * the sound, volume, and mode the bell plays with. Editable from the dsh
 * Settings page or the bell's own panel, stored in `$DSH_HOME/settings.yaml`
 * and hot-reloaded — no restart needed. The plugin's cordis config remains
 * the composition layer below the user section.
 */
import z from '@deepseek-ai/schemastery';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';
import type { NotifyMode } from './types.ts';
/** Settings namespace owning the notification preferences (kebab-case per dsh rule). */
export declare const SESSION_NOTIFY_SETTINGS_NAMESPACE: SettingsNamespace;
/** The user-owned notification preferences. */
export interface SessionNotifySettings {
    /** Named system sound (macOS) or an absolute audio file path. */
    sound: string;
    /** Playback volume 0..1; macOS afplay only (absent = platform default). */
    volume?: number;
    /** `one-shot` plays once then auto-disarms; `sticky` keeps notifying. */
    mode: NotifyMode;
}
/**
 * Schema resolving the namespace — the user-facing twin of the plugin Config
 * minus the internal `stateFile` seam.
 */
export declare const SESSION_NOTIFY_SETTINGS_SCHEMA: z<Schemastery.ObjectS<{
    sound: z<string, string>;
    volume: z<number, number>;
    mode: z<"one-shot" | "sticky", "one-shot" | "sticky">;
}>, Schemastery.ObjectT<{
    sound: z<string, string>;
    volume: z<number, number>;
    mode: z<"one-shot" | "sticky", "one-shot" | "sticky">;
}>>;
//# sourceMappingURL=settings.d.ts.map