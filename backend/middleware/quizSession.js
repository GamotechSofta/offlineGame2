import crypto from 'crypto';

const COOKIE = 'quizSid';
const HEX32 = /^[a-f0-9]{32}$/;

/**
 * Anonymous quiz session cookie (httpOnly) + req.quizSessionId for rate limits / guesses.
 */
export default function ensureQuizSession(req, res, next) {
  let sid = req.cookies?.[COOKIE];
  if (!sid || !HEX32.test(String(sid))) {
    sid = crypto.randomBytes(16).toString('hex');
    res.cookie(COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
  req.quizSessionId = String(sid);
  next();
}
