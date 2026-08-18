/**
 * Notification sound playback on the dsh host process. Fire-and-forget
 * spawning, at most one in-flight playback (a new trigger replaces the
 * current one so the last completion wins), and failures degrade to a logged
 * warning — a notification must never disturb the agent run.
 *
 * Platform support:
 *  - darwin: `afplay` + named `/System/Library/Sounds/*.aiff` (volume-aware).
 *  - win32:  PowerShell `Media.SoundPlayer` + named `C:\\Windows\\Media\\*.wav`
 *    (WAV only — the player accepts no other format).
 *  - linux:  `paplay` (ALSA `aplay` fallback) + operator-configured paths.
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

/** Ordered names of the built-in macOS sounds (the listSounds wire vocabulary). */
export const MACOS_SOUND_NAMES: readonly string[] = Object.keys(MACOS_SOUNDS)

/** Common Windows built-in sounds under `C:\\Windows\\Media\\` (wav). */
const WINDOWS_SOUNDS: readonly string[] = [
  'Windows Notify System Generic',
  'Windows Notify Calendar',
  'Windows Notify Email',
  'Windows Notify Messaging',
  'Windows Notify People',
  'Windows Ding',
  'Windows Chord',
  'Windows Critical Stop',
  'Windows Default',
  'Windows Device Connect',
  'Windows Device Disconnect',
  'Windows Error',
  'Windows Exclamation',
  'Windows Hardware Fail',
  'Windows Hardware Insert',
  'Windows Hardware Remove',
  'Windows Information Bar',
  'Windows Logoff Sound',
  'Windows Logon Sound',
  'Windows Menu Command',
  'Windows Navigation Start',
  'Windows Pop-up Blocked',
  'Windows Print complete',
  'Windows Proximity Connection',
  'Windows Recovery',
  'Windows Ringout',
  'Windows Ringtone',
  'Windows Shutdown',
  'Windows Startup',
  'Windows Unlock',
  'Windows User Account Control',
  'Windows Working',
  'chimes',
  'chord',
  'ding',
  'notify',
  'tada',
]

/** Ordered names of the Windows built-in sounds (the listSounds wire vocabulary). */
export const WINDOWS_SOUND_NAMES: readonly string[] = WINDOWS_SOUNDS

/** The media directory Windows built-in sounds live in. */
const WINDOWS_MEDIA_DIR = 'C:\\Windows\\Media'

/**
 * The platform's default sound name. The plugin config's `Glass` default is a
 * "platform default" alias — it resolves to this on non-darwin platforms, so
 * a fresh install just works on Windows too.
 */
export function defaultSoundName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'Windows Notify System Generic' : 'Glass'
}

/** Values accepted as an explicit path rather than a named system sound. */
function looksLikePath(value: string): boolean {
  return value.startsWith('/') || value.includes('\\') || /\.(aiff|aif|wav|mp3|m4a|ogg)$/i.test(value)
}

/**
 * Resolve the configured `sound` value to a playable file path. A bare name
 * resolves against the platform's system sounds directory (macOS AIFFs,
 * Windows Media wavs); elsewhere a bare name is unresolvable (the operator
 * must configure a path) and yields `undefined` so playback reports failure
 * instead of guessing.
 */
export function resolveSoundPath(sound: string, platform: NodeJS.Platform = process.platform): string | undefined {
  if (sound === '') return undefined
  if (looksLikePath(sound)) return sound
  if (platform === 'darwin') {
    return MACOS_SOUNDS[sound] ?? `/System/Library/Sounds/${sound}.aiff`
  }
  if (platform === 'win32') {
    return WINDOWS_SOUNDS.includes(sound) ? `${WINDOWS_MEDIA_DIR}\\${sound}.wav` : undefined
  }
  return undefined
}

/** The named sounds the host can offer for one platform (the listSounds wire vocabulary). */
export function soundsForPlatform(platform: NodeJS.Platform = process.platform): string[] {
  if (platform === 'darwin') return [...MACOS_SOUND_NAMES]
  if (platform === 'win32') return [...WINDOWS_SOUND_NAMES]
  return []
}

/** One platform command template for a resolved sound path. */
interface Command {
  bin: string
  args: string[]
}

