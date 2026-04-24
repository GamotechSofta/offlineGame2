import { API_BASE_URL, getAuthHeaders } from '../config/api';

const base = `${API_BASE_URL}/quiz`;

const cred = { credentials: 'include' };

export async function getQuizSlot() {
  const res = await fetch(`${base}/slot`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export async function getQuizSettings(mode = '2d') {
  const res = await fetch(`${base}/settings?mode=${encodeURIComponent(mode)}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export async function getQuizQuestions(quizId, mode = '2d') {
  const res = await fetch(`${base}/questions/${quizId}?mode=${encodeURIComponent(mode)}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export async function getQuizHint(quizId, mode = '2d') {
  const res = await fetch(`${base}/hint/${quizId}?mode=${encodeURIComponent(mode)}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

/** @param {number} quizId @param {{ number: number, amount: number }[]} bets */
export async function postQuizBet(quizId, bets, mode = '2d') {
  const res = await fetch(`${base}/bet`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ quizId, bets, mode }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

/** @param {{ quizId: number, bets: { number: number, amount: number }[] }[]} rounds */
export async function postQuizBetsBatch(rounds, mode = '2d', options = {}) {
  const slotStartIso = typeof options?.slotStartIso === 'string' ? options.slotStartIso.trim() : '';
  const res = await fetch(`${base}/bet-batch`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ rounds, mode, ...(slotStartIso ? { slotStartIso } : {}) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function getQuizSlotResults(limit = 20, mode = '2d') {
  const q = new URLSearchParams({
    limit: String(limit),
    mode: String(mode || '2d'),
  });
  const res = await fetch(`${base}/slot-results?${q}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

/** IST calendar YYYY-MM-DD — persisted hintPosition only (GET /quiz/slot-results?date=). */
export async function getQuizSlotResultsForDate(date, maxSlots, mode = '2d') {
  const q = new URLSearchParams({ date, mode: String(mode || '2d') });
  if (maxSlots != null) q.set('maxSlots', String(maxSlots));
  const res = await fetch(`${base}/slot-results?${q}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function postBoardBet(slotStartIso, stakes) {
  const res = await fetch(`${base}/board-bet`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotStartIso, stakes }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function getMyBoardBets(limit = 30) {
  const res = await fetch(`${base}/my-board-bets?limit=${encodeURIComponent(String(limit))}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

/** Wallet quiz tickets (requires Bearer token). */
export async function getMyQuizBets(limit = 120, mode = '2d') {
  const res = await fetch(`${base}/my-quiz-bets?limit=${encodeURIComponent(String(limit))}&mode=${encodeURIComponent(mode)}`, {
    ...cred,
    headers: { ...getAuthHeaders() },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json;
}

/** Cancel one pending quiz ticket before the draw closes (wallet refund). */
export async function cancelMyQuizBet(betId, mode = '2d') {
  const res = await fetch(`${base}/my-quiz-bets/${encodeURIComponent(String(betId))}?mode=${encodeURIComponent(mode)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { ...getAuthHeaders() },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = json.code;
    throw err;
  }
  return json;
}

export async function getQuizResult(quizId, slotStartIso, mode = '2d') {
  const params = new URLSearchParams();
  if (slotStartIso) params.set('slotStartIso', slotStartIso);
  params.set('mode', mode);
  const q = `?${params.toString()}`;
  const res = await fetch(`${base}/result/${quizId}${q}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || `HTTP ${res.status}`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json;
}
