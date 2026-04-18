import crypto from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  cancelMyQuizBet,
  getHint,
  getMyQuizBets,
  getQuestions,
  getResult,
  getSlot,
  postQuizBet,
  postQuizBetsBatch,
} from '../../controllers/quizController.js';
import { getSlotResultsHistory, postBoardBet, getMyBoardBets } from '../../controllers/lotteryBoardController.js';
import { validateQuizIdParam } from '../../middleware/quizIdParam.js';
import ensureQuizSession from '../../middleware/quizSession.js';
import { optionalUserQuiz } from '../../middleware/optionalUserQuiz.js';
import { verifyUser } from '../../middleware/userAuth.js';

const router = Router();

router.use(ensureQuizSession);
router.use(optionalUserQuiz);

const keyQuiz = (req) => {
  const ip = String(req.ip || '');
  const ua = String(req.headers['user-agent'] || '').slice(0, 400);
  const sid = String(req.quizSessionId || 'na');
  return crypto.createHash('sha256').update(`${ip}|${ua}|${sid}`, 'utf8').digest('hex').slice(0, 56);
};

const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyQuiz,
  message: { success: false, message: 'Too many quiz requests. Try again shortly.' },
});

const hintLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyQuiz,
  message: { success: false, message: 'Too many hint requests. Try again shortly.' },
});

const guessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyQuiz,
  message: { success: false, message: 'Too many guess submissions. Try again shortly.' },
});

router.get('/slot', quizLimiter, getSlot);
router.get('/slot-results', quizLimiter, getSlotResultsHistory);
router.get('/my-board-bets', quizLimiter, getMyBoardBets);
router.get('/my-quiz-bets', quizLimiter, verifyUser, getMyQuizBets);
router.delete('/my-quiz-bets/:betId', quizLimiter, verifyUser, cancelMyQuizBet);
router.post('/board-bet', guessLimiter, postBoardBet);
router.get('/questions/:quizId', quizLimiter, validateQuizIdParam, getQuestions);
router.get('/hint/:quizId', hintLimiter, validateQuizIdParam, getHint);
router.post('/bet', guessLimiter, verifyUser, postQuizBet);
router.post('/bet-batch', guessLimiter, verifyUser, postQuizBetsBatch);
router.get('/result/:quizId', quizLimiter, validateQuizIdParam, getResult);

export default router;
