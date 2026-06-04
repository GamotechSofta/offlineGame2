import { computeBookiePanelKpis, resolveBookiePanelDateRange } from './bookiePanelKpis.js';

/**
 * Admin / bookie panel revenue KPIs — matches superbookie Dashboard.jsx formulas.
 * Defaults to IST "today" when no startDate/endDate (same as bookie dashboard preset).
 */
export async function getPanelRevenueKpisForAdmin(admin, { startDate, endDate } = {}) {
    const effective = resolveBookiePanelDateRange({ startDate, endDate });
    return computeBookiePanelKpis(admin, {
        startDate: effective.allTime ? undefined : effective.from,
        endDate: effective.allTime ? undefined : effective.to,
    });
}
