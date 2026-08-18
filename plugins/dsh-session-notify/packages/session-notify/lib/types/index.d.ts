import type { Context } from '@deepseek-ai/cordis';
import type { Session } from '@deepseek-ai/dsh-session';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { z } from 'zod';
import { SoundPlayer } from './sound.ts';
import { type SessionNotifySettings } from './settings.ts';
import type { NotifyGetStateRequest, NotifyMode, NotifyPrefs, NotifyPreviewResult, NotifySetArmedRequest, NotifySetArmedResult, NotifySetPrefsRequest, NotifySoundListResult, NotifyState } from './types.ts';
export type * from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Per-session completion notification control (`sessionNotify/getState|setArmed|preview`). */
        sessionNotify: SessionNotifyService;
    }
}
/** Deployment-tunable configuration; all fields have safe defaults. */
export type Config = z.infer<typeof SessionNotifyService.Config>;
/**
 * Session notification service (`ctx.sessionNotify`): the Host half of the
 * completion bell. Remote methods read/write the armed flag for the calling
 * session; the event listeners drive the sound at run completion.
 */
export declare class SessionNotifyService extends TypertRemoteService {
    /** Schema for the cordis.yml row; the same object serves constructor config. */
    static Config: z.ZodDefault<z.ZodObject<{
        sound: z.ZodDefault<z.ZodString>;
        mode: z.ZodDefault<z.ZodEnum<{
            "one-shot": "one-shot";
            sticky: "sticky";
        }>>;
        volume: z.ZodOptional<z.ZodNumber>;
        stateFile: z.ZodOptional<z.ZodString>;
        uploadDir: z.ZodOptional<z.ZodString>;
        maxUploadBytes: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
    /** Armed sessions (persisted): session id → armed flag. */
    private readonly armed;
    /** Sessions whose agent is currently running (in-memory only). */
    private readonly busy;
    /** Playback seam; tests override {@link playSound}. */
    protected readonly player: SoundPlayer;
    private readonly stateFile;
    private readonly uploadDir;
    private readonly maxUploadBytes;
    /** The authoritative playback config: the settings section while one is attached, the entry otherwise. */
    protected settingsSource: () => SessionNotifySettings;
    /**
     * Host-side settings handle for in-process writes. The browser settings
     * transport only accepts loopback clients, so the bell panel (reachable from
     * LAN IPs too) writes through this instead.
     */
    private settingsApi;
    protected mode: NotifyMode;
    protected sound: string;
    protected volume: number | undefined;
    private saveTimer;
    /** Settles when persisted armed state has been read; state reads await it. */
    private readonly ready;
    constructor(ctx: Context, config?: Config);
    /** Current armed state for one session. */
    getState(session: Session): Promise<NotifyState>;
    /** Arm or disarm one session. */
    setArmed(session: Session, request: NotifySetArmedRequest): Promise<NotifySetArmedResult>;
    /** Play the configured sound immediately (sound preview / test). */
    preview(_session: Session, _request: NotifyGetStateRequest): Promise<NotifyPreviewResult>;
    /** Named sounds the host can play directly (built-in sounds for the platform). */
    listSounds(_session: Session, _request: NotifyGetStateRequest): Promise<NotifySoundListResult>;
    /** The playback preferences currently in effect (settings-resolved). */
    getPrefs(_session: Session, _request: NotifyGetStateRequest): Promise<NotifyPrefs>;
    /**
     * Write playback preferences through the host-side settings service (in
     * process — the browser settings transport is loopback-only, so LAN clients
     * must go through here). Every present field is written; others are left
     * alone. The settings watch then refreshes the live playback config.
     */
    setPrefs(_session: Session, request: NotifySetPrefsRequest): Promise<NotifyPrefs>;
    /** The current playback prefs with absent optional fields omitted. */
    private prefsSnapshot;
    /** Direct in-memory application when the settings service is absent. */
    private applySettingsPatch;
    /**
     * The custom-sound upload route: same-origin fence, POST body read as a raw
     * byte stream with extension + size caps, stored under the plugin's sounds
     * directory, and the stored absolute path returned so the client can save it
     * into the prefs.
     */
    private handleUpload;
    /**
     * Same-origin fence for the upload route: a browser's own fetch to this
     * origin carries `Sec-Fetch-Site: same-origin`; a cross-site embed carries
     * `cross-site`. Non-browser clients (curl, tests) send no Sec-Fetch headers.
     */
    private isSameOrigin;
    /** The status listener: a run completing while armed plays the sound. */
    private onAgentStatus;
    /** A disposed session must never notify; drop its state. */
    private onSessionDisposed;
    /** The pre-step waterfall: strip the notify marker and arm the session. */
    private onPreStep;
    /** Playback seam: tests override this to count triggers without spawning. */
    protected playSound(): boolean;
    /** Restore persisted armed state; a corrupt file resets to empty with a warning. */
    private load;
    /** Debounced atomic persistence of the armed map. */
    private scheduleSave;
}
export default SessionNotifyService;
//# sourceMappingURL=index.d.ts.map