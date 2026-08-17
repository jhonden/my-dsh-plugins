import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
import { notifyRpc } from './rpc.ts';
/** Full props for the composer completion bell. */
export type BellActionProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS> & {
    /** The sessionNotify Remote caller (arm state, preview, prefs, sound list). */
    call: ReturnType<typeof notifyRpc>;
};
/**
 * The completion bell for one session, sitting beside the access-mode chrome:
 * click to arm/disarm; the caret opens the sound-settings panel backed by the
 * Host's prefs Remotes (LAN-safe, unlike the browser settings transport).
 * @param props - framework slot currency, the namespace translator, and the injected Remote face.
 */
export declare function BellAction({ sessionId, useSession, t, call }: BellActionProps): import("react").JSX.Element;
//# sourceMappingURL=BellAction.d.ts.map