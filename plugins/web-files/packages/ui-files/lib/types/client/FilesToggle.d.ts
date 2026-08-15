/** Inject face provided by the plugin's utilities registration. */
export interface FilesToggleProps {
    t: (key: string) => string;
    onToggle: () => void;
    subscribe: (listener: () => void) => () => void;
    isOpen: () => boolean;
}
/** The button; its pressed state follows the frame-level open flag. */
export declare function FilesToggle(props: FilesToggleProps): import("react").JSX.Element;
//# sourceMappingURL=FilesToggle.d.ts.map