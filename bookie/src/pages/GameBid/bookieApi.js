import { API_BASE_URL, getBookieAuthHeaders } from '../../utils/api';

export const placeBetForPlayer = async (userId, marketId, bets, scheduledDate = null) => {
    if (!Array.isArray(bets) || bets.length === 0) {
        return { success: false, message: 'No bets to place' };
    }
    for (const b of bets) {
        const betType = (b.betType ?? '').toString().trim();
        const betNumber = (b.betNumber ?? '').toString().trim();
        const amount = Number(b.amount);
        if (!betType || !betNumber || !Number.isFinite(amount) || amount <= 0) {
            return { success: false, message: 'Each bet must have betType, betNumber and amount > 0' };
        }
    }

    const body = { userId, marketId, bets };
    if (scheduledDate) body.scheduledDate = scheduledDate;

    const res = await fetch(`${API_BASE_URL}/bets/place-for-player`, {
        method: 'POST',
        headers: getBookieAuthHeaders(),
        body: JSON.stringify(body),
    });
    return await res.json();
};

export const fetchPlayers = async () => {
    const res = await fetch(`${API_BASE_URL}/users`, { headers: getBookieAuthHeaders() });
    const data = await res.json();
    return data.success ? (data.data || []) : [];
};