/**
 * Windows playback scripts. Two conservative, OS-built-in players split by
 * format — no P/Invoke or third-party tools, so nothing silently fails:
 *  - wav: `Media.SoundPlayer` (`PlaySync`), the verified-basic path.
 *  - mp3: Windows Media Player COM (`WMPlayer.OCX`), the standard mp3 player
 *    every Windows 10/11 ships; we poll `playState` until the media ends
 *    (with a 60s safety cap) so the child exits when playback finishes.
 */
export function windowsWavScript(path: string): string {
  const escaped = path.replaceAll("'", "''")
  return `(New-Object Media.SoundPlayer '${escaped}').PlaySync();`
}

export function windowsMp3Script(path: string): string {
  const escaped = path.replaceAll("'", "''")
  const quoted = `'${escaped}'`
  return [
    `$p = New-Object -ComObject WMPlayer.OCX`,
    '$p.settings.volume = 100',
    `$p.URL = ${quoted}`,
    '$p.controls.play()',
    '$t = [Environment]::TickCount',
    "while (($p.playState -eq 3 -or $p.playState -eq 6 -or $p.playState -eq 7 -or $p.playState -eq 9) -and ([Environment]::TickCount - $t) -lt 60000) { Start-Sleep -Milliseconds 100 }",
    '$p.close()',
  ].join(';')
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
    const script = /\.mp3$/i.test(path) ? windowsMp3Script(path) : windowsWavScript(path)
    return { bin: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', script] }
  }
  return undefined
}

/** The outcome of one `play` attempt, with a diagnostics message on failure. */
export interface PlaybackResult {
  ok: boolean
  error?: string
}

/**
 * Fire-and-forget sound player. `play` launches the platform command, records
 * a full diagnostics trail (attempt, resolved path, player command, exit
 * code), and reports failures with a reason instead of failing silently —
 * Windows playback problems should be visible in the host log and, via the
 * `preview` Remote, in the bell panel itself.
 */
export class SoundPlayer {
  private current: ChildProcess | null = null

  /** Play one sound, replacing any in-flight playback. */
  play(sound: string, volume?: number): PlaybackResult {
    const path = resolveSoundPath(sound)
    if (path === undefined) {
      const error = `sound "${sound}" is not playable on ${process.platform} — configure an absolute file path`
      console.warn(`[session-notify] ${error}`)
      return { ok: false, error }
    }
    const command = commandFor(path, volume)
    if (command === undefined) {
      const error = `no sound player available on ${process.platform}`
      console.warn(`[session-notify] ${error}`)
      return { ok: false, error }
    }
    console.log(`[session-notify] playing "${sound}" -> ${path} via ${command.bin}`)
    return this.launch(command, path)
  }

  /** Spawn one command with the single-flight slot; Linux retries ALSA on PulseAudio absence. */
  private launch(command: Command, path: string): PlaybackResult {
    let child: ChildProcess
    try {
      this.current?.kill()
    } catch {
      // already dead — ignore
    }
    try {
      child = spawn(command.bin, command.args, { stdio: 'ignore' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[session-notify] spawn ${command.bin} failed: ${message}`)
      return { ok: false, error: `${command.bin}: ${message}` }
    }
    this.current = child
    const onError = (error: Error): void => {
      if (this.current !== child) return
      this.current = null
      if (process.platform === 'linux' && command.bin === 'paplay') {
        // PulseAudio missing — retry once through ALSA's aplay.
        console.warn(`[session-notify] ${path}: ${error.message}; retrying with aplay`)
        const fallback = spawn('aplay', [path], { stdio: 'ignore' })
        this.current = fallback
        fallback.on('error', (fallbackError) => {
          console.warn(`[session-notify] aplay failed: ${fallbackError.message}`)
          this.current = null
        })
        fallback.on('exit', (code) => {
          console.log(`[session-notify] aplay exited with code ${code ?? 'null'}`)
          if (this.current === fallback) this.current = null
        })
        return
      }
      console.warn(`[session-notify] ${command.bin} playback failed: ${error.message}`)
    }
    child.on('error', onError)
    child.on('exit', (code) => {
      if (this.current === child) this.current = null
      if (code !== 0 && code !== null) {
        // Non-zero exit means the player itself reported a failure — worth
        // logging even though the run must never be disturbed.
        console.warn(`[session-notify] ${command.bin} exited with code ${code} for ${path}`)
      } else {
        console.log(`[session-notify] ${command.bin} finished (code ${code ?? 'null'})`)
      }
    })
    return { ok: true }
  }
}
