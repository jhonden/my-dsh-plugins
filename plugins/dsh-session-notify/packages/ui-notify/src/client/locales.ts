/** Browser copy for the completion bell, zh and en dictionaries. */

export const zh = {
  'action.arm': '完成时提醒我',
  'action.disarm': '取消完成提醒',
  'action.preview': '试听提示音',
  'aria.armed': '完成提醒已开启',
  'aria.unarmed': '完成提醒已关闭',
  'state.armedRunning': '任务运行中，完成后响铃提醒',
} as const

export const en = {
  'action.arm': 'Notify me when finished',
  'action.disarm': 'Turn off completion alert',
  'action.preview': 'Preview sound',
  'aria.armed': 'Completion alert on',
  'aria.unarmed': 'Completion alert off',
  'state.armedRunning': 'Running — will alert when finished',
} as const

/** Union of this namespace's dictionary keys (registered in the LocaleNamespaceMap merge). */
export type NotifyLocaleKey = keyof typeof zh

/** Locale namespace owning the bell's copy. */
export const NS = 'dsh-notify'
