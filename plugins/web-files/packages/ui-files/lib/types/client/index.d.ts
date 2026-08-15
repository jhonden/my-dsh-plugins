/**
 * Browser half of the ui-files plugin: a session-header utilities toggle that
 * opens a frame overlay drawer with the workspace file tree and a read-only
 * text viewer. Data comes from the Host's `filesRemote` Typert Remote service
 * through the same `/api/<namespace>/<method>` carrier the generated client
 * uses, called directly over fetch so this distribution carries no generated
 * artifacts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
export { FilesExplorer } from './FilesExplorer.tsx';
/** Required services: the slot registry and locale; sessions read via ctx.get for the optional current-session face. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries, the utilities toggle, and
 * the overlay drawer.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map