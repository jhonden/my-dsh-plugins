import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Full props for the composer completion bell. */
export type BellActionProps = PropsRuntime<'conversation.input.left'> & PropsLocale<typeof NS>;
/**
 * The completion bell for one session, sitting beside the access-mode chrome:
 * click to arm/disarm, a caret opens the sound preview, and the run's
 * `running` flag drives a status dot plus the one-shot re-sync performed by
 * the Host.
 * @param props - framework slot currency plus the namespace translator.
 */
export declare function BellAction({ sessionId, useSession, t }: BellActionProps): import("react").JSX.Element;
//# sourceMappingURL=BellAction.d.ts.map