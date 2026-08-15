import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The files drawer: an overlay panel with the workspace tree on the left and
 * a read-only text viewer on the right. All data access flows through the
 * injected call face; session identity through the injected current-session
 * getter. State is local to the mount.
 */
import { useEffect, useState } from 'react';
/** Join a directory path and an entry name. */
function joinPath(dir, name) {
    return dir === '' ? name : `${dir}/${name}`;
}
/** Map a typed error code to viewer copy, falling back to the generic line. */
function errorKey(code) {
    if (code === 'FILES_NOT_FOUND')
        return 'viewer.error.notFound';
    if (code === 'FILES_BINARY_REJECTED')
        return 'viewer.error.binary';
    if (code === 'FILES_PATH_OUTSIDE_WORKSPACE')
        return 'viewer.error.outside';
    return 'viewer.error.other';
}
/**
 * The drawer component. Visibility follows the frame-level open flag; the
 * tree starts at the workspace root and expands lazily per directory.
 */
export function FilesExplorer(props) {
    const [open, setOpen] = useState(props.isOpen());
    useEffect(() => props.subscribe(() => setOpen(props.isOpen())), [props]);
    const [rootListing, setRootListing] = useState(undefined);
    const [reading, setReading] = useState(undefined);
    useEffect(() => {
        if (!open || rootListing !== undefined)
            return;
        const controller = new AbortController();
        void (async () => {
            const sessionId = props.currentSessionId();
            if (sessionId === undefined) {
                setRootListing({ state: 'error', message: props.t('tree.error') });
                return;
            }
            setRootListing({ state: 'loading' });
            const outcome = await props.call.list(sessionId, '', controller.signal);
            if (!outcome.ok) {
                setRootListing({ state: 'error', message: props.t('tree.error') });
                return;
            }
            setRootListing({ state: 'done', entries: outcome.value.entries, truncated: outcome.value.truncated });
        })();
        return () => controller.abort();
    }, [open, rootListing, props]);
    const openFile = async (path) => {
        const sessionId = props.currentSessionId();
        if (sessionId === undefined)
            return;
        setReading({ state: 'loading', path });
        const outcome = await props.call.read(sessionId, path);
        if (!outcome.ok) {
            setReading({ state: 'error', path, message: props.t(errorKey(outcome.error.code)) });
            return;
        }
        setReading({ state: 'done', path, content: outcome.value.content, bytes: outcome.value.bytes, truncated: outcome.value.truncated });
    };
    const listDir = async (path, signal) => {
        const sessionId = props.currentSessionId();
        if (sessionId === undefined)
            return { state: 'error', message: props.t('tree.error') };
        const outcome = await props.call.list(sessionId, path, signal);
        if (!outcome.ok)
            return { state: 'error', message: props.t('tree.error') };
        return { state: 'done', entries: outcome.value.entries, truncated: outcome.value.truncated };
    };
    if (!open)
        return null;
    return (_jsxs("div", { role: "complementary", "aria-label": props.t('drawer.title'), style: {
            position: 'absolute', inset: '0 0 0 auto', width: 'min(720px, 80vw)', height: '100%',
            background: 'var(--dsh-bg-elevated, #1e1e22)', color: 'inherit',
            borderLeft: '1px solid var(--dsh-border, #333)', display: 'flex', flexDirection: 'column',
            zIndex: 40, pointerEvents: 'auto',
        }, children: [_jsxs("header", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }, children: [_jsx("strong", { children: props.t('drawer.title') }), _jsx("button", { type: "button", onClick: props.close, "aria-label": props.t('drawer.close'), children: "\u2715" })] }), _jsxs("div", { style: { display: 'flex', flex: 1, minHeight: 0 }, children: [_jsxs("nav", { "aria-label": props.t('drawer.title'), style: { width: '45%', overflow: 'auto', padding: '4px 8px', borderRight: '1px solid var(--dsh-border, #333)' }, children: [rootListing?.state === 'loading' && _jsx("div", { children: props.t('viewer.loading') }), rootListing?.state === 'error' && _jsx("div", { children: rootListing.message }), rootListing?.state === 'done' && rootListing.entries.length === 0 && _jsx("div", { children: props.t('tree.empty') }), rootListing?.state === 'done' && rootListing.entries.map(child => (_jsx(TreeRow, { entry: child, parentPath: "", depth: 0, t: props.t, listDir: listDir, onOpenFile: openFile }, child.name))), rootListing?.state === 'done' && rootListing.truncated && _jsx("div", { style: { opacity: 0.7 }, children: props.t('tree.truncated') })] }), _jsx(ViewerColumn, { reading: reading, t: props.t })] })] }));
}
/** One tree row; directories expand lazily in place, files open in the viewer. */
function TreeRow(props) {
    const { entry, parentPath, depth, t, listDir, onOpenFile } = props;
    const path = joinPath(parentPath, entry.name);
    const [expanded, setExpanded] = useState(false);
    const [listing, setListing] = useState(undefined);
    useEffect(() => {
        if (!expanded || listing !== undefined)
            return;
        const controller = new AbortController();
        void listDir(path, controller.signal).then(setListing);
        return () => controller.abort();
    }, [expanded, listing, path, listDir]);
    return (_jsxs("div", { children: [_jsxs("button", { type: "button", style: { display: 'block', width: '100%', textAlign: 'left', padding: '1px 0', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', paddingLeft: `${depth * 12 + 4}px` }, onClick: () => { if (entry.kind === 'directory') {
                    setExpanded(e => !e);
                }
                else {
                    onOpenFile(path);
                } }, children: [entry.kind === 'directory' ? (expanded ? '▾ ' : '▸ ') : '· ', entry.name] }), expanded && listing?.state === 'loading' && _jsx("div", { style: { paddingLeft: `${(depth + 1) * 12 + 20}px`, opacity: 0.7 }, children: t('viewer.loading') }), expanded && listing?.state === 'error' && _jsx("div", { style: { paddingLeft: `${(depth + 1) * 12 + 20}px` }, children: listing.message }), expanded && listing?.state === 'done' && listing.entries.map(child => (_jsx(TreeRow, { entry: child, parentPath: path, depth: depth + 1, t: t, listDir: listDir, onOpenFile: onOpenFile }, child.name))), expanded && listing?.state === 'done' && listing.truncated && (_jsx("div", { style: { paddingLeft: `${(depth + 1) * 12 + 20}px`, opacity: 0.7 }, children: t('tree.truncated') }))] }));
}
/** The viewer column: empty, loading, error, or read-only content. */
function ViewerColumn(props) {
    const { reading, t } = props;
    if (reading === undefined)
        return _jsx("div", { style: { flex: 1, padding: '16px', opacity: 0.7 }, children: t('viewer.empty') });
    if (reading.state === 'loading')
        return _jsx("div", { style: { flex: 1, padding: '16px' }, children: t('viewer.loading') });
    if (reading.state === 'error') {
        return _jsx("div", { style: { flex: 1, padding: '16px', color: 'var(--dsh-danger, #e55)' }, children: reading.message });
    }
    return (_jsxs("div", { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }, children: [_jsxs("div", { style: { padding: '4px 12px', opacity: 0.7, display: 'flex', gap: '12px' }, children: [_jsx("span", { children: reading.path }), reading.bytes != null && _jsxs("span", { children: [reading.bytes, " ", t('viewer.bytes')] }), reading.truncated && _jsx("span", { children: t('viewer.truncated') })] }), _jsx("pre", { style: { flex: 1, overflow: 'auto', margin: 0, padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: reading.content })] }));
}
//# sourceMappingURL=FilesExplorer.js.map