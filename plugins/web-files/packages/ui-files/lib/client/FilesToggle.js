import { jsxs as _jsxs } from "react/jsx-runtime";
/** The utilities-bar toggle button for the files drawer. */
import { useEffect, useState } from 'react';
/** The button; its pressed state follows the frame-level open flag. */
export function FilesToggle(props) {
    const [open, setOpen] = useState(props.isOpen());
    useEffect(() => props.subscribe(() => setOpen(props.isOpen())), [props]);
    return (_jsxs("button", { type: "button", "aria-pressed": open, title: open ? props.t('button.close') : props.t('button.open'), onClick: props.onToggle, style: { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '2px 6px' }, children: ["\uD83D\uDCC1 ", props.t('button.open')] }));
}
//# sourceMappingURL=FilesToggle.js.map