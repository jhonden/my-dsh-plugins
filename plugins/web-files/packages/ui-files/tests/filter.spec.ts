import { describe, expect, it } from 'vitest'
import { activeQuery, filterLevel } from '../src/client/filter.ts'
import type { FilesDirEntry } from '@gaowen/dsh-files-remote/types'

const entries = (rows: Array<[string, 'file' | 'directory']>): FilesDirEntry[] =>
  rows.map(([name, kind]) => ({ name, kind }))

/** Loaded-tree fixture: root → src (a.ts, deep/ (b.md)), docs (readme.md), top.md. */
const LOADED: Readonly<Record<string, readonly FilesDirEntry[]>> = {
  '': entries([['src', 'directory'], ['docs', 'directory'], ['top.md', 'file']]),
  'src': entries([['a.ts', 'file'], ['deep', 'directory']]),
  'src/deep': entries([['b.md', 'file']]),
  'docs': entries([['readme.md', 'file']]),
}
const childrenOf = (dir: string): readonly FilesDirEntry[] | undefined => LOADED[dir]

describe('filterLevel (whole-loaded-subtree pruning)', () => {
  it('returns everything untouched on an empty query', () => {
    const out = filterLevel(LOADED[''] as FilesDirEntry[], '', '', childrenOf)
    expect(out.map(r => r.entry.name)).toEqual(['src', 'docs', 'top.md'])
    expect(out.every(r => r.match === undefined)).toBe(true)
  })

  it('keeps only live paths to matches', () => {
    const out = filterLevel(LOADED[''] as FilesDirEntry[], '', 'readme', childrenOf)
    // docs survives (its child matches); src and top.md are pruned.
    expect(out.map(r => r.entry.name)).toEqual(['docs'])
    expect(out[0]?.match).toBeUndefined()
  })

  it('keeps a directory whose own name matches even with no matching children', () => {
    const out = filterLevel(LOADED[''] as FilesDirEntry[], '', 'docs', childrenOf)
    expect(out.map(r => r.entry.name)).toEqual(['docs'])
  })

  it('keeps a grandparent chain to a deep match', () => {
    const out = filterLevel(LOADED[''] as FilesDirEntry[], '', 'b.md', childrenOf)
    expect(out.map(r => r.entry.name)).toEqual(['src'])
    const src = filterLevel(LOADED['src'] as FilesDirEntry[], 'src', 'b.md', childrenOf)
    expect(src.map(r => r.entry.name)).toEqual(['deep'])
    const deep = filterLevel(LOADED['src/deep'] as FilesDirEntry[], 'src/deep', 'b.md', childrenOf)
    expect(deep.map(r => r.entry.name)).toEqual(['b.md'])
    expect(deep[0]?.match).toEqual([0, 4])
  })

  it('matches case-insensitively with the exact range', () => {
    const out = filterLevel(LOADED['docs'] as FilesDirEntry[], 'docs', 'readme', childrenOf)
    expect(out[0]?.match).toEqual([0, 6])
  })

  it('treats an unloaded directory as childless (no descendants to save it)', () => {
    const sparse: Readonly<Record<string, readonly FilesDirEntry[]>> = { '': entries([['never-loaded', 'directory'], ['x.txt', 'file']]) }
    const out = filterLevel(sparse[''] as FilesDirEntry[], '', 'zzz', dir => sparse[dir])
    expect(out).toEqual([])
  })

  it('drops everything on no match', () => {
    expect(filterLevel(LOADED[''] as FilesDirEntry[], '', 'zzzz', childrenOf)).toEqual([])
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
