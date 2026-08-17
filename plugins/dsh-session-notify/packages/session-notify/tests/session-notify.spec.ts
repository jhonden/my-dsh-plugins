import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-session'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { Session, SessionId, UserMessage } from '@deepseek-ai/dsh-session'
import { SessionNotifyService } from '../src/index.ts'
import { applyNotifyMarker, stripMarker } from '../src/marker.ts'
import { resolveSoundPath } from '../src/sound.ts'

/** Real service with a counted playback seam — no audio is ever spawned. */
class CountingService extends SessionNotifyService {
  plays = 0

  protected playSound(): boolean {
    this.plays += 1
    return true
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
})
