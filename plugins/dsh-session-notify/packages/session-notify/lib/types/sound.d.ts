/**
 * Resolve the configured `sound` value to a playable file path. On macOS a
 * bare name resolves against the system sounds directory; elsewhere a bare
 * name is unresolvable (the operator must configure a path) and yields
 * `undefined` so playback reports failure instead of guessing.
 */
export declare function resolveSoundPath(sound: string): string | undefined;
/** One platform command template for a resolved sound path. */
interface Command {
    bin: string;
    args: string[];
}
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