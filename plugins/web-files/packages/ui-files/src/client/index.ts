/**
 * Browser half of the ui-files plugin: one "Files" entry in the conversation
 * view tab ring (beside Chat and Trajectory) hosting a full-area workspace
 * file explorer. Data comes from the Host's `filesRemote` Typert Remote
 * service through the same `/api/<namespace>/<method>` carrier the generated
 * client uses, called directly over fetch so this distribution carries no
 * generated artifacts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the conversation.view ring).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { FilesView, requestOpenInFiles } from './FilesView.tsx'
import { bindLinkCwd, installLinkInterception } from './link-intercept.ts'
import { filesRpc } from './rpc.ts'
import { en, zh } from './locales.ts'

export { FilesView } from './FilesView.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The files explorer's copy. */
    'web-files': import('./locales.ts').FilesLocaleKey
  }
}

/** Locale namespace owning the explorer's copy. */
const NS = 'web-files'

/** Required services: the slot registry, the sessions store, and locale. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Client plugin body: register the dictionaries and the Files view tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = [
      ctx.locale.register(NS, 'zh', zh),
      ctx.locale.register(NS, 'en', en),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-files: dictionaries')

  const t = ctx.locale.bind(NS)
  const call = filesRpc()
  /** Current session id from the sessions list snapshot (`SessionListState.current`). */
  const currentSessionId = (): string | undefined => ctx.sessions.list.getSnapshot().current
  /** Current session cwd for resolving intercepted absolute link paths. */
  const currentCwd = (): string | undefined => {
    const current = ctx.sessions.list.getSnapshot().current
    return current === undefined ? undefined : ctx.sessions.list.getSnapshot().byId[current]?.cwd
  }
  // Chat tool-row file links open in this plugin's viewer instead of the OS
  // opener; capture-phase interception, removed with the plugin fiber.
  bindLinkCwd(currentCwd)
  ctx.effect(() => installLinkInterception(path => { requestOpenInFiles(path) }, element =>
    element.closest('[data-web-files]') !== null), 'ui-files: link interception')

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'files',
    order: 20,
    locale: NS,
    label: () => t('view.files'),
    inject: () => ({ call, currentSessionId }),
  }, FilesView))
}
