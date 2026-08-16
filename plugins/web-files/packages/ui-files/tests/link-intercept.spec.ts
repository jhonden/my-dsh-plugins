import { describe, expect, it } from 'vitest'
import { resolveLinkPath } from '../src/client/link-intercept.ts'

describe('resolveLinkPath', () => {
  it('passes a relative path through', () => {
    expect(resolveLinkPath('src/a.ts', undefined)).toBe('src/a.ts')
  })

  it('relativizes a workspace-rooted absolute path against the cwd', () => {
    expect(resolveLinkPath('/Users/w/repo/src/a.ts', '/Users/w/repo')).toBe('src/a.ts')
    expect(resolveLinkPath('/Users/w/repo/src/a.ts', '/Users/w/repo/')).toBe('src/a.ts')
  })

  it('drops an absolute path outside the workspace', () => {
    expect(resolveLinkPath('/etc/passwd', '/Users/w/repo')).toBeUndefined()
  })

  it('drops an absolute path when no cwd is known', () => {
    expect(resolveLinkPath('/Users/w/repo/a.ts', undefined)).toBeUndefined()
  })

  it('normalizes windows separators', () => {
    expect(resolveLinkPath('C:\\w\\repo\\a.ts', 'C:/w/repo')).toBe('a.ts')
  })

  it('drops empty and multi-line text', () => {
    expect(resolveLinkPath('', undefined)).toBeUndefined()
    expect(resolveLinkPath('a\nb', undefined)).toBeUndefined()
  })
})
