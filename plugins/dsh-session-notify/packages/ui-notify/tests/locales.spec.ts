import { describe, expect, it } from 'vitest'
import { en, zh, NS } from '../src/client/locales.ts'

describe('ui-notify locales', () => {
  it('keeps the zh and en dictionaries in lockstep', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort())
  })

  it('covers the keys the bell renders', () => {
    for (const key of ['action.arm', 'action.disarm', 'action.preview', 'aria.armed', 'aria.unarmed', 'state.armedRunning']) {
      expect(zh).toHaveProperty(key)
      expect(en).toHaveProperty(key)
    }
  })

  it('declares the expected namespace', () => {
    expect(NS).toBe('dsh-notify')
  })
})
