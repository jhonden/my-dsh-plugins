import { describe, expect, it, vi } from 'vitest'
import { rewriteMarkdownImages } from '../src/client/md-images.ts'

// The rewriter needs an absolute origin (the platform renderer rejects
// scheme-relative image URLs); node has no location, so stub one.
vi.stubGlobal('location', { origin: 'http://127.0.0.1:3080' })

describe('rewriteMarkdownImages', () => {
  it('rewrites a simple relative image', () => {
    expect(rewriteMarkdownImages('![logo](logo.png)', 's1', ''))
      .toBe('![logo](http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=logo.png)')
  })

  it('joins the markdown file directory', () => {
    expect(rewriteMarkdownImages('![x](img/a.jpg)', 's1', 'docs'))
      .toBe('![x](http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=docs/img/a.jpg)')
  })

  it('preserves a query suffix on the destination', () => {
    expect(rewriteMarkdownImages('![x](a.png?w=2)', 's1', ''))
      .toBe('![x](http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=a.png?w=2)')
  })

  it('encodes special characters in path and sessionId', () => {
    expect(rewriteMarkdownImages('![x](a b&c.png)', 's 1', ''))
      .toBe('![x](http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s%201&path=a%20b%26c.png)')
  })

  it('leaves absolute http and protocol URLs untouched', () => {
    const src = '![a](https://x.test/a.png) ![b](http://y.test/b.jpg) ![c](data:image/png;base64,xx)'
    expect(rewriteMarkdownImages(src, 's1', '')).toBe(src)
  })

  it('leaves non-image and extensionless destinations untouched', () => {
    const src = '![a](doc.md) ![b](archive.zip) ![c](noext) ![d]()'
    expect(rewriteMarkdownImages(src, 's1', '')).toBe(src)
  })

  it('handles balanced and escaped parens in the destination', () => {
    expect(rewriteMarkdownImages('![x](a(1).png)', 's1', ''))
      .toBe('![x](http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=a(1).png)')
    expect(rewriteMarkdownImages('![x](a\\)b.png)', 's1', ''))
      .toBe('![x](http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=a%5C)b.png)')
  })

  it('leaves links (no bang) and plain text untouched', () => {
    const src = '[a](a.png) plain (paren) text'
    expect(rewriteMarkdownImages(src, 's1', '')).toBe(src)
  })

  it('handles multiple images and mixed content', () => {
    const out = rewriteMarkdownImages('# t\n\n![a](a.png) text ![b](./b.png)', 's1', 'd')
    expect(out).toContain('http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=d/a.png')
    expect(out).toContain('http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=d/./b.png')
    expect(out).toContain('# t')
    expect(out).toContain(' text ')
  })

  it('returns the source unchanged with no images', () => {
    const src = 'no images here'
    expect(rewriteMarkdownImages(src, 's1', 'd')).toBe(src)
  })

  it('leaves image syntax inside inline code spans untouched', () => {
    const src = 'example \`![](img.png)\` stays literal'
    expect(rewriteMarkdownImages(src, 's1', '')).toBe(src)
  })

  it('leaves image syntax inside fenced code blocks untouched', () => {
    const src = '```md\n![x](a.png)\n``` and ![y](b.png) after'
    const out = rewriteMarkdownImages(src, 's1', '')
    expect(out).toContain('![x](a.png)')
    expect(out).toContain('http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=b.png')
  })

  it('still rewrites after a code span closes', () => {
    const out = rewriteMarkdownImages('\`code\` then ![a](a.png)', 's1', '')
    expect(out).toContain('http://127.0.0.1:3080/plugins-web-files/preview?sessionId=s1&path=a.png')
    expect(out).toContain('`code`')
  })

  it('skips an unclosed image construct', () => {
    const src = '![x](a.png'
    expect(rewriteMarkdownImages(src, 's1', '')).toBe(src)
  })
})
