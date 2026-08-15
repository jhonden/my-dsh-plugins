import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { FilesRemoteService } from '../src/index.ts'

/**
 * Behavioral tests through a real Cordis Context: a minimal fake FileSystem
 * occupies the `fs` service seat and the real FilesRemoteService registers
 * beside it, so every call exercises the service's actual Cordis lifecycle.
 * The fake pins exactly the operations the service uses, so these tests
 * cover the service's own decision logic (containment, bounds, ordering,
 * error identities) without depending on dsh-fs-local.
 */

interface FakeTarget { path: string }

/** Lexical normalization like node:path.resolve: collapses `.`/`..` segments. */
function normalize(input: string): string {
  const out: string[] = []
  for (const segment of input.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') { out.pop(); continue }
    out.push(segment)
  }
  return '/' + out.join('/')
}

/** Local fake implementing the FileSystem surface the service consumes. */
class FakeFileSystem extends Service {
  static inject: readonly string[] = []

  /** Scripted per-test behaviors, overridden field by field. */
  resolveImpl: (path: string, opts?: { cwd?: string }) => Promise<FakeTarget>
  statImpl: (target: FakeTarget) => Promise<{ version: string; type: 'file' | 'directory'; size?: number } | undefined>
  listDirImpl: (target: FakeTarget) => Promise<Array<{ name: string; type: 'file' | 'directory' | 'other' }>>
  readTextImpl: (target: FakeTarget) => Promise<string>

  constructor(ctx: Context, config: { root?: string } = {}) {
    super(ctx, 'fs')
    const root = config.root ?? '/w'
    this.resolveImpl = async (path, opts) => {
      if (path.startsWith('/')) return { path: normalize(path) }
      const base = opts?.cwd ?? root
      return { path: path === '' ? base : normalize(`${base}/${path}`) }
    }
    this.statImpl = async () => ({ version: 'v', type: 'directory' })
    this.listDirImpl = async () => []
    this.readTextImpl = async () => ''
  }

  async resolve(path: string, opts?: { cwd?: string }): Promise<FakeTarget> { return this.resolveImpl(path, opts) }
  async stat(target: FakeTarget) { return this.statImpl(target) }
  async listDir(target: FakeTarget) { return this.listDirImpl(target) }
  async readText(target: FakeTarget) { return this.readTextImpl(target) }
  processPath(target: FakeTarget): string { return target.path }
  fileUrl(target: FakeTarget): string { return 'file://' + target.path }
  contains(parent: FakeTarget, child: FakeTarget): boolean {
    if (parent.path === child.path) return true
    return child.path.startsWith(parent.path + '/')
  }
}

function makeSession(cwd: string | undefined): never {
  return { header: { cwd } } as never
}

async function setup(config?: ConstructorParameters<typeof FilesRemoteService>[1]): Promise<{
  ctx: Context
  files: FilesRemoteService
  fake: FakeFileSystem
}> {
  const ctx = new Context()
  await ctx.plugin(FakeFileSystem)
  const fake = ctx.get('fs') as unknown as FakeFileSystem
  await ctx.plugin(FilesRemoteService, config)
  const files = ctx.get('filesRemote') as unknown as FilesRemoteService
  return { ctx, files, fake }
}

describe('FilesRemoteService.list', () => {
  it('rejects a session without a cwd', async () => {
    const { files } = await setup()
    await expect(files.list(makeSession(undefined), { path: '' })).rejects.toMatchObject({
      code: 'FILES_SESSION_WITHOUT_CWD',
    })
  })

  it('rejects an absolute path escaping the workspace', async () => {
    const { files } = await setup()
    await expect(files.list(makeSession('/w'), { path: '/etc' })).rejects.toMatchObject({
      code: 'FILES_PATH_OUTSIDE_WORKSPACE',
    })
  })

  it('rejects a traversal escape (..)', async () => {
    const { files } = await setup()
    await expect(files.list(makeSession('/w'), { path: '../outside' })).rejects.toMatchObject({
      code: 'FILES_PATH_OUTSIDE_WORKSPACE',
    })
  })

  it('rejects a symlink escape through canonical resolve', async () => {
    const { files, fake } = await setup()
    // Canonicalization models a symlink: w/link -> /elsewhere.
    fake.resolveImpl = async (path, opts) => {
      if (path === 'link') return { path: '/elsewhere' }
      return { path: `${opts?.cwd ?? '/w'}/${path}` }
    }
    await expect(files.list(makeSession('/w'), { path: 'link' })).rejects.toMatchObject({
      code: 'FILES_PATH_OUTSIDE_WORKSPACE',
    })
  })

  it('rejects a missing directory', async () => {
    const { files, fake } = await setup()
    fake.statImpl = async () => undefined
    await expect(files.list(makeSession('/w'), { path: 'nope' })).rejects.toMatchObject({
      code: 'FILES_NOT_FOUND',
    })
  })

  it('rejects a non-directory', async () => {
    const { files, fake } = await setup()
    fake.statImpl = async () => ({ version: 'v', type: 'file' })
    await expect(files.list(makeSession('/w'), { path: 'afile' })).rejects.toMatchObject({
      code: 'FILES_NOT_A_DIRECTORY',
    })
  })

  it('orders directories first then name, drops other, sets truncated at the cap', async () => {
    const { files, fake } = await setup({ maxEntries: 3 })
    fake.listDirImpl = async () => [
      { name: 'z.txt', type: 'file' },
      { name: 'b', type: 'directory' },
      { name: 'sock', type: 'other' },
      { name: 'a', type: 'directory' },
      { name: 'm.txt', type: 'file' },
    ]
    const result = await files.list(makeSession('/w'), { path: '' })
    expect(result.entries.map(e => e.name)).toEqual(['a', 'b', 'z.txt'])
    expect(result.truncated).toBe(true)
  })

  it('reports untruncated under the cap', async () => {
    const { files, fake } = await setup()
    fake.listDirImpl = async () => [{ name: 'a', type: 'file' }]
    const result = await files.list(makeSession('/w'), { path: '' })
    expect(result).toEqual({ path: '', entries: [{ name: 'a', kind: 'file' }], truncated: false })
  })
})

describe('FilesRemoteService.read', () => {
  it('rejects a traversal escape', async () => {
    const { files } = await setup()
    await expect(files.read(makeSession('/w'), { path: '../../etc/passwd' })).rejects.toMatchObject({
      code: 'FILES_PATH_OUTSIDE_WORKSPACE',
    })
  })

  it('rejects a missing file', async () => {
    const { files, fake } = await setup()
    fake.statImpl = async () => undefined
    await expect(files.read(makeSession('/w'), { path: 'gone' })).rejects.toMatchObject({
      code: 'FILES_NOT_FOUND',
    })
  })

  it('rejects a directory', async () => {
    const { files, fake } = await setup()
    fake.statImpl = async () => ({ version: 'v', type: 'directory' })
    await expect(files.read(makeSession('/w'), { path: 'dir' })).rejects.toMatchObject({
      code: 'FILES_NOT_A_REGULAR_FILE',
    })
  })

  it('returns content and reports truncation at the char cap', async () => {
    const { files, fake } = await setup({ maxReadChars: 3 })
    fake.statImpl = async () => ({ version: 'v', type: 'file', size: 10 })
    fake.readTextImpl = async () => 'abcdef'
    const result = await files.read(makeSession('/w'), { path: 'f' })
    expect(result).toEqual({ path: 'f', bytes: 10, truncated: true, content: 'abc' })
  })

  it('returns full content under the cap', async () => {
    const { files, fake } = await setup()
    fake.statImpl = async () => ({ version: 'v', type: 'file' })
    fake.readTextImpl = async () => 'ok'
    const result = await files.read(makeSession('/w'), { path: 'f' })
    expect(result).toEqual({ path: 'f', bytes: null, truncated: false, content: 'ok' })
  })
})

describe('configuration and lifecycle', () => {
  it('rejects non-positive or non-integer bounds', async () => {
    const ctx = new Context()
    await ctx.plugin(FakeFileSystem)
    await expect(ctx.plugin(FilesRemoteService, { maxEntries: 0 })).rejects.toThrow()
    await expect(ctx.plugin(FilesRemoteService, { maxReadChars: 1.5 })).rejects.toThrow()
  })

  it('disposes with its fiber (HMR-safety)', async () => {
    const ctx = new Context()
    await ctx.plugin(FakeFileSystem)
    const fiber = await ctx.plugin(FilesRemoteService)
    expect(ctx.get('filesRemote')).toBeDefined()
    await fiber.dispose()
    expect(ctx.get('filesRemote')).toBeUndefined()
  })

})
