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
import { spawn } from 'node:child_process';
/** Named macOS system sounds, resolved to their bundled AIFF paths. */
const MACOS_SOUNDS = {
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
};
/** Ordered names of the built-in macOS sounds (the listSounds wire vocabulary). */
export const MACOS_SOUND_NAMES = Object.keys(MACOS_SOUNDS);
/** Common Windows built-in sounds under `C:\\Windows\\Media\\` (wav). */
const WINDOWS_SOUNDS = [
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
];
/** Ordered names of the Windows built-in sounds (the listSounds wire vocabulary). */
export const WINDOWS_SOUND_NAMES = WINDOWS_SOUNDS;
/** The media directory Windows built-in sounds live in. */
const WINDOWS_MEDIA_DIR = 'C:\\Windows\\Media';
/**
 * The platform's default sound name. The plugin config's `Glass` default is a
 * "platform default" alias — it resolves to this on non-darwin platforms, so
 * a fresh install just works on Windows too.
 */
export function defaultSoundName(platform = process.platform) {
    return platform === 'win32' ? 'Windows Notify System Generic' : 'Glass';
}
/** Values accepted as an explicit path rather than a named system sound. */
function looksLikePath(value) {
    return value.startsWith('/') || value.includes('\\') || /\.(aiff|aif|wav|mp3|m4a|ogg)$/i.test(value);
}
/**
 * Resolve the configured `sound` value to a playable file path. A bare name
 * resolves against the platform's system sounds directory (macOS AIFFs,
 * Windows Media wavs); elsewhere a bare name is unresolvable (the operator
 * must configure a path) and yields `undefined` so playback reports failure
 * instead of guessing.
 */
export function resolveSoundPath(sound, platform = process.platform) {
    if (sound === '')
        return undefined;
    if (looksLikePath(sound))
        return sound;
    if (platform === 'darwin') {
        return MACOS_SOUNDS[sound] ?? `/System/Library/Sounds/${sound}.aiff`;
    }
    if (platform === 'win32') {
        return WINDOWS_SOUNDS.includes(sound) ? `${WINDOWS_MEDIA_DIR}\\${sound}.wav` : undefined;
    }
    return undefined;
}
/** The named sounds the host can offer for one platform (the listSounds wire vocabulary). */
export function soundsForPlatform(platform = process.platform) {
    if (platform === 'darwin')
        return [...MACOS_SOUND_NAMES];
    if (platform === 'win32')
        return [...WINDOWS_SOUND_NAMES];
    return [];
}
/**
 * Windows playback via system MCI (`winmm.dll`, zero dependencies): wav uses
 * the default waveaudio device, mp3 opens as `type mpegvideo`, and
 * `play ... wait` plays synchronously so the child exits when the sound ends
 * (the same lifecycle the player's single-flight slot expects).
 */
export function windowsPlayerScript(path) {
    const type = /\.mp3$/i.test(path) ? ' type mpegvideo' : '';
    const escaped = path.replaceAll("'", "''");
    const quoted = `'${escaped}'`;
    return [
        "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class WinmmNotify{[DllImport(\"winmm.dll\")]public static extern int mciSendString(string c,string r,int n,System.IntPtr h);}'",
        `[WinmmNotify]::mciSendString('open '+${quoted}+'${type} alias snd',${null},0,[IntPtr]::Zero)|Out-Null`,
        "[WinmmNotify]::mciSendString('play snd wait',$null,0,[IntPtr]::Zero)|Out-Null",
        "[WinmmNotify]::mciSendString('close snd',$null,0,[IntPtr]::Zero)|Out-Null",
    ].join(';');
}
/** Build the playback command for the current platform, or `undefined` when no player exists. */
export function commandFor(path, volume) {
    if (process.platform === 'darwin') {
        const args = volume === undefined ? [path] : ['-v', String(volume), path];
        return { bin: 'afplay', args };
    }
    if (process.platform === 'linux') {
        // PulseAudio first, ALSA fallback — the error path retries below.
        return { bin: 'paplay', args: [path] };
    }
    if (process.platform === 'win32') {
        return { bin: 'powershell', args: ['-NoProfile', '-NonInteractive', '-Command', windowsPlayerScript(path)] };
    }
    return undefined;
}
/**
 * Fire-and-forget sound player. `play` returns whether a playback was
 * launched; failures are logged once per player instance and never thrown.
 */
export class SoundPlayer {
    current = null;
    warned = false;
    /** Play one sound, replacing any in-flight playback. */
    play(sound, volume) {
        const path = resolveSoundPath(sound);
        if (path === undefined) {
            this.warnOnce(`sound "${sound}" is not playable on ${process.platform} — configure an absolute file path`);
            return false;
        }
        const command = commandFor(path, volume);
        if (command === undefined) {
            this.warnOnce(`no sound player available on ${process.platform}`);
            return false;
        }
        return this.launch(command, path);
    }
    /** Spawn one command with the single-flight slot; Linux retries ALSA on PulseAudio absence. */
    launch(command, path) {
        try {
            this.current?.kill();
        }
        catch {
            // already dead — ignore
        }
        const child = spawn(command.bin, command.args, { stdio: 'ignore' });
        this.current = child;
        const onError = (error) => {
            if (this.current !== child)
                return;
            this.current = null;
            if (process.platform === 'linux' && command.bin === 'paplay') {
                // PulseAudio missing — retry once through ALSA's aplay.
                const fallback = spawn('aplay', [path], { stdio: 'ignore' });
                this.current = fallback;
                fallback.on('error', (fallbackError) => {
                    this.warnOnce(`sound playback failed: ${fallbackError.message}`);
                    this.current = null;
                });
                fallback.on('exit', () => {
                    if (this.current === fallback)
                        this.current = null;
                });
                return;
            }
            this.warnOnce(`sound playback failed: ${error.message}`);
        };
        child.on('error', onError);
        child.on('exit', () => {
            if (this.current === child)
                this.current = null;
        });
        return true;
    }
    warnOnce(message) {
        if (this.warned)
            return;
        this.warned = true;
        console.warn(`[session-notify] ${message}`);
    }
}
//# sourceMappingURL=sound.js.map