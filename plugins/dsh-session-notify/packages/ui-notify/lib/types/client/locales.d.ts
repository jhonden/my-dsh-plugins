/** Browser copy for the completion bell, zh and en dictionaries. */
export declare const zh: {
    readonly 'action.arm': "完成时提醒我";
    readonly 'action.disarm': "取消完成提醒";
    readonly 'action.preview': "试听提示音";
    readonly 'aria.armed': "完成提醒已开启";
    readonly 'aria.unarmed': "完成提醒已关闭";
    readonly 'state.armedRunning': "任务运行中，完成后响铃提醒";
};
export declare const en: {
    readonly 'action.arm': "Notify me when finished";
    readonly 'action.disarm': "Turn off completion alert";
    readonly 'action.preview': "Preview sound";
    readonly 'aria.armed': "Completion alert on";
    readonly 'aria.unarmed': "Completion alert off";
    readonly 'state.armedRunning': "Running — will alert when finished";
};
/** Union of this namespace's dictionary keys (registered in the LocaleNamespaceMap merge). */
export type NotifyLocaleKey = keyof typeof zh;
/** Locale namespace owning the bell's copy. */
export declare const NS = "dsh-notify";
//# sourceMappingURL=locales.d.ts.map