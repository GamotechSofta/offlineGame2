/** Group admin 2D player history API bets by ticket + slot (ticket-wise rows). */
export function buildPlayer2DHistoryTicketGroups(playerHistoryData) {
    const slots = Array.isArray(playerHistoryData?.slots) ? playerHistoryData.slots : [];
    const map = new Map();
    for (const slot of slots) {
        const drawLabelEnd = slot?.drawLabelEnd || '-';
        const slotStartIso = slot?.slotStartIso || '';
        const slotEnded = Boolean(slot?.isCompleted);
        const winningQuizLabels = Array.isArray(slot?.winningQuizLabels) ? slot.winningQuizLabels : [];
        const drawDate = slotStartIso ? new Date(slotStartIso).toLocaleDateString('en-GB') : '-';
        for (const bet of slot.bets || []) {
            const tid = bet.ticketId ? String(bet.ticketId).trim() : '';
            const key = tid ? `${tid}|${slotStartIso}` : `legacy|${bet.betId}|${slotStartIso}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    ticketId: tid || null,
                    slotStartIso,
                    drawLabelEnd,
                    slotEnded,
                    winningQuizLabels,
                    drawDate,
                    lines: [],
                });
            }
            map.get(key).lines.push(bet);
        }
    }
    const out = [...map.values()].map((g) => {
        const slotStartMs = g.slotStartIso ? new Date(g.slotStartIso).getTime() : Number.NaN;
        const lines = [...g.lines].sort(
            (a, b) => (Number(a.quizId) - Number(b.quizId)) || String(a.number).localeCompare(String(b.number)),
        );
        const nonCancel = lines.filter((l) => l.outcome !== 'cancelled');
        const cancelledCount = lines.length - nonCancel.length;
        const totalStake = nonCancel.reduce((s, l) => s + Number(l.amount || 0), 0);
        const totalPayout = nonCancel.reduce((s, l) => s + Number(l.payout || 0), 0);
        const winningLineCount = nonCancel.filter((l) => l.outcome === 'win').length;
        const pendingCount = nonCancel.filter((l) => l.outcome === 'pending').length;
        const lineCountActive = nonCancel.length;
        const netLoss = g.slotEnded && totalStake > totalPayout ? totalStake - totalPayout : 0;
        const firstCreated = lines[0]?.createdAt;
        const createdMs = firstCreated ? new Date(firstCreated).getTime() : Number.NaN;
        const isAdvanceDraw =
            Number.isFinite(createdMs) && Number.isFinite(slotStartMs) && slotStartMs - createdMs > 60 * 1000;
        return {
            ...g,
            lines,
            cancelledCount,
            totalStake,
            totalPayout,
            winningLineCount,
            pendingCount,
            lineCountActive,
            netLoss,
            isAdvanceDraw,
            dateLabel: firstCreated ? new Date(firstCreated).toLocaleDateString('en-GB') : g.drawDate,
        };
    });
    out.sort((a, b) => {
        const ta = new Date(a.lines[0]?.createdAt || a.slotStartIso || 0).getTime();
        const tb = new Date(b.lines[0]?.createdAt || b.slotStartIso || 0).getTime();
        return tb - ta;
    });
    return out;
}
