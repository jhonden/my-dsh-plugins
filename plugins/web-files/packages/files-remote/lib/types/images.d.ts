/**
 * Image extension allowlist and media types for the preview route. The
 * allowlist is the security boundary: only these extensions are ever served,
 * each with its exact Content-Type, so a served response can never be
 * interpreted as HTML (no sniffing ambiguity) or leak a non-image file.
 */
/** Extension (lowercase, no dot) → exact response Content-Type. */
export declare const IMAGE_MEDIA_TYPES: Readonly<Record<string, string>>;
/** Inclusive byte cap per image response. */
export declare const MAX_IMAGE_BYTES: number;
/**
 * Media type for a path's extension, or `undefined` for non-image paths.
 * @param path - session-workspace-relative file path.
 */
export declare function imageMediaTypeFor(path: string): string | undefined;
//# sourceMappingURL=images.d.ts.map