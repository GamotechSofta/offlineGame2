/**
 * Validates :quizId route param — must be integer 1..30.
 */
export function validateQuizIdParam(req, res, next) {
  const quizId = parseInt(req.params.quizId, 10);
  if (Number.isNaN(quizId) || quizId < 1 || quizId > 30) {
    return res.status(400).json({ success: false, message: 'quizId must be 1–30' });
  }
  req.quizId = quizId;
  return next();
}
