/**
 * Notification sound playback on the dsh host process. Fire-and-forget
 * spawning, at most one in-flight playback (a new trigger replaces the
 * current one so the last completion wins), and failures degrade to a logged
 * warning — a notification must never disturb the agent run.
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

/** Named macOS system sounds, resolved to their bundled AIFF paths. */
const MACOS_SOUNDS: Record<string, string> = {
  Basso: '/System/Library/Sounds/Basso.aiff',
  Blow: '/System/Library/Sounds/Blow.aiff',
  Bottle: '/System/Library/Sounds/Bottle.aiff',
  Frog: '/System/Library/Sounds/Frog.aiff',
  Funk: '/System/Library/Sounds/Funk.aiff',
  Glass: '/System/Library/Sounds/Glass.aiff',
  Hero: '/System/Library/Sounds/Hero.aiff',
  Morse: '/System/Library/Sounds/Morse.aiff',
  Ping: '/System/Library/Sounds/Ping.aiff',
  Pop: '/System/Library/Sounds/Pop.aiff',
  Purr: '/System/Library/Sounds/Purr.aiff',
  Sosumi: '/System/Library/Sounds/Sosumi.aiff',
  Submarine: '/System/Library/Sounds/Submarine.aiff',
  Tink: '/System/Library/Sounds/Tink.aiff',
}

/** Values accepted as an explicit path rather than a named macOS sound. */
function looksLikePath(value: string): boolean {
  return value.startsWith('/') || value.includes('\\') || /\.(aiff|aif|wav|mp3|m4a|ogg)$/i.test(value)
}

/**
 * Resolve the configured `sound` value to a playable file path. On macOS a
 * bare name resolves against the system sounds directory; elsewhere a bare
 * name is unresolvable (the operator must configure a path) and yields
 * `undefined` so playback reports failure instead of guessing.
 */
export function resolveSoundPath(sound: string): string | undefined {
  if (sound === '') return undefined
  if (looksLikePath(sound)) return sound
  if (process.platform === 'darwin') {
    return MACOS_SOUNDS[sound] ?? `/System/Library/Sounds/${sound}.aiff`
  }
  return undefined
}

/** One platform command template for a resolved sound path. */
interface Command {
  bin: string
  args: string[]
}

/** Build the playback command for the current platform, or `undefined` when no player exists. */
export function commandFor(path: string, volume?: number): Command | undefined {
  if (process.platform === 'darwin') {
    const args = volume === undefined ? [path] : ['-v', String(volume), path]
    return { bin: 'afplay', args }
  }
  if (process.platform === 'linux') {
    // PulseAudio first, ALSA fallback — the error path retries below.
    return { bin: 'paplay', args: [path] }
  }
  if (process.platform === 'win32') {
    const escaped = path.replaceAll("'", "''")
    return { bin: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', `(New-Object Media.SoundPlayer '${escaped}').PlaySync();`] }
  }
  return undefined
}

/**
 * Fire-and-forget sound player. `play` returns whether a playback was
 * launched; failures are logged once per player instance and never thrown.
 */
export class SoundPlayer {
  private current: ChildProcess | null = null
  private warned = false

  /** Play one sound, replacing any in-flight playback. */
  play(sound: string, volume?: number): boolean {
    const path = resolveSoundPath(sound)
    if (path === undefined) {
      this.warnOnce(`sound "${sound}" is not playable on ${process.platform} — configure an absolute file path`)
      return false
    }
    const command = commandFor(path, volume)
    if (command === undefined) {
      this.warnOnce(`no sound player available on ${process.platform}`)
      return false
    }
    return this.launch(command, path)
  }

  /** Spawn one command with the single-flight slot; Linux retries ALSA on PulseAudio absence. */
  private launch(command: Command, path: string): boolean {
    try {
      this.current?.kill()
    } catch {
      // already dead — ignore
    }
    const child = spawn(command.bin, command.args, { stdio: 'ignore' })
    this.current = child
    const onError = (error: Error): void => {
      if (this.current !== child) return
      this.current = null
      if (process.platform === 'linux' && command.bin === 'paplay') {
        // PulseAudio missing — retry once through ALSA's aplay.
        const fallback = spawn('aplay', [path], { stdio: 'ignore' })
        this.current = fallback
        fallback.on('error', (fallbackError) => {
          this.warnOnce(`sound playback failed: ${fallbackError.message}`)
          this.current = null
        })
        fallback.on('exit', () => {
          if (this.current === fallback) this.current = null
        })
        return
      }
      this.warnOnce(`sound playback failed: ${error.message}`)
    }
    child.on('error', onError)
    child.on('exit', () => {
      if (this.current === child) this.current = null
    })
    return true
  }

  private warnOnce(message: string): void {
    if (this.warned) return
    this.warned = true
    console.warn(`[session-notify] ${message}`)
  }
}
