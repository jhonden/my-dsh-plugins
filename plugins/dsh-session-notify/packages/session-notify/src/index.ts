/**
 * Per-session completion notification for the dsh Web client.
 *
 * The Host half: a Typert Remote service exposing the arm/state/preview wire
 * surface plus three root event listeners that implement the notification
 * state machine —
 *
 *  - `agent/status`: a run is the `running` → `idle` transition of a
 *    session's agent. A session armed at that moment plays the configured
 *    sound and (in one-shot mode) auto-disarms. Using the status event rather
 *    than `turn/end` makes a whole run (all its steps and tool calls, and
 *    every turn a goal round drives) the notification unit.
 *  - `session/disposed`: a removed session never notifies; its armed and
 *    busy state is cleaned up.
 *  - `agent/pre-step`: the `!notify` / `🔔` message marker arms the session
 *    and is stripped from the messages entering the step.
 *
 * Armed state is persisted (debounced, atomic) under
 * `$DSH_HOME/plugins/dsh-session-notify/armed.json` so it survives restarts.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'
import type { SettingsPathOp, SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { Session, SessionId, UserMessage } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { applyNotifyMarker } from './marker.ts'
import { MACOS_SOUND_NAMES, SoundPlayer } from './sound.ts'
import { DEFAULT_MAX_UPLOAD_BYTES, UploadRejectedError, UploadTooLargeError, saveUpload } from './sound-upload.ts'
import {
  SESSION_NOTIFY_SETTINGS_NAMESPACE,
  SESSION_NOTIFY_SETTINGS_SCHEMA,
  type SessionNotifySettings,
} from './settings.ts'
import type {
  NotifyGetStateRequest,
  NotifyMode,
  NotifyPrefs,
  NotifyPreviewResult,
  NotifySetArmedRequest,
  NotifySetArmedResult,
  NotifySetPrefsRequest,
  NotifySoundListResult,
  NotifyState,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Per-session completion notification control (`sessionNotify/getState|setArmed|preview`). */
    sessionNotify: SessionNotifyService
  }
}

/** Deployment-tunable configuration; all fields have safe defaults. */
export type Config = z.infer<typeof SessionNotifyService.Config>

/** Debounce for state-file writes, in milliseconds. */
const SAVE_DEBOUNCE_MS = 250

/**
 * Session notification service (`ctx.sessionNotify`): the Host half of the
 * completion bell. Remote methods read/write the armed flag for the calling
 * session; the event listeners drive the sound at run completion.
 */
export class SessionNotifyService extends TypertRemoteService {
  /** Schema for the cordis.yml row; the same object serves constructor config. */
  static Config = z.object({
    /** Named macOS system sound (e.g. `Glass`) or an absolute audio file path. */
    sound: z.string().default('Glass'),
    /** `one-shot` plays once then auto-disarms; `sticky` keeps notifying until disarmed. */
    mode: z.enum(['one-shot', 'sticky']).default('one-shot'),
    /** afplay volume 0..1; macOS only. */
    volume: z.number().min(0).max(1).optional(),
    /** State-file override (tests); defaults under the dsh home. */
    stateFile: z.string().optional(),
    /** Custom-sound storage dir override (tests); defaults under the dsh home. */
    uploadDir: z.string().optional(),
    /** Maximum accepted custom-sound upload size in bytes. */
    maxUploadBytes: z.number().int().positive().default(DEFAULT_MAX_UPLOAD_BYTES),
  }).default(() => ({ sound: 'Glass', mode: 'one-shot', maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES } as const))

  /** Armed sessions (persisted): session id → armed flag. */
  private readonly armed = new Map<string, boolean>()
  /** Sessions whose agent is currently running (in-memory only). */
  private readonly busy = new Set<string>()
  /** Playback seam; tests override {@link playSound}. */
  protected readonly player = new SoundPlayer()
  private readonly stateFile: string
  private readonly uploadDir: string
  private readonly maxUploadBytes: number
  /** The authoritative playback config: the settings section while one is attached, the entry otherwise. */
  protected settingsSource: () => SessionNotifySettings
  /**
   * Host-side settings handle for in-process writes. The browser settings
   * transport only accepts loopback clients, so the bell panel (reachable from
   * LAN IPs too) writes through this instead.
   */
  private settingsApi: SettingsProvider | undefined = undefined
  protected mode: NotifyMode
  protected sound: string
  protected volume: number | undefined
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  /** Settles when persisted armed state has been read; state reads await it. */
  private readonly ready: Promise<void>

