import { buildCommissionDateFilter } from '../../utils/commissionMetrics.js';

/** Resolve IST period bounds from API body/query. */
export function parseSettlementPeriod(input = {}) {
    const { startDate, endDate, date } = input;
    if (date && !startDate && !endDate) {
        const dateFilter = buildCommissionDateFilter(date, date);
        return {
            start: dateFilter?.createdAt?.$gte ?? null,
            end: dateFilter?.createdAt?.$lte ?? null,
        };
    }
    const dateFilter = buildCommissionDateFilter(startDate, endDate);
    return {
        start: dateFilter?.createdAt?.$gte ?? null,
        end: dateFilter?.createdAt?.$lte ?? null,
    };
}

export function assertValidPeriod(period) {
    if (!period?.start || !period?.end) {
        const err = new Error('Settlement period start and end are required (use date or startDate/endDate)');
        err.status = 400;
        throw err;
    }
}
