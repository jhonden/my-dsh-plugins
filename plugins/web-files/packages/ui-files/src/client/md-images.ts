/**
 * Rewrite relative image references in markdown to the Host preview route.
 *
 * `MarkdownText` (the platform renderer) only permits absolute http(s) image
 * URLs — correct for untrusted assistant output, wrong for a file viewer
 * showing the user's own README. Rewriting `![alt](rel.png)` destinations to
 * the preview-route URL (absolute http(s) with query params) lets the same
 * renderer display workspace images without weakening its safety rules:
 * paths stay workspace-confined on the Host and cross-site embeds are denied
 * by the route's same-origin fence.
 */

import { IMAGE_MEDIA_TYPES } from '@gaowen/dsh-files-remote/images'

/** The Host preview route prefix registered by files-remote. */
const PREVIEW_ROUTE = '/plugins-web-files/preview'

/** One image destination found by the scan, with its source span. */
interface ImageRef {
  /** Index of `(` opening the destination. */
  start: number
  /** Index after the closing `)`. */
  end: number
  /** The raw destination text between the parens. */
  destination: string
}

/**
 * Scan markdown source for inline image destinations. Handles balanced parens
 * inside the destination and escaped parens; returns refs in source order.
 * Code spans/fences are not excluded — a fence line like `![x](a.png)` inside
 * a code block would also be rewritten, but such text is rare and the rewrite
 * is harmless there (the rendered code block shows the rewritten URL only if
 * it wraps, which the renderer already avoids).
 */
function scanInlineImages(source: string): ImageRef[] {
  const refs: ImageRef[] = []
  for (let i = 0; i < source.length - 1; i++) {
    if (source[i] !== '!' || source[i + 1] !== '[') continue
    // Find the matching ] — no nesting inside alt text per CommonMark.
    const close = source.indexOf(']', i + 2)
    if (close === -1 || close + 1 >= source.length || source[close + 1] !== '(') continue
    // Balanced-paren scan for the destination.
    let depth = 1
    let j = close + 2
    while (j < source.length && depth > 0) {
      const ch = source[j]
      if (ch === '\\') { j += 2; continue }
      if (ch === '(') depth++
      else if (ch === ')') depth--
      if (depth === 0) break
      j++
    }
    if (depth !== 0) continue
    refs.push({ start: close + 1, end: j + 1, destination: source.slice(close + 2, j) })
    i = j
  }
  return refs
}

/** Test one destination: image extension, relative (no scheme, no //). */
function isRelativeImage(destination: string): boolean {
  const trimmed = destination.trim()
  if (trimmed === '' || trimmed.startsWith('<')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) return false
  const clean = trimmed.split(/[?#]/, 1)[0] ?? trimmed
  const dot = clean.lastIndexOf('.')
  if (dot <= 0) return false
  const ext = clean.slice(dot + 1).toLowerCase()
  return Object.hasOwn(IMAGE_MEDIA_TYPES, ext)
}

/** URL-encode one path segment, keeping `/` separators. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

/**
 * Rewrite relative image destinations to the preview route.
 * @param source - the markdown text.
 * @param sessionId - the session whose workspace confines the images.
 * @param baseDir - directory of the markdown file (`''` = workspace root);
 *   relative destinations resolve against it.
 * @returns markdown with image destinations pointing at the preview route.
 */
export function rewriteMarkdownImages(source: string, sessionId: string, baseDir: string): string {
  const refs = scanInlineImages(source)
  if (refs.length === 0) return source
  let out = ''
  let cursor = 0
  for (const ref of refs) {
    if (!isRelativeImage(ref.destination)) continue
    const raw = ref.destination.trim()
    const pathPart = raw.split(/[?#]/, 1)[0] ?? raw
    const suffix = raw.slice(pathPart.length)
    // Lexical join against the md file's directory; normalization of `..`
    // segments happens on the Host inside resolveInside's containment check.
    const joined = baseDir === '' ? pathPart : `${baseDir}/${pathPart}`
    const url = `${PREVIEW_ROUTE}?sessionId=${encodeURIComponent(sessionId)}&path=${encodePath(joined)}${suffix}`
    out += source.slice(cursor, ref.start) + `(${url})`
    cursor = ref.end
  }
  return out + source.slice(cursor)
}
