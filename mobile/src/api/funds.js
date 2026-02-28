import { API_BASE_URL, getAuthHeaders, fetchWithAuth } from '../config/api';
import { getUserCache } from '../config/storage';

function requireUser() {
  const user = getUserCache();
  if (!user?.id && !user?._id) return null;
  return user;
}

export async function getPaymentsConfig() {
  try {
    const res = await fetch(`${API_BASE_URL}/payments/config`);
    const data = await res.json();
    return data?.success ? { success: true, data: data.data } : { success: false, message: data.message || 'Failed' };
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function getBankDetails() {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/bank-details`, { headers: getAuthHeaders() });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data?.success ? { success: true, data: data.data || [] } : { success: false, message: data.message || 'Failed' };
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function createBankDetail(body) {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/bank-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function updateBankDetail(id, body) {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/bank-details/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function deleteBankDetail(id) {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/bank-details/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function getMyDeposits() {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/payments/my-deposits`, { headers: getAuthHeaders() });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data?.success ? { success: true, data: data.data || [] } : { success: false, message: data.message || 'Failed' };
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function getMyWithdrawals() {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/payments/my-withdrawals`, { headers: getAuthHeaders() });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data?.success ? { success: true, data: data.data || [] } : { success: false, message: data.message || 'Failed' };
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function submitDeposit(formData) {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/payments/deposit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}

export async function submitWithdraw(payload) {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/payments/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return { success: false, message: 'Session expired.' };
    const data = await res.json();
    return data;
  } catch (e) {
    return { success: false, message: e?.message || 'Network error' };
  }
}
