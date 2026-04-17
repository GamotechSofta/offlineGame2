import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db_Connection.js';
import { ensure3DQuizQuestionBank } from '../services/quizQuestionBankService.js';

dotenv.config();

const seed3DQuizQuestions = async () => {
  try {
    await connectDB();

    const fromQuiz = Number.parseInt(process.argv[2] || '1', 10);
    const toQuiz = Number.parseInt(process.argv[3] || '3', 10);
    const start = Number.isInteger(fromQuiz) ? Math.max(1, fromQuiz) : 1;
    const end = Number.isInteger(toQuiz) ? Math.min(3, toQuiz) : 3;

    if (start > end) {
      throw new Error(`Invalid quiz range: ${start}..${end}`);
    }

    for (let quizId = start; quizId <= end; quizId += 1) {
      const quiz = await ensure3DQuizQuestionBank(quizId);
      const count = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
      // eslint-disable-next-line no-console
      console.log(`3D quiz ${String(quizId).padStart(2, '0')} => ${count} questions`);
    }

    // eslint-disable-next-line no-console
    console.log(`Done. Seeded/verified 3D quizzes ${start}..${end} for 000-999.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('3D quiz seeding failed:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seed3DQuizQuestions();

