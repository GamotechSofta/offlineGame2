import Quiz from '../models/quiz/Quiz.js';

const THREE_D_QUESTION_COUNT = 1000;
const ensuredQuizIds = new Set();

const pad3 = (n) => String(n).padStart(3, '0');

function buildSynthetic3DQuestion(index) {
  const n = index % 1000;
  const vA = pad3(n);
  const vB = pad3((n + 1) % 1000);
  const vC = pad3((n + 2) % 1000);
  const vD = pad3((n + 3) % 1000);
  return {
    id: `q${pad3(index)}`,
    questionNo: pad3(index),
    question: `3D Question ${pad3(index)}`,
    options: { A: vA, B: vB, C: vC, D: vD },
    answer: 'A',
  };
}

/**
 * Ensures 3D quiz has 1000 questions (000..999). If missing/short, auto-seeds.
 * 2D is intentionally untouched.
 */
export async function ensure3DQuizQuestionBank(quizId) {
  const qid = Number(quizId);
  if (!Number.isInteger(qid) || qid < 1 || qid > 3) {
    throw new Error('INVALID_QUIZ_ID');
  }

  const cacheKey = `${qid}`;
  if (ensuredQuizIds.has(cacheKey)) {
    return Quiz.findOne({ gameMode: '3d', quizId: qid }).lean();
  }

  let quiz = await Quiz.findOne({ gameMode: '3d', quizId: qid });
  if (!quiz) {
    quiz = await Quiz.create({
      gameMode: '3d',
      quizId: qid,
      version: 1,
      questions: Array.from({ length: THREE_D_QUESTION_COUNT }, (_, i) => buildSynthetic3DQuestion(i)),
    });
    ensuredQuizIds.add(cacheKey);
    return quiz.toObject();
  }

  const rows = Array.isArray(quiz.questions) ? [...quiz.questions] : [];
  if (rows.length < THREE_D_QUESTION_COUNT) {
    for (let i = rows.length; i < THREE_D_QUESTION_COUNT; i += 1) {
      rows.push(buildSynthetic3DQuestion(i));
    }
    quiz.questions = rows;
    quiz.version = Number.isFinite(Number(quiz.version)) ? Number(quiz.version) + 1 : 1;
    await quiz.save();
  }

  ensuredQuizIds.add(cacheKey);
  return quiz.toObject();
}

