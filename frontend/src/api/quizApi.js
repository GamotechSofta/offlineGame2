import { API_BASE_URL, getAuthHeaders } from '../config/api';

const base = `${API_BASE_URL}/quiz`;

const cred = { credentials: 'include' };

export async function getQuizSlot() {
  const res = await fetch(`${base}/slot`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export async function getQuizQuestions(quizId) {
  const res = await fetch(`${base}/questions/${quizId}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export async function getQuizHint(quizId) {
  const res = await fetch(`${base}/hint/${quizId}`, cred);
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
export async function postQuizBet(quizId, bets) {
  const res = await fetch(`${base}/bet`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ quizId, bets }),
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
export async function postQuizBetsBatch(rounds) {
  const res = await fetch(`${base}/bet-batch`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ rounds }),
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

export async function getQuizSlotResults(limit = 20) {
  const res = await fetch(`${base}/slot-results?limit=${encodeURIComponent(String(limit))}`, cred);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

/** IST calendar YYYY-MM-DD — persisted hintPosition only (GET /quiz/slot-results?date=). */
export async function getQuizSlotResultsForDate(date, maxSlots) {
  const q = new URLSearchParams({ date });
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
export async function getMyQuizBets(limit = 120) {
  const res = await fetch(`${base}/my-quiz-bets?limit=${encodeURIComponent(String(limit))}`, {
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

export async function getQuizResult(quizId, slotStartIso) {
  const q = slotStartIso ? `?slotStartIso=${encodeURIComponent(slotStartIso)}` : '';
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
