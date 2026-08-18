import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { SettingsProvider } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type { Session, SessionId, UserMessage } from '@deepseek-ai/dsh-session'
import { SessionNotifyService } from '../src/index.ts'
import { applyNotifyMarker, stripMarker } from '../src/marker.ts'
import { MACOS_SOUND_NAMES, WINDOWS_SOUND_NAMES, defaultSoundName, resolveSoundPath, soundsForPlatform } from '../src/sound.ts'
import { audioExtensionsForPlatform, saveUpload } from '../src/sound-upload.ts'
import type { NotifyMode } from '../src/types.ts'

/** Real service with a counted playback seam — no audio is ever spawned. */
class CountingService extends SessionNotifyService {
  plays = 0

  protected playSound(): boolean {
    this.plays += 1
    return true
  }

  /** Settings-verification reads of the (protected) playback config. */
  currentSound(): string {
    return this.sound
  }

  currentMode(): NotifyMode {
    return this.mode
  }
}

/** Minimal in-memory settings provider so installSettingsSection wiring is testable. */
class FakeSettingsProvider extends SettingsProvider {
  readonly writable = true

  private doc: Record<string, unknown> = {}

  get documentPath(): string | undefined {
    return undefined
  }

  constructor(ctx: Context) {
    super(ctx, 'settings')
  }

  protected async load(): Promise<Record<string, unknown>> {
    return this.doc
  }

  protected async persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = section
  }

  /** Test seam: publish a whole raw document as the file provider would on reload. */
  push(doc: Record<string, unknown>): void {
    this.doc = doc
    this.publish(doc)
  }

  /** Test seam: the current raw document. */
  document(): Record<string, unknown> {
    return this.doc
  }
}

/** A bare session-shaped object: only the identity is consumed. */
function session(id: string): Session {
  return { id } as Session
}

/** A bare agent-shaped object carrying the session identity. */
function agent(id: string): Agent {
  return { id } as Agent
}

/** A user message with one text block, source kind `user`. */
function userMessage(id: string, text: string): UserMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  } as UserMessage
}

/** A plugin-injected context message (never user). */
function injectedMessage(id: string, text: string): UserMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'plugin', plugin: 'test' },
  } as UserMessage
}

/** Build a service with a fresh temp state file. */
async function setup(config?: ConstructorParameters<typeof SessionNotifyService>[1]): Promise<{
  ctx: Context
  service: CountingService
  stateFile: string
  dir: string
}> {
  const ctx = new Context()
  const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
  const stateFile = join(dir, 'armed.json')
  const service = new CountingService(ctx, { stateFile, ...config })
  return { ctx, service, stateFile, dir }
}

describe('SessionNotifyService remote surface', () => {
  let fixture: Awaited<ReturnType<typeof setup>>

  beforeEach(async () => {
    fixture = await setup()
  })
  afterEach(async () => {
    await rm(fixture.dir, { recursive: true, force: true })
  })

  it('defaults to unarmed', async () => {
    await expect(fixture.service.getState(session('session-1'))).resolves.toEqual({ armed: false })
  })

  it('arms and disarms through setArmed', async () => {
    const s = session('session-1')
    await expect(fixture.service.setArmed(s, { armed: true })).resolves.toEqual({ armed: true })
    await expect(fixture.service.getState(s)).resolves.toEqual({ armed: true })
    await expect(fixture.service.setArmed(s, { armed: false })).resolves.toEqual({ armed: false })
    await expect(fixture.service.getState(s)).resolves.toEqual({ armed: false })
  })
})

describe('SessionNotifyService persistence', () => {
  it('writes armed state to the state file (debounced)', async () => {
    const { ctx, service, stateFile, dir } = await setup()
    try {
      await service.setArmed(session('session-1'), { armed: true })
      await new Promise((resolve) => setTimeout(resolve, 400))
      const raw = await readFile(stateFile, 'utf8')
      expect(JSON.parse(raw)).toEqual({ 'session-1': true })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('restores armed state from a pre-existing file', async () => {
    const { ctx, service, stateFile, dir } = await setup()
    try {
      await service.setArmed(session('session-1'), { armed: true })
      await new Promise((resolve) => setTimeout(resolve, 400))
      const restoredCtx = new Context()
      const restored = new CountingService(restoredCtx, { stateFile })
      await expect(restored.getState(session('session-1'))).resolves.toEqual({ armed: true })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('resets cleanly on a corrupt state file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    const stateFile = join(dir, 'armed.json')
    await writeFile(stateFile, 'not json {{{', 'utf8')
    const ctx = new Context()
    try {
      const service = new CountingService(ctx, { stateFile })
      await expect(service.getState(session('session-1'))).resolves.toEqual({ armed: false })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('SessionNotifyService completion detection', () => {
  let fixture: Awaited<ReturnType<typeof setup>>

  beforeEach(async () => {
    fixture = await setup()
  })
  afterEach(async () => {
    await rm(fixture.dir, { recursive: true, force: true })
  })

  it('plays once and auto-disarms in one-shot mode when an armed run completes', async () => {
    const { ctx, service } = fixture
    const id = 'session-1' as SessionId
    await service.setArmed(session(id), { armed: true })
    ctx.emit('agent/status', { agent: agent(id), status: 'running' })
    ctx.emit('agent/status', { agent: agent(id), status: 'idle' })
    expect(service.plays).toBe(1)
    await expect(service.getState(session(id))).resolves.toEqual({ armed: false })
  })

  it('keeps notifying in sticky mode until disarmed', async () => {
    const { ctx, service } = await setup({ mode: 'sticky' })
    try {
      const id = 'session-1' as SessionId
      await service.setArmed(session(id), { armed: true })
      ctx.emit('agent/status', { agent: agent(id), status: 'running' })
      ctx.emit('agent/status', { agent: agent(id), status: 'idle' })
      ctx.emit('agent/status', { agent: agent(id), status: 'running' })
      ctx.emit('agent/status', { agent: agent(id), status: 'idle' })
      expect(service.plays).toBe(2)
      await expect(service.getState(session(id))).resolves.toEqual({ armed: true })
    } finally {
      await rm(fixture.dir, { recursive: true, force: true })
    }
  })

  it('never plays for an unarmed session', async () => {
    const { ctx, service } = fixture
    const id = 'session-1' as SessionId
    ctx.emit('agent/status', { agent: agent(id), status: 'running' })
    ctx.emit('agent/status', { agent: agent(id), status: 'idle' })
    expect(service.plays).toBe(0)
  })

  it('ignores an idle transition with no prior running (fresh session)', async () => {
    const { ctx, service } = fixture
    const id = 'session-1' as SessionId
    await service.setArmed(session(id), { armed: true })
    ctx.emit('agent/status', { agent: agent(id), status: 'idle' })
    expect(service.plays).toBe(0)
    await expect(service.getState(session(id))).resolves.toEqual({ armed: true })
  })

  it('does not notify a disposed session and clears its state', async () => {
    const { ctx, service } = fixture
    const id = 'session-1' as SessionId
    await service.setArmed(session(id), { armed: true })
    ctx.emit('session/disposed', session(id))
    expect(service.plays).toBe(0)
    await expect(service.getState(session(id))).resolves.toEqual({ armed: false })
  })

  it('notifies the armed session when it completes while running (armed mid-run)', async () => {
    const { ctx, service } = fixture
    const id = 'session-1' as SessionId
    ctx.emit('agent/status', { agent: agent(id), status: 'running' })
    await service.setArmed(session(id), { armed: true })
    ctx.emit('agent/status', { agent: agent(id), status: 'idle' })
    expect(service.plays).toBe(1)
  })
})

describe('SessionNotifyService pre-step marker', () => {
  let fixture: Awaited<ReturnType<typeof setup>>

  beforeEach(async () => {
    fixture = await setup()
  })
  afterEach(async () => {
    await rm(fixture.dir, { recursive: true, force: true })
  })

  async function runPreStep(messages: UserMessage[]): Promise<PreStepDecision> {
    const { ctx, service } = fixture
    const next = async (): Promise<PreStepDecision> => ({ kind: 'enter', messages })
    return ctx.waterfall('agent/pre-step', {
      agent: agent('session-1'),
      messages,
      turn: 1,
      step: 0,
      signal: new AbortController().signal,
    }, next)
  }

  it('strips the marker, arms the session, and keeps the task text', async () => {
    const decision = await runPreStep([userMessage('m1', '!notify 帮我算 1+1')])
    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') return
    expect(decision.messages[0]?.content[0]).toMatchObject({ type: 'text', text: '帮我算 1+1' })
    await expect(fixture.service.getState(session('session-1'))).resolves.toEqual({ armed: true })
  })

  it('accepts the emoji alias', async () => {
    const decision = await runPreStep([userMessage('m1', '🔔 帮我算 1+1')])
    if (decision.kind !== 'enter') return
    expect(decision.messages[0]?.content[0]).toMatchObject({ type: 'text', text: '帮我算 1+1' })
  })

  it('leaves plain messages untouched and does not arm', async () => {
    const message = userMessage('m1', '帮我算 1+1')
    const decision = await runPreStep([message])
    if (decision.kind !== 'enter') return
    expect(decision.messages).toEqual([message])
    await expect(fixture.service.getState(session('session-1'))).resolves.toEqual({ armed: false })
  })

  it('never inspects plugin-injected context messages', async () => {
    const message = injectedMessage('m1', '!notify 文件已更新')
    const decision = await runPreStep([message])
    if (decision.kind !== 'enter') return
    expect(decision.messages).toEqual([message])
    await expect(fixture.service.getState(session('session-1'))).resolves.toEqual({ armed: false })
  })

  it('keeps the original text when the marker is the whole message, but still arms', async () => {
    const message = userMessage('m1', '!notify')
    const decision = await runPreStep([message])
    if (decision.kind !== 'enter') return
    expect(decision.messages).toEqual([message])
    await expect(fixture.service.getState(session('session-1'))).resolves.toEqual({ armed: true })
  })

  it('propagates a rejected decision unchanged', async () => {
    const { ctx, service } = fixture
    const decision = await ctx.waterfall('agent/pre-step', {
      agent: agent('session-1'),
      messages: [userMessage('m1', '!notify 任务')],
      turn: 1,
      step: 0,
      signal: new AbortController().signal,
    }, async () => ({ kind: 'reject' }))
    expect(decision).toEqual({ kind: 'reject' })
    await expect(service.getState(session('session-1'))).resolves.toEqual({ armed: false })
  })
})

describe('marker pure functions', () => {
  it('strips only a leading token followed by whitespace or EOL', () => {
    expect(stripMarker('!notify 帮我')).toBe('帮我')
    expect(stripMarker('!notify')).toBe('')
    expect(stripMarker('  !notify 帮我')).toBe('帮我')
    expect(stripMarker('帮我 !notify')).toBeUndefined()
    expect(stripMarker('!notifyX 帮我')).toBeUndefined()
    expect(stripMarker('!notify!')).toBeUndefined()
    expect(stripMarker('🔔 帮我')).toBe('帮我')
  })

  it('applyNotifyMarker keeps non-user messages and reports arming', () => {
    const user = userMessage('m1', '!notify 任务A')
    const injected = injectedMessage('m2', '!notify 任务B')
    const result = applyNotifyMarker([user, injected])
    expect(result.armed).toBe(true)
    expect(result.messages[0]?.content[0]).toMatchObject({ type: 'text', text: '任务A' })
    expect(result.messages[1]).toBe(injected)
  })
})

describe('sound resolution', () => {
  it('treats absolute paths verbatim', () => {
    expect(resolveSoundPath('/tmp/chime.wav')).toBe('/tmp/chime.wav')
    expect(resolveSoundPath('chime.wav')).toBe('chime.wav')
  })

  it('resolves named sounds on macOS', () => {
    if (process.platform !== 'darwin') return
    expect(resolveSoundPath('Glass')).toBe('/System/Library/Sounds/Glass.aiff')
    expect(resolveSoundPath('Sosumi')).toBe('/System/Library/Sounds/Sosumi.aiff')
  })

  it('exposes the ordered macOS sound names for listSounds', () => {
    expect(MACOS_SOUND_NAMES).toContain('Glass')
    expect(MACOS_SOUND_NAMES).toContain('Sosumi')
    expect(MACOS_SOUND_NAMES.length).toBeGreaterThanOrEqual(10)
  })
})

describe('SessionNotifyService settings wiring', () => {
  /** Smallest sleep that lets inject callbacks and settings watchers settle. */
  const tick = (ms = 20): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  it('keeps the entry config while no settings service is mounted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    try {
      const ctx = new Context()
      const service = new CountingService(ctx, { stateFile: join(dir, 'armed.json'), sound: 'Pop' })
      await tick()
      expect(service.currentSound()).toBe('Pop')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('adopts the settings section once a settings service is attached', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    try {
      const ctx = new Context()
      const holder: { provider?: FakeSettingsProvider } = {}
      // Cordis mounts the Service class; grab the instance from the context.
      await ctx.plugin(FakeSettingsProvider)
      holder.provider = ctx.settings as FakeSettingsProvider
      const service = new CountingService(ctx, { stateFile: join(dir, 'armed.json'), sound: 'Pop' })
      await tick()
      // Entry config is the composition base below the (absent) user section.
      expect(service.currentSound()).toBe('Pop')
      // Push a user section (as settings.yaml reload would) — hot swap, no restart.
      holder.provider.push({ 'session-notify': { sound: 'Sosumi', mode: 'sticky' } })
      await tick()
      expect(service.currentSound()).toBe('Sosumi')
      expect(service.currentMode()).toBe('sticky')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('setPrefs writes through the host settings service (LAN-safe path)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    try {
      const ctx = new Context()
      await ctx.plugin(FakeSettingsProvider)
      const service = new CountingService(ctx, { stateFile: join(dir, 'armed.json'), sound: 'Pop' })
      await tick()
      expect(service.currentSound()).toBe('Pop')
      const echoed = await service.setPrefs(session('session-1'), { sound: 'Sosumi', volume: 0.5 })
      await tick()
      expect(echoed.sound).toBe('Sosumi')
      expect(echoed.volume).toBe(0.5)
      expect(service.currentSound()).toBe('Sosumi')
      // The write landed in the registered settings namespace (resolved view).
      const resolved = ctx.settings.get('session-notify') as { sound: string; volume?: number }
      expect(resolved.sound).toBe('Sosumi')
      expect(resolved.volume).toBe(0.5)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('setPrefs falls back to in-memory application without a settings service', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    try {
      const ctx = new Context()
      const service = new CountingService(ctx, { stateFile: join(dir, 'armed.json'), sound: 'Pop' })
      await tick()
      const echoed = await service.setPrefs(session('session-1'), { sound: 'Sosumi', mode: 'sticky' })
      expect(echoed.sound).toBe('Sosumi')
      expect(service.currentSound()).toBe('Sosumi')
      expect(service.currentMode()).toBe('sticky')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('getPrefs returns the current playback prefs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    try {
      const ctx = new Context()
      const service = new CountingService(ctx, { stateFile: join(dir, 'armed.json'), sound: 'Pop', volume: 0.7 })
      await tick()
      const prefs = await service.getPrefs(session('session-1'), {})
      expect(prefs).toEqual({ sound: 'Pop', mode: 'one-shot', volume: 0.7 })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('falls back to the entry config when the settings section is cleared', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'session-notify-'))
    try {
      const ctx = new Context()
      await ctx.plugin(FakeSettingsProvider)
      const provider = ctx.settings as FakeSettingsProvider
      const service = new CountingService(ctx, { stateFile: join(dir, 'armed.json'), sound: 'Pop' })
      await tick()
      provider.push({ 'session-notify': { sound: 'Sosumi' } })
      await tick()
      expect(service.currentSound()).toBe('Sosumi')
      provider.push({})
      await tick()
      expect(service.currentSound()).toBe('Pop')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('SessionNotifyService listSounds', () => {
  let fixture: Awaited<ReturnType<typeof setup>>

  beforeEach(async () => {
    fixture = await setup()
  })
  afterEach(async () => {
    await rm(fixture.dir, { recursive: true, force: true })
  })

  it('lists the macOS system sounds on darwin and nothing elsewhere', async () => {
    const result = await fixture.service.listSounds(session('session-1'), {})
    if (process.platform === 'darwin') {
      expect(result.names).toContain('Glass')
      expect(result.names.length).toBe(MACOS_SOUND_NAMES.length)
    } else {
      expect(result.names).toEqual([])
    }
  })
})

describe('sound upload core', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'session-notify-upload-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  /** A one-shot async iterator over byte chunks (mirrors a request body). */
  async function* chunks(...parts: Buffer[]): AsyncGenerator<Buffer> {
    for (const part of parts) yield part
  }

  it('stores a supported audio upload and returns its absolute path', async () => {
    const path = await saveUpload(dir, 'my-chime.wav', chunks(Buffer.from('RIFF....')), 1024 * 1024)
    expect(path.startsWith(dir)).toBe(true)
    expect(path.endsWith('.wav')).toBe(true)
    await expect(readFile(path, 'utf8')).resolves.toBe('RIFF....')
  })

  it('rejects unsupported extensions', async () => {
    await expect(saveUpload(dir, 'evil.exe', chunks(Buffer.from('MZ')), 1024)).rejects.toThrow(/unsupported audio extension/)
    await expect(saveUpload(dir, 'noext', chunks(Buffer.from('x')), 1024)).rejects.toThrow(/unsupported audio extension/)
  })

  it('rejects uploads past the byte cap', async () => {
    await expect(saveUpload(dir, 'big.wav', chunks(Buffer.alloc(2048)), 1024)).rejects.toThrow(/exceeds 1024 bytes/)
  })

  it('rejects empty uploads', async () => {
    await expect(saveUpload(dir, 'empty.wav', chunks(), 1024)).rejects.toThrow(/empty upload/)
  })

  it('strips path components from the stored file name', async () => {
    const path = await saveUpload(dir, '../../evil.mp3', chunks(Buffer.from('ID3')), 1024)
    expect(path).toContain('evil.mp3')
    expect(path).not.toContain('..')
  })
})

describe('windows platform support', () => {
  it('lists Windows built-in sounds and defaults to the notify chime', () => {
    expect(soundsForPlatform('win32')).toContain('Windows Ding')
    expect(soundsForPlatform('win32')).toContain('Windows Notify System Generic')
    expect(defaultSoundName('win32')).toBe('Windows Notify System Generic')
    expect(defaultSoundName('darwin')).toBe('Glass')
  })

  it('resolves Windows names against C:\\Windows\\Media', () => {
    expect(resolveSoundPath('Windows Notify System Generic', 'win32')).toBe('C:\\Windows\\Media\\Windows Notify System Generic.wav')
    expect(resolveSoundPath('Glass', 'win32')).toBeUndefined()
    expect(resolveSoundPath('C:\\My Sounds\\ding.wav', 'win32')).toBe('C:\\My Sounds\\ding.wav')
  })

  it('narrows uploads to wav on Windows', () => {
    expect(audioExtensionsForPlatform('win32')).toEqual(new Set(['.wav']))
    expect(audioExtensionsForPlatform('darwin')).toContain('.mp3')
  })

  it('keeps the Windows vocabulary in the wire list', () => {
    expect(WINDOWS_SOUND_NAMES.length).toBeGreaterThanOrEqual(30)
  })
})

