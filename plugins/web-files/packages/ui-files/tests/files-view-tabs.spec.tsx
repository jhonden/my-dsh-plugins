import { it, expect, vi } from 'vitest'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'

// Platform components pull katex CSS; stub the whole primitives module.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const R = await import('react')
  return {
    MarkdownText: ({ text }: { text: string }) => R.createElement('div', null, text),
    ReadBlock: ({ lines }: { lines: Array<{ number: number; text: string }> }) =>
      R.createElement('pre', null, lines.map(l => l.text).join('\n')),
  }
})
import { FilesView } from '../src/client/FilesView.tsx'

vi.stubGlobal('location', { origin: 'http://127.0.0.1:3080' })

it('opening an image file lands in the image state', async () => {
  const calls: string[] = []
  const face = {
    t: (k: string) => k,
    currentSessionId: () => 'sess-1',
    call: {
      list: async () => ({ ok: true, value: { path: '', entries: [{ name: 'a.png', kind: 'file' as const }, { name: 'b.md', kind: 'file' as const }], truncated: false } }),
      read: async () => ({ ok: true, value: { path: 'a.png', content: '', bytes: 0, truncated: false } }),
      search: async () => ({ ok: true, value: { paths: [], truncated: false } }),
    },
  }
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => { root.render(<FilesView {...face} />) })
  await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  // 点击 a.png 行
  const btn = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('a.png'))
  expect(btn).toBeTruthy()
  await act(async () => { btn?.click(); await new Promise(r => setTimeout(r, 10)) })
  const img = container.querySelector('img')
  expect(img).toBeTruthy()
  expect(img?.getAttribute('src')).toContain('/plugins-web-files/preview?sessionId=sess-1')
  // Open the text file too — its tab arrives beside the image tab.
  const btnB = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('b.md'))
  await act(async () => { btnB?.click(); await new Promise(r => setTimeout(r, 10)) })
  // Two tabs: the tab strip renders both names.
  expect([...container.querySelectorAll('[role=tab]')].map(el => el.getAttribute('title'))).toEqual(['a.png', 'b.md'])
  root.unmount()
})
