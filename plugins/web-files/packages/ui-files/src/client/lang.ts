/**
 * File-extension → language-id mapping for the viewer's syntax highlighting.
 * Vendored from dsh-tool-fs's read-render.ts (upstream ships no `src/` in the
 * npm tarball, so the map cannot be imported from the published package); the
 * short-form ids align with ui-primitives' `LANG_ALIASES`, which resolves them
 * to shiki grammars. Keep in sync with upstream when it grows.
 */

const LANG_BY_EXTENSION: Readonly<Record<string, string>> = {
  ts: 'ts', tsx: 'tsx', mts: 'ts', cts: 'ts',
  js: 'js', jsx: 'jsx', mjs: 'js', cjs: 'js',
  json: 'json', jsonc: 'json',
  py: 'py', rb: 'rb', go: 'go', rs: 'rs', java: 'java',
  c: 'c', h: 'c', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', cxx: 'cpp',
  cs: 'cs', kt: 'kotlin', swift: 'swift', php: 'php',
  sh: 'sh', bash: 'sh', zsh: 'sh',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini',
  md: 'md', markdown: 'md', mdx: 'mdx',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  sql: 'sql', xml: 'xml', lua: 'lua',
}

/**
 * Derive a highlighting language hint from a file path's extension.
 * Pure, case-insensitive on the extension; a dotfile (`.gitignore`) and an
 * unknown extension both yield `undefined`.
 * @param path - session-workspace-relative file path.
 * @returns the short-form language id, or `undefined` when none maps.
 */
export function langFromPath(path: string): string | undefined {
  const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = base.lastIndexOf('.')
  // A leading dot is a dotfile (no extension), not an empty extension.
  if (dot <= 0) return undefined
  const ext = base.slice(dot + 1).toLowerCase()
  // Own-property check: a filename whose extension is an Object.prototype key
  // (`foo.constructor`) must map to no language, not to the inherited member.
  return Object.hasOwn(LANG_BY_EXTENSION, ext) ? LANG_BY_EXTENSION[ext] : undefined
}
