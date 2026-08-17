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
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type { Session, SessionId, UserMessage } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { applyNotifyMarker } from './marker.ts'
import { SoundPlayer } from './sound.ts'
import type {
  NotifyGetStateRequest,
  NotifyMode,
  NotifyPreviewResult,
  NotifySetArmedRequest,
  NotifySetArmedResult,
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
  }).default(() => ({ sound: 'Glass', mode: 'one-shot' } as const))

  /** Armed sessions (persisted): session id → armed flag. */
  private readonly armed = new Map<string, boolean>()
  /** Sessions whose agent is currently running (in-memory only). */
  private readonly busy = new Set<string>()
  /** Playback seam; tests override {@link playSound}. */
  protected readonly player = new SoundPlayer()
  private readonly stateFile: string
  private readonly mode: NotifyMode
  private readonly sound: string
  private readonly volume: number | undefined
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  /** Settles when persisted armed state has been read; state reads await it. */
  private readonly ready: Promise<void>

  constructor(ctx: Context, config: Config = { sound: 'Glass', mode: 'one-shot' } as const) {
    super(ctx, 'sessionNotify')
    // Parse through the schema so field defaults apply for direct construction
    // (tests, embedded use) exactly as they do for cordis.yml rows.
    const resolved = SessionNotifyService.Config.parse(config)
    this.sound = resolved.sound
    this.mode = resolved.mode
    this.volume = resolved.volume
    this.stateFile = resolved.stateFile ?? dshHomePath('plugins', 'dsh-session-notify', 'armed.json')
    this.ready = this.load()
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
