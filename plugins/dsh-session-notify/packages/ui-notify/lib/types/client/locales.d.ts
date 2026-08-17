/** Browser copy for the completion bell, zh and en dictionaries. */
export declare const zh: {
    readonly 'action.arm': "完成时提醒我";
    readonly 'action.disarm': "取消完成提醒";
    readonly 'action.preview': "试听提示音";
    readonly 'aria.armed': "完成提醒已开启";
    readonly 'aria.unarmed': "完成提醒已关闭";
    readonly 'state.armedRunning': "任务运行中，完成后响铃提醒";
    readonly 'sound.label': "提示音";
    readonly 'sound.system': "系统音效";
    readonly 'sound.custom': "自定义文件…";
    readonly 'sound.customPlaceholder': "输入音频文件绝对路径";
    readonly 'sound.unavailable': "当前平台无内置音效，请输入文件路径";
    readonly 'volume.label': "音量";
};
export declare const en: {
    readonly 'action.arm': "Notify me when finished";
    readonly 'action.disarm': "Turn off completion alert";
    readonly 'action.preview': "Preview sound";
    readonly 'aria.armed': "Completion alert on";
    readonly 'aria.unarmed': "Completion alert off";
    readonly 'state.armedRunning': "Running — will alert when finished";
    readonly 'sound.label': "Sound";
    readonly 'sound.system': "System sound";
    readonly 'sound.custom': "Custom file…";
    readonly 'sound.customPlaceholder': "Absolute audio file path";
    readonly 'sound.unavailable': "No built-in sounds on this platform — enter a file path";
    readonly 'volume.label': "Volume";
};
/** Union of this namespace's dictionary keys (registered in the LocaleNamespaceMap merge). */
export type NotifyLocaleKey = keyof typeof zh;
/** Locale namespace owning the bell's copy. */
export declare const NS = "dsh-notify";
//# sourceMappingURL=locales.d.ts.map