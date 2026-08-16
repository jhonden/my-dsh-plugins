import { describe, expect, it } from 'vitest'
import { compressDir, splitPath } from '../src/client/path-row.ts'

describe('splitPath', () => {
  it('splits a nested path with a trailing separator on dir', () => {
    expect(splitPath('a/b/c.ts')).toEqual({ dir: 'a/b/', name: 'c.ts' })
  })

  it('a root file has no dir', () => {
    expect(splitPath('README.md')).toEqual({ dir: '', name: 'README.md' })
  })
})

describe('compressDir', () => {
  it('returns short dirs untouched', () => {
    expect(compressDir('docs/', 30)).toBe('docs/')
  })

  it('compresses a long dir to a tail with a leading ellipsis', () => {
    const out = compressDir('plugins/web-files/docs/screenshots/', 16)
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('screenshots/')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(16)
  })

  it('keeps whole segments only', () => {
    const out = compressDir('very-long-directory/another-long-one/deep/', 14)
    expect(out).toMatch(/^…[^/]*\/$/)
    expect(out.length).toBeLessThanOrEqual(14)
  })

  it('degrades to the bare ellipsis when nothing fits', () => {
    expect(compressDir('extremely-long-segment-name/', 4)).toBe('…/')
  })

  it('never returns longer than the cap', () => {
    for (const cap of [4, 8, 16, 40]) {
      expect(compressDir('a/bb/ccc/dddd/eeeee/fffff/ggggg/', cap).length).toBeLessThanOrEqual(cap)
    }
  })
})
