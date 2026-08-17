/**
 * Browser half of the ui-notify plugin: a "bell" control in the composer tool
 * row, right after the access-mode chrome, that arms this session to play a
 * sound when its run finishes. Data comes from the Host's `sessionNotify`
 * Typert Remote service through the same `/api/<namespace>/<method>` carrier
 * the generated client uses, called directly over fetch so this distribution
 * carries no generated artifacts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { BellAction } from './BellAction.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The completion bell's copy. */
        'dsh-notify': import('./locales.ts').NotifyLocaleKey;
    }
}
/** Required services: the slot registry and locale. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and the composer bell.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map