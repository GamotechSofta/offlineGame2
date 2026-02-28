import { API_BASE_URL, getAuthHeaders, fetchWithAuth } from '../config/api';
import { getUserCache, setUserCache, setItem } from '../config/storage';

const VALID_OBJECTID = /^[a-fA-F0-9]{24}$/;
function toObjectIdString(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'object' && v?.$oid) return String(v.$oid).trim() || null;
  try {
    const s = String(v).trim();
    return s || null;
  } catch {
    return null;
  }
}
function isValidObjectId(id) {
  const s = toObjectIdString(id);
  return s != null && VALID_OBJECTID.test(s);
}

export async function updateUserBalance(newBalance) {
  const user = getUserCache();
  if (!user) return;
  const updated = { ...user, balance: newBalance, walletBalance: newBalance };
  setUserCache(updated);
  try {
    await setItem('user', JSON.stringify(updated));
  } catch (_) {}
}

export async function placeBet(marketId, bets, scheduledDate = null) {
  const user = getUserCache();
  const rawUserId = user?.id || user?._id;
  if (!rawUserId) {
    return { success: false, message: 'Please log in to place a bet' };
  }
  const userId = toObjectIdString(rawUserId);
  if (!isValidObjectId(userId)) {
    return { success: false, message: 'Session invalid. Please log in again.' };
  }

  const normalizedMarketId = toObjectIdString(marketId ?? user?.marketId);
  if (!normalizedMarketId || !isValidObjectId(normalizedMarketId)) {
    return { success: false, message: 'This market is not available for betting. Please go back and select a market from the list.' };
  }

  const normalizeBetOn = (v) => {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return undefined;
    if (s === 'open') return 'open';
    if (s === 'close' || s === 'closed') return 'close';
    if (s === 'openbet') return 'open';
    if (s === 'closebet') return 'close';
    return undefined;
  };

  const totalAmount = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  if (totalAmount <= 0) {
    return { success: false, message: 'Total bet amount must be greater than 0' };
  }

  for (const b of bets) {
    const amount = Number(b.amount) || 0;
    if (amount <= 0) {
      return { success: false, message: 'Each bet amount must be greater than 0' };
    }
    if (amount > 1000000) {
      return { success: false, message: 'Bet amount cannot exceed ₹10,00,000' };
    }
    if (!b.betNumber || String(b.betNumber).trim() === '') {
      return { success: false, message: 'Bet number is required for all bets' };
    }
  }

  const payload = {
    userId,
    marketId: normalizedMarketId,
    bets: bets.map((b) => ({
      betType: b.betType,
      betNumber: String(b.betNumber).trim(),
      amount: Number(b.amount) || 0,
      betOn: normalizeBetOn(b.betOn) || normalizeBetOn(b.session) || normalizeBetOn(b.type),
    })),
  };

  if (scheduledDate) payload.scheduledDate = scheduledDate;

  const response = await fetchWithAuth(`${API_BASE_URL}/bets/place`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) return { success: false, message: 'Session expired. Please log in again.' };
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to place bet' };
  }
  return data;
}

export async function getRatesCurrent() {
  const response = await fetch(`${API_BASE_URL}/rates/current`);
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to fetch rates' };
  }
  return data;
}

export async function getBalance() {
  const user = getUserCache();
  if (!user?.id && !user?._id) {
    return { success: false, message: 'Please log in' };
  }
  const response = await fetchWithAuth(`${API_BASE_URL}/wallet/balance`, {
    headers: getAuthHeaders(),
  });
  if (response.status === 401) return { success: false, message: 'Session expired.' };
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to fetch balance' };
  }
  return data;
}

export async function getMyWalletTransactions(limit = 200) {
  const user = getUserCache();
  if (!user?.id && !user?._id) {
    return { success: false, message: 'Please log in' };
  }
  const url = `${API_BASE_URL}/wallet/my-transactions?limit=${encodeURIComponent(limit)}&includeBet=1`;
  const response = await fetchWithAuth(url, { headers: getAuthHeaders() });
  if (response.status === 401) return { success: false, message: 'Session expired.' };
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to fetch transactions' };
  }
  return data;
}

/**
 * Fetch bet history for the current user from backend.
 * @returns {Promise<{ success: boolean, data?: Array, message?: string }>}
 */
export async function getMarkets() {
  try {
    const res = await fetch(`${API_BASE_URL}/markets/get-markets`);
    const data = await res.json();
    if (data?.success && Array.isArray(data?.data)) return { success: true, data: data.data };
    return { success: false, message: data?.message || 'Failed', data: [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Network error', data: [] };
  }
}

export async function getBetHistory(params = {}) {
  const user = getUserCache();
  if (!user?.id && !user?._id) {
    return { success: false, message: 'Please log in' };
  }
  const q = new URLSearchParams();
  const uid = user?.id || user?._id;
  if (uid) q.append('userId', uid);
  if (params.startDate) q.append('startDate', params.startDate);
  if (params.endDate) q.append('endDate', params.endDate);
  const url = `${API_BASE_URL}/bets/history${q.toString() ? `?${q}` : ''}`;
  const response = await fetchWithAuth(url, { headers: getAuthHeaders() });
  if (response.status === 401) return { success: false, message: 'Session expired.' };
  const data = await response.json();
  if (!response.ok) {
    return { success: false, message: data.message || 'Failed to fetch bet history' };
  }
  return data;
}
