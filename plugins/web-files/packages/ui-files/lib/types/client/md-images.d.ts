/**
 * Rewrite relative image references in markdown to the Host preview route.
 *
 * `MarkdownText` (the platform renderer) only permits absolute http(s) image
 * URLs — correct for untrusted assistant output, wrong for a file viewer
 * showing the user's own README. Rewriting `![alt](rel.png)` destinations to
 * the preview-route URL (absolute http(s) with query params) lets the same
 * renderer display workspace images without weakening its safety rules:
 * paths stay workspace-confined on the Host and cross-site embeds are denied
 * by the route's same-origin fence.
 */
/**
 * Rewrite relative image destinations to the preview route as absolute URLs —
 * the platform renderer permits only absolute http(s) image destinations, so
 * a scheme-relative path would still render as alt text.
 * @param source - the markdown text.
 * @param sessionId - the session whose workspace confines the images.
 * @param baseDir - directory of the markdown file (`''` = workspace root);
 *   relative destinations resolve against it.
 * @returns markdown with image destinations pointing at the preview route.
 */
export declare function rewriteMarkdownImages(source: string, sessionId: string, baseDir: string): string;
//# sourceMappingURL=md-images.d.ts.map