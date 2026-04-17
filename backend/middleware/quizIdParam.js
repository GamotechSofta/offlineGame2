/**
 * Validates :quizId route param.
 * 2D allows 1..30, 3D allows 1..3.
 */
export function validateQuizIdParam(req, res, next) {
  const quizId = parseInt(req.params.quizId, 10);
  const gameMode = String(req.query?.mode || req.body?.mode || '2d').toLowerCase() === '3d' ? '3d' : '2d';
  const maxQuizId = gameMode === '3d' ? 3 : 30;
  if (Number.isNaN(quizId) || quizId < 1 || quizId > maxQuizId) {
    return res.status(400).json({ success: false, message: `quizId must be 1–${maxQuizId}` });
  }
  req.quizId = quizId;
  return next();
}
