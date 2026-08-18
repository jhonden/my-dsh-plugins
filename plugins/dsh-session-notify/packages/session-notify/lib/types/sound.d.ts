/** Ordered names of the built-in macOS sounds (the listSounds wire vocabulary). */
export declare const MACOS_SOUND_NAMES: readonly string[];
/** Ordered names of the Windows built-in sounds (the listSounds wire vocabulary). */
export declare const WINDOWS_SOUND_NAMES: readonly string[];
/**
 * The platform's default sound name. The plugin config's `Glass` default is a
 * "platform default" alias — it resolves to this on non-darwin platforms, so
 * a fresh install just works on Windows too.
 */
export declare function defaultSoundName(platform?: NodeJS.Platform): string;
/**
 * Resolve the configured `sound` value to a playable file path. A bare name
 * resolves against the platform's system sounds directory (macOS AIFFs,
 * Windows Media wavs); elsewhere a bare name is unresolvable (the operator
 * must configure a path) and yields `undefined` so playback reports failure
 * instead of guessing.
 */
export declare function resolveSoundPath(sound: string, platform?: NodeJS.Platform): string | undefined;
/** The named sounds the host can offer for one platform (the listSounds wire vocabulary). */
export declare function soundsForPlatform(platform?: NodeJS.Platform): string[];
/** One platform command template for a resolved sound path. */
interface Command {
    bin: string;
    args: string[];
}
/**
 * Windows playback via system MCI (`winmm.dll`, zero dependencies): wav uses
 * the default waveaudio device, mp3 opens as `type mpegvideo`, and
 * `play ... wait` plays synchronously so the child exits when the sound ends
 * (the same lifecycle the player's single-flight slot expects).
 */
export declare function windowsPlayerScript(path: string): string;
/** Build the playback command for the current platform, or `undefined` when no player exists. */
export declare function commandFor(path: string, volume?: number): Command | undefined;
/**
 * Fire-and-forget sound player. `play` returns whether a playback was
 * launched; failures are logged once per player instance and never thrown.
 */
export declare class SoundPlayer {
    private current;
    private warned;
    /** Play one sound, replacing any in-flight playback. */
    play(sound: string, volume?: number): boolean;
    /** Spawn one command with the single-flight slot; Linux retries ALSA on PulseAudio absence. */
    private launch;
    private warnOnce;
}
export {};
//# sourceMappingURL=sound.d.ts.map