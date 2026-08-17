/**
 * Sound-file upload core: reads one audio upload from a request stream,
 * validates extension and size, and stores it under the plugin's sounds
 * directory. Pure enough to unit-test without HTTP plumbing; the webserver
 * route in index.ts is a thin wrapper.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/** Audio extensions the notification player can handle. */
export const AUDIO_EXTENSIONS: ReadonlySet<string> = new Set(['.aiff', '.aif', '.wav', '.mp3', '.m4a', '.ogg'])

/** Default maximum accepted upload size (5 MiB — notification sounds are short). */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** The upload is too large to accept. */
export class UploadTooLargeError extends Error {}

/** The upload is not a supported audio file. */
export class UploadRejectedError extends Error {}

/** Reduce a client filename to a safe single path component. */
export function sanitizeUploadName(name: string): string {
  const base = basename(name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
  return base === '' ? 'sound' : base
}

/**
 * Drain one request stream into a stored audio file, validating the declared
 * extension and a byte cap. Returns the absolute stored path.
 * @param dir - the sounds directory (created on demand).
 * @param name - the client-declared file name (extension checked, path stripped).
 * @param chunks - the request body as a byte stream.
 * @param maxBytes - inclusive size cap.
 * @returns the absolute path of the stored file.
 * @throws {@link UploadRejectedError} for extension/empty rejections,
 *   {@link UploadTooLargeError} past the cap.
 */
export async function saveUpload(
  dir: string,
  name: string,
  chunks: AsyncIterable<Buffer>,
  maxBytes: number,
): Promise<string> {
  const ext = extname(name).toLowerCase()
  if (!AUDIO_EXTENSIONS.has(ext)) {
    throw new UploadRejectedError(`unsupported audio extension: ${ext || '(none)'}`)
  }
  let size = 0
  const parts: Buffer[] = []
  for await (const chunk of chunks) {
    size += chunk.length
    if (size > maxBytes) throw new UploadTooLargeError(`upload exceeds ${maxBytes} bytes`)
    parts.push(chunk)
  }
  if (size === 0) throw new UploadRejectedError('empty upload')
  await mkdir(dir, { recursive: true })
  const target = join(dir, `${Date.now()}-${sanitizeUploadName(name)}`)
  await writeFile(target, Buffer.concat(parts), { mode: 0o600 })
  return target
}