  constructor(ctx: Context, config: Config = { sound: 'Glass', mode: 'one-shot', maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES } as const) {
    super(ctx, 'sessionNotify')
    // Parse through the schema so field defaults apply for direct construction
    // (tests, embedded use) exactly as they do for cordis.yml rows.
    const resolved = SessionNotifyService.Config.parse(config)
    this.sound = resolved.sound
    this.mode = resolved.mode
    this.volume = resolved.volume
    this.stateFile = resolved.stateFile ?? dshHomePath('plugins', 'dsh-session-notify', 'armed.json')
    this.uploadDir = resolved.uploadDir ?? dshHomePath('plugins', 'dsh-session-notify', 'sounds')
    this.maxUploadBytes = resolved.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES
    this.settingsSource = () => ({ sound: this.sound, volume: this.volume ?? 1, mode: this.mode })
    this.ready = this.load()
    ctx.inject(['webServer'], (webCtx) => {
      ctx.effect(() => webCtx.webServer.register({
        kind: 'exact',
        path: '/plugins-session-notify/upload',
        handler: (req, res) => {
          void this.handleUpload(req, res)
        },
      }), 'session-notify: sound upload route')
    })
    // User settings override the entry config as the composition base; changes
    // are hot-reloaded from `$DSH_HOME/settings.yaml` (no restart needed).
    installSettingsSection(
      ctx,
      SESSION_NOTIFY_SETTINGS_NAMESPACE,
      SESSION_NOTIFY_SETTINGS_SCHEMA,
      {
        sound: resolved.sound,
        mode: resolved.mode,
        ...(resolved.volume === undefined ? {} : { volume: resolved.volume }),
      },
      {
        setSource: (current) => {
          this.settingsSource = current
        },
        onChange: () => {
          const value = this.settingsSource()
          this.sound = value.sound
          this.volume = value.volume
          this.mode = value.mode
        },
      },
    )
    ctx.inject(['settings'], (sctx) => {
      this.settingsApi = sctx.settings
    })
    ctx.on('agent/status', ({ agent, status }) => this.onAgentStatus(agent.id, status))
    ctx.on('session/disposed', (session) => this.onSessionDisposed(session.id))
    ctx.on('agent/pre-step', (payload, next) => this.onPreStep(payload, next))
  }

  /** Current armed state for one session. */
  @Remote('getState')
  async getState(session: Session): Promise<NotifyState> {
    await this.ready
    return { armed: this.armed.get(session.id) ?? false }
  }

  /** Arm or disarm one session. */
  @Remote('setArmed')
  async setArmed(session: Session, request: NotifySetArmedRequest): Promise<NotifySetArmedResult> {
    if (request.armed) {
      this.armed.set(session.id, true)
    } else {
      this.armed.delete(session.id)
    }
    this.scheduleSave()
    return { armed: request.armed }
  }

  /** Play the configured sound immediately (sound preview / test). */
  @Remote('preview')
  async preview(_session: Session, _request: NotifyGetStateRequest): Promise<NotifyPreviewResult> {
    return { ok: this.playSound() }
  }

  /** Named sounds the host can play directly (macOS system sounds; empty elsewhere). */
  @Remote('listSounds')
  async listSounds(_session: Session, _request: NotifyGetStateRequest): Promise<NotifySoundListResult> {
    return { names: process.platform === 'darwin' ? [...MACOS_SOUND_NAMES] : [] }
  }

  /** The playback preferences currently in effect (settings-resolved). */
  @Remote('getPrefs')
  async getPrefs(_session: Session, _request: NotifyGetStateRequest): Promise<NotifyPrefs> {
    await this.ready
    return this.prefsSnapshot()
  }

  /**
   * Write playback preferences through the host-side settings service (in
   * process — the browser settings transport is loopback-only, so LAN clients
   * must go through here). Every present field is written; others are left
   * alone. The settings watch then refreshes the live playback config.
   */
  @Remote('setPrefs')
  async setPrefs(_session: Session, request: NotifySetPrefsRequest): Promise<NotifyPrefs> {
    const ops: SettingsPathOp[] = []
    if (request.sound !== undefined) ops.push({ op: 'set', path: ['sound'], value: request.sound })
    if (request.volume !== undefined) ops.push({ op: 'set', path: ['volume'], value: request.volume })
    if (request.mode !== undefined) ops.push({ op: 'set', path: ['mode'], value: request.mode })
    if (ops.length > 0) {
      if (this.settingsApi !== undefined) {
        await this.settingsApi.mutate(SESSION_NOTIFY_SETTINGS_NAMESPACE, ops)
      } else {
        // No settings service (headless/no-settings assembly): apply in memory.
        this.applySettingsPatch(request)
      }
    }
    return this.prefsSnapshot()
  }

