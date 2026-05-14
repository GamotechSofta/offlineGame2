import React from 'react';

/**
 * Wraps wide `<table>` layouts so they scroll horizontally inside the content
 * column instead of forcing the whole admin shell to scroll (laptop widths
 * 1366–1920px, typical zoom 90–110%).
 *
 * Usage: `<AdminTableFrame><table className="w-full min-w-[…]">…</table></AdminTableFrame>`
 */
const AdminTableFrame = ({ children, className = '' }) => (
    <div className={`admin-table-frame ${className}`.trim()}>
        {children}
    </div>
);

export default AdminTableFrame;
