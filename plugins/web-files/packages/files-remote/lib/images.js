/**
 * Image extension allowlist and media types for the preview route. The
 * allowlist is the security boundary: only these extensions are ever served,
 * each with its exact Content-Type, so a served response can never be
 * interpreted as HTML (no sniffing ambiguity) or leak a non-image file.
 */
/** Extension (lowercase, no dot) → exact response Content-Type. */
export const IMAGE_MEDIA_TYPES = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
};
/** Inclusive byte cap per image response. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/**
 * Media type for a path's extension, or `undefined` for non-image paths.
 * @param path - session-workspace-relative file path.
 */
export function imageMediaTypeFor(path) {
    const base = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1);
    const dot = base.lastIndexOf('.');
    if (dot <= 0)
        return undefined;
    return IMAGE_MEDIA_TYPES[base.slice(dot + 1).toLowerCase()];
}
//# sourceMappingURL=images.js.map