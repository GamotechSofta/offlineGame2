import { API_BASE_URL, getBookieAuthHeaders } from '../../utils/api';

export const placeBetForPlayer = async (userId, marketId, bets, scheduledDate = null) => {
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