  /** The current playback prefs with absent optional fields omitted. */
  private prefsSnapshot(): NotifyPrefs {
    return {
      sound: this.sound,
      mode: this.mode,
      ...(this.volume === undefined ? {} : { volume: this.volume }),
    }
  }

  /** Direct in-memory application when the settings service is absent. */
  private applySettingsPatch(request: NotifySetPrefsRequest): void {
    if (request.sound !== undefined) this.sound = request.sound
    if (request.volume !== undefined) this.volume = request.volume
    if (request.mode !== undefined) this.mode = request.mode
  }

  /**
   * The custom-sound upload route: same-origin fence, POST body read as a raw
   * byte stream with extension + size caps, stored under the plugin's sounds
   * directory, and the stored absolute path returned so the client can save it
   * into the prefs.
   */
  private async handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const fail = (status: number, code: string): void => {
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.writeHead(status, { 'content-type': 'text/plain' })
      res.end(code)
    }
    if (!this.isSameOrigin(req)) {
      fail(403, 'cross-origin denied')
      return
    }
    if (req.method !== 'POST') {
      fail(405, 'method not allowed')
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const name = url.searchParams.get('name') ?? ''
    try {
      const path = await saveUpload(this.uploadDir, name, req, this.maxUploadBytes)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ path }))
    } catch (error) {
      if (error instanceof UploadTooLargeError) {
        fail(413, 'upload too large')
      } else if (error instanceof UploadRejectedError) {
        fail(400, error.message)
      } else {
        console.warn('[session-notify] sound upload failed:', error)
        fail(500, 'upload failed')
      }
    }
  }

  /**
   * Same-origin fence for the upload route: a browser's own fetch to this
   * origin carries `Sec-Fetch-Site: same-origin`; a cross-site embed carries
   * `cross-site`. Non-browser clients (curl, tests) send no Sec-Fetch headers.
   */
  private isSameOrigin(req: IncomingMessage): boolean {
    const site = req.headers['sec-fetch-site']
    if (site === undefined) {
      return req.headers.origin === undefined || req.headers.referer === undefined
    }
    return site === 'same-origin' || site === 'same-site' || site === 'none'
  }

  /** The status listener: a run completing while armed plays the sound. */
  private onAgentStatus(id: SessionId, status: 'idle' | 'running'): void {
    if (status === 'running') {
      this.busy.add(id)
      return
    }
    const wasBusy = this.busy.delete(id)
    if (!wasBusy) return
    if (!(this.armed.get(id) ?? false)) return
    this.playSound()
    if (this.mode === 'one-shot') {
      this.armed.delete(id)
      this.scheduleSave()
    }
  }

  /** A disposed session must never notify; drop its state. */
  private onSessionDisposed(id: SessionId): void {
    const hadArmed = this.armed.delete(id)
    const hadBusy = this.busy.delete(id)
    if (hadArmed || hadBusy) this.scheduleSave()
  }

  /** The pre-step waterfall: strip the notify marker and arm the session. */
  private async onPreStep(
    payload: { agent: Agent; messages: UserMessage[]; turn: number; step: number; signal: AbortSignal },
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> {
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    const result = applyNotifyMarker(decision.messages)
    if (!result.armed) return decision
    this.armed.set(payload.agent.id, true)
    this.scheduleSave()
    return { kind: 'enter', messages: result.messages }
  }

  /** Playback seam: tests override this to count triggers without spawning. */
  protected playSound(): boolean {
    return this.player.play(this.sound, this.volume)
  }

  /** Restore persisted armed state; a corrupt file resets to empty with a warning. */
  private async load(): Promise<void> {
    let raw: string
    try {
      raw = await readFile(this.stateFile, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[session-notify] failed to read armed state:', error)
      }
      return
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not a record')
      for (const [id, flag] of Object.entries(parsed)) {
        if (typeof flag === 'boolean' && flag) this.armed.set(id, true)
      }
    } catch (error) {
      console.warn(`[session-notify] armed state file ${this.stateFile} is corrupt; resetting:`, error)
      this.armed.clear()
      this.scheduleSave()
    }
  }

  /** Debounced atomic persistence of the armed map. */
  private scheduleSave(): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const content = JSON.stringify(Object.fromEntries(this.armed), null, 2)
      void writeFileAtomic(this.stateFile, content, { mode: 0o600, dirMode: 0o700 }).catch((error) => {
        console.warn(`[session-notify] failed to persist armed state to ${this.stateFile}:`, error)
      })
    }, SAVE_DEBOUNCE_MS)
  }
}

export default SessionNotifyService
