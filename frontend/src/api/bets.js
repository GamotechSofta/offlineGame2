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
 * @returns {Promise<{ success: boolean, data?: { newBalance: number }, message?: string }>}
 */
export async function placeBet(marketId, bets) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = user?.id || user?._id;
  if (!userId) {
    return { success: false, message: 'Please log in to place a bet' };
  }

  const response = await fetch(`${API_BASE_URL}/bets/place`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      marketId,
      bets: bets.map((b) => ({
        betType: b.betType,
        betNumber: String(b.betNumber).trim(),
        amount: Number(b.amount) || 0,
      })),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to place bet' };
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
