/**
 * Browser half of the ui-files plugin: one "Files" entry in the conversation
 * view tab ring (beside Chat and Trajectory) hosting a full-area workspace
 * file explorer. Data comes from the Host's `filesRemote` Typert Remote
 * service through the same `/api/<namespace>/<method>` carrier the generated
 * client uses, called directly over fetch so this distribution carries no
 * generated artifacts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { FilesView } from './FilesView.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The files explorer's copy. */
        'web-files': import('./locales.ts').FilesLocaleKey;
    }
}
/** Required services: the slot registry, the sessions store, and locale. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and the Files view tab.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map