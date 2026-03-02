import { API_BASE_URL, getAuthHeaders, fetchWithAuth } from '../config/api';
import { getUserCache } from '../config/storage';

function requireUser() {
  const user = getUserCache();
  if (!user?.id && !user?._id) return null;
  return user;
}

/**
 * Submit a help-desk ticket (from frontend SupportNew.jsx).
 * @param {{ subject: string, description: string, screenshots?: Array<{ uri: string, name?: string, type?: string }> }} payload
 */
export async function submitTicket(payload) {
  if (!requireUser()) return { success: false, message: 'Please log in' };
  const { subject, description, screenshots = [] } = payload;
  try {
    const formData = new FormData();
    formData.append('subject', (subject || 'Support Request').trim());
    formData.append('description', (description || '').trim());
    (screenshots || []).slice(0, 5).forEach((file, i) => {
      formData.append('screenshots', {
        uri: file.uri,
        name: file.name || `image_${i}_${Date.now()}.jpg`,
        type: file.type || 'image/jpeg',
      });
    });

    // Do not set Content-Type so fetch sets multipart/form-data with boundary
    const res = await fetchWithAuth(`${API_BASE_URL}/help-desk/tickets`, {
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

/**
 * Fetch current user's tickets (from frontend SupportStatus.jsx).
 */
export async function getMyTickets() {
  if (!requireUser()) return { success: false, message: 'Please log in', data: [] };
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/help-desk/my-tickets`, { headers: getAuthHeaders() });
    if (res.status === 401) return { success: false, message: 'Session expired.', data: [] };
    const data = await res.json();
    return data?.success ? { success: true, data: data.data || [] } : { success: false, message: data.message || 'Failed', data: [] };
  } catch (e) {
    return { success: false, message: e?.message || 'Network error', data: [] };
  }
}
