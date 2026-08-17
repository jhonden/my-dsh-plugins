/**
 * Browser half of the ui-notify plugin: a "bell" control in the composer tool
 * row, right after the access-mode chrome, that arms this session to play a
 * sound when its run finishes. Data comes from the Host's `sessionNotify`
 * Typert Remote service through the same `/api/<namespace>/<method>` carrier
 * the generated client uses, called directly over fetch so this distribution
 * carries no generated artifacts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ui-conversation SlotMap merge (the composer tool row).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BellAction } from './BellAction.tsx'
import { NS, en, zh } from './locales.ts'

export { BellAction } from './BellAction.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The completion bell's copy. */
    'dsh-notify': import('./locales.ts').NotifyLocaleKey
  }
}

/** Locale namespace owning the bell's copy. */
const NS_NAME = NS

/** Required services: the slot registry and locale. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the composer bell.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const disposers = [
      ctx.locale.register(NS_NAME, 'zh', zh),
      ctx.locale.register(NS_NAME, 'en', en),
    ]
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'ui-notify: dictionaries')

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'session-notify',
    order: 10,
    locale: NS_NAME,
  }, BellAction))
}
