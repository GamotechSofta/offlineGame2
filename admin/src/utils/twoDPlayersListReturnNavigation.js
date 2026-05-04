/** Must match sentinel in 2D players page for “all day / range aggregate” slot selection. */
export const TWO_D_PLAYERS_ALL_DAY_SLOT = '__all_day__';

/**
 * Build query string to restore 2D players list (Live vs By date & draw).
 * @param {{ viewMode: string, dateFrom?: string, dateTo?: string, selectedHistorySlotIso?: string } | null | undefined} fromList
 */
export function buildTwoDPlayersListSearch(fromList) {
    if (!fromList || fromList.viewMode === 'live') {
        return '?view=live';
    }
    const p = new URLSearchParams();
    p.set('view', 'bySlot');
    p.set('dateFrom', String(fromList.dateFrom || ''));
    p.set('dateTo', String(fromList.dateTo || ''));
    p.set('slot', String(fromList.selectedHistorySlotIso ?? ''));
    return `?${p.toString()}`;
}
