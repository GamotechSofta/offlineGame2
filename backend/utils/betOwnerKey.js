/**
 * Stable owner id for quiz guesses and lottery board bets (logged-in or quizSid session).
 */
export function getBetOwnerKey(req) {
  if (req.userId) return `u:${req.userId}`;
  return `s:${req.quizSessionId || 'na'}`;
}
