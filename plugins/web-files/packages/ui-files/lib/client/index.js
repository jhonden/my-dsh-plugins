import { FilesExplorer } from './FilesExplorer.tsx';
import { FilesToggle } from './FilesToggle.tsx';
import { filesRpc } from './rpc.ts';
import { en, zh } from './locales.ts';
export { FilesExplorer } from './FilesExplorer.tsx';
/** Locale namespace owning the explorer's copy. */
const NS = 'web-files';
/** Required services: the slot registry and locale; sessions read via ctx.get for the optional current-session face. */
export const inject = ['slots', 'locale'];
/** Frame-level open state shared by the toggle and the drawer. */
const openState = { listeners: new Set(), open: false };
function setOpen(value) {
    openState.open = value;
    for (const listener of openState.listeners)
        listener();
}
/**
 * Client plugin body: register the dictionaries, the utilities toggle, and
 * the overlay drawer.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => {
        const disposers = [
            ctx.locale.register(NS, 'zh', zh),
            ctx.locale.register(NS, 'en', en),
        ];
        return () => { for (const dispose of disposers)
            dispose(); };
    }, 'ui-files: dictionaries');
    const t = ctx.locale.bind(NS);
    const call = filesRpc();
    const currentSessionId = () => {
        const sessions = ctx.get('sessions');
        return sessions?.current?.();
    };
    ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
        name: 'conversation.session.header.utilities',
        id: 'files',
        locale: NS,
        inject: () => ({ t, onToggle: () => setOpen(!openState.open), subscribe: (l) => { openState.listeners.add(l); return () => openState.listeners.delete(l); }, isOpen: () => openState.open }),
    }, FilesToggle));
    ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'files',
        locale: NS,
        inject: () => ({ t, call, currentSessionId, close: () => setOpen(false), subscribe: (l) => { openState.listeners.add(l); return () => openState.listeners.delete(l); }, isOpen: () => openState.open }),
    }, FilesExplorer));
}
//# sourceMappingURL=index.js.map