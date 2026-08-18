/** Audio extensions the notification player can handle. */
export declare const AUDIO_EXTENSIONS: ReadonlySet<string>;
/**
 * The extensions one platform's player can actually play. Windows uses the
 * PowerShell `Media.SoundPlayer`, which only accepts WAV — so uploads there
 * are narrowed to `.wav` instead of accepting files that would silently
 * fail to play.
 */
export declare function audioExtensionsForPlatform(platform?: NodeJS.Platform): ReadonlySet<string>;
/**
 * Default maximum accepted upload size (15 MiB). Generous because WAV (the
 * Windows upload format) is uncompressed PCM — 44.1 kHz stereo runs ~10 MiB
 * per minute, so the cap allows comfortable multi-second chimes there too.
 * The plugin config's `maxUploadBytes` overrides it.
 */
export declare const DEFAULT_MAX_UPLOAD_BYTES: number;
/** The upload is too large to accept. */
export declare class UploadTooLargeError extends Error {
}
/** The upload is not a supported audio file. */
export declare class UploadRejectedError extends Error {
}
/** Reduce a client filename to a safe single path component. */
export declare function sanitizeUploadName(name: string): string;
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
export declare function saveUpload(dir: string, name: string, chunks: AsyncIterable<Buffer>, maxBytes: number, extensions?: ReadonlySet<string>): Promise<string>;
//# sourceMappingURL=sound-upload.d.ts.map