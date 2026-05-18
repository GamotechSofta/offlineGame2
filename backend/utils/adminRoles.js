/** Panel operators that manage players under referredBy (bookie or super bookie). */
export const isBookiePanelRole = (admin) =>
    admin?.role === 'bookie' || admin?.role === 'super_bookie';

export const isSuperBookieRole = (admin) => admin?.role === 'super_bookie';
