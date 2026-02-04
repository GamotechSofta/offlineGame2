import { API_BASE_URL } from '../config/api';

/**
 * Update stored user balance in localStorage and notify app (e.g. header wallet).
 */
export function updateUserBalance(newBalance) {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.balance = newBalance;
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('userLogin'));
  } catch (_) {}
}

/**
 * Place bets for the current user.
 * @param {string} marketId - Market _id
 * @param {Array<{ betType: string, betNumber: string, amount: number }>} bets
 * @param {string|null} scheduledDate - Optional scheduled date (ISO string format)
 * @returns {Promise<{ success: boolean, data?: { newBalance: number }, message?: string }>}
 */
export async function placeBet(marketId, bets, scheduledDate = null) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = user?.id || user?._id;
  if (!userId) {
    return { success: false, message: 'Please log in to place a bet' };
  }

  const payload = {
    userId,
    marketId,
    bets: bets.map((b) => ({
      betType: b.betType,
      betNumber: String(b.betNumber).trim(),
      amount: Number(b.amount) || 0,
    })),
  };

  if (scheduledDate) {
    payload.scheduledDate = scheduledDate;
  }

  const response = await fetch(`${API_BASE_URL}/bets/place`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to place bet' };
  }
  return data;
}

/**
 * Fetch current payout rates (single, jodi, singlePatti, etc.) for display.
 * Same rates used when settling wins (admin Update Rate screen).
 * @returns {Promise<{ success: boolean, data?: { single, jodi, singlePatti, ... }, message?: string }>}
 */
export async function getRatesCurrent() {
  const response = await fetch(`${API_BASE_URL}/rates/current`);
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to fetch rates' };
  }
  return data;
}

/**
 * Fetch current wallet balance for the logged-in user.
 * @returns {Promise<{ success: boolean, data?: { balance: number }, message?: string }>}
 */
export async function getBalance() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = user?.id || user?._id;
  if (!userId) {
    return { success: false, message: 'Please log in' };
  }
  const response = await fetch(`${API_BASE_URL}/wallet/balance?userId=${encodeURIComponent(userId)}`);
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to fetch balance' };
  }
  return data;
}
