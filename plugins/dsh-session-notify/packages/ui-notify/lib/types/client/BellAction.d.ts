import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import { NS } from './locales.ts';
import { notifyRpc } from './rpc.ts';
/** Full props for the composer completion bell. */
export type BellActionProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS> & BellInjected;
/** The settings section this bell binds (mirror of the Host namespace). */
export interface BellSettings {
    sound: string;
    volume?: number;
    mode?: 'one-shot' | 'sticky';
}
/** Host-facing services injected by the plugin registration. */
export interface BellInjected {
    /** The `session-notify` settings scope (read/subscribe/write). */
    settings: SettingsScope<BellSettings>;
    /** The sessionNotify Remote caller (arm state, preview, sound list). */
    call: ReturnType<typeof notifyRpc>;
}
/**
 * The completion bell for one session, sitting beside the access-mode chrome:
 * click to arm/disarm; the caret opens the sound-settings panel bound to the
 * shared `session-notify` settings namespace.
 * @param props - framework slot currency, the namespace translator, and the injected faces.
 */
export declare function BellAction({ sessionId, useSession, t, settings, call }: BellActionProps): import("react").JSX.Element;
//# sourceMappingURL=BellAction.d.ts.map