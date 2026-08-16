import { describe, expect, it } from 'vitest'
import { activeQuery, filterLevel } from '../src/client/filter.ts'
import type { FilesDirEntry } from '@gaowen/dsh-files-remote/types'

const entries = (rows: Array<[string, 'file' | 'directory']>): FilesDirEntry[] =>
  rows.map(([name, kind]) => ({ name, kind }))

describe('filterLevel', () => {
  it('returns everything untouched on an empty query', () => {
    const input = entries([['a.ts', 'file'], ['src', 'directory']])
    const out = filterLevel(input, '')
    expect(out.map(r => r.entry.name)).toEqual(['a.ts', 'src'])
    expect(out.every(r => r.match === undefined)).toBe(true)
  })

  it('keeps matching files with the match range', () => {
    const out = filterLevel(entries([['utils.ts', 'file'], ['other.md', 'file']]), 'util')
    expect(out.map(r => r.entry.name)).toEqual(['utils.ts'])
    expect(out[0]?.match).toEqual([0, 4])
  })

  it('matches case-insensitively', () => {
    const out = filterLevel(entries([['README.md', 'file']]), 'readme')
    expect(out).toHaveLength(1)
    expect(out[0]?.match).toEqual([0, 6])
  })

  it('marks a mid-name match range', () => {
    const out = filterLevel(entries([['my-utils.ts', 'file']]), 'util')
    expect(out[0]?.match).toEqual([3, 7])
  })

  it('always keeps directories during a filter (matches may live deeper)', () => {
    const out = filterLevel(entries([['src', 'directory'], ['a.ts', 'file']]), 'zzz')
    expect(out.map(r => r.entry.name)).toEqual(['src'])
    expect(out[0]?.match).toBeUndefined()
  })

  it('highlights a matching directory name too', () => {
    const out = filterLevel(entries([['srcdir', 'directory']]), 'src')
    expect(out[0]?.match).toEqual([0, 3])
  })

  it('drops non-matching files', () => {
    const out = filterLevel(entries([['a.ts', 'file'], ['b.ts', 'file']]), 'zzz')
    expect(out).toEqual([])
  })
})

describe('activeQuery', () => {
  it('trims and lowercases', () => {
    expect(activeQuery('  Util  ')).toBe('util')
  })

  it('treats whitespace-only as no filter', () => {
    expect(activeQuery('   ')).toBe('')
  })
})
