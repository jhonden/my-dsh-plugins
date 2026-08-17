/**
 * Message-marker trigger: a user message that begins with the `!notify` (or
 * `🔔`) token arms its session for one completion and is stripped before the
 * message enters the model-visible step. Pure functions, unit-testable.
 */
import type { UserMessage } from '@deepseek-ai/dsh-session';
/** The ASCII marker token; the emoji bell is accepted as an alias. */
export declare const NOTIFY_MARKER = "!notify";
/** Outcome of applying the marker to one pre-step message batch. */
export interface MarkerResult {
    /** Whether at least one user message carried the marker and armed the session. */
    armed: boolean;
    /** The messages to enter the step, markers stripped. */
    messages: UserMessage[];
}
/**
 * Apply the notify marker across a pre-step message batch. Only messages with
 * `source.kind === 'user'` are inspected — plugin-injected context (file
 * change notices, skill content, goal-round continuations) is never touched.
 * A marker that would leave the whole message empty keeps the original text
 * (the model must never receive an empty message) while still arming.
 * @param messages - the claimed messages proposed for the step.
 * @returns the stripped batch and whether it armed the session.
 */
export declare function applyNotifyMarker(messages: readonly UserMessage[]): MarkerResult;
/** Strip the leading marker token from one text value; `undefined` when absent. */
export declare function stripMarker(text: string): string | undefined;
//# sourceMappingURL=marker.d.ts.map