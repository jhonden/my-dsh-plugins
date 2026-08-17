/** The ASCII marker token; the emoji bell is accepted as an alias. */
export const NOTIFY_MARKER = '!notify';
/**
 * Leading-token matcher: the marker must be the first non-whitespace token of
 * the text, followed by whitespace or end-of-string, so `!notifyX` or a
 * marker in the middle of a sentence never triggers.
 */
const MARKER_RE = /^\s*(?:!notify|🔔)(?:[ \t]+|$)/;
/**
 * Apply the notify marker across a pre-step message batch. Only messages with
 * `source.kind === 'user'` are inspected — plugin-injected context (file
 * change notices, skill content, goal-round continuations) is never touched.
 * A marker that would leave the whole message empty keeps the original text
 * (the model must never receive an empty message) while still arming.
 * @param messages - the claimed messages proposed for the step.
 * @returns the stripped batch and whether it armed the session.
 */
export function applyNotifyMarker(messages) {
    let armed = false;
    const out = [];
    for (const message of messages) {
        const stripped = stripOne(message);
        if (stripped === undefined) {
            out.push(message);
            continue;
        }
        armed = true;
        out.push(stripped);
    }
    return { armed, messages: out };
}
/**
 * Strip the marker from one message, returning a shallow copy whose first
 * text block is rewritten. Returns the ORIGINAL message when the marker would
 * strip everything, `undefined` when the message carries no marker.
 */
function stripOne(message) {
    if (message.source.kind !== 'user')
        return undefined;
    const content = message.content;
    const first = content[0];
    if (first === undefined || first.type !== 'text')
        return undefined;
    const strippedText = stripMarker(first.text);
    if (strippedText === undefined)
        return undefined;
    if (strippedText === '')
        return message;
    const nextContent = [{ ...first, text: strippedText }, ...content.slice(1)];
    return { ...message, content: nextContent };
}
/** Strip the leading marker token from one text value; `undefined` when absent. */
export function stripMarker(text) {
    const match = MARKER_RE.exec(text);
    if (match === null)
        return undefined;
    return text.slice(match[0].length);
}
//# sourceMappingURL=marker.js.map