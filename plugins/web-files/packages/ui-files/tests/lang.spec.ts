import { describe, expect, it } from 'vitest'
import { langFromPath } from '../src/client/lang.ts'

describe('langFromPath', () => {
  it('maps common source extensions', () => {
    expect(langFromPath('src/index.ts')).toBe('ts')
    expect(langFromPath('app.tsx')).toBe('tsx')
    expect(langFromPath('main.py')).toBe('py')
    expect(langFromPath('lib.rs')).toBe('rs')
    expect(langFromPath('Dockerfile.go')).toBe('go')
  })

  it('folds alias extensions onto one language id', () => {
    expect(langFromPath('a.mts')).toBe('ts')
    expect(langFromPath('a.cts')).toBe('ts')
    expect(langFromPath('a.mjs')).toBe('js')
    expect(langFromPath('a.cjs')).toBe('js')
    expect(langFromPath('a.yml')).toBe('yaml')
    expect(langFromPath('a.markdown')).toBe('md')
    expect(langFromPath('a.htm')).toBe('html')
    expect(langFromPath('a.hpp')).toBe('cpp')
  })

  it('is case-insensitive on the extension only', () => {
    expect(langFromPath('a.TS')).toBe('ts')
    expect(langFromPath('a.Py')).toBe('py')
    expect(langFromPath('README.MD')).toBe('md')
  })

  it('takes the basename across both separators', () => {
    expect(langFromPath('dir/sub/file.ts')).toBe('ts')
    expect(langFromPath('dir\\sub\\file.ts')).toBe('ts')
    expect(langFromPath('a.b/c')).toBeUndefined()
  })

  it('returns undefined for dotfiles without an extension', () => {
    expect(langFromPath('.gitignore')).toBeUndefined()
    expect(langFromPath('config/.npmrc')).toBeUndefined()
  })

  it('returns undefined for unknown extensions and prototype keys', () => {
    expect(langFromPath('package.lock')).toBeUndefined()
    expect(langFromPath('data.bin')).toBeUndefined()
    expect(langFromPath('foo.constructor')).toBeUndefined()
    expect(langFromPath('foo.__proto__')).toBeUndefined()
  })

  it('returns undefined for extensionless filenames', () => {
    expect(langFromPath('Makefile')).toBeUndefined()
    expect(langFromPath('LICENSE')).toBeUndefined()
  })
})
