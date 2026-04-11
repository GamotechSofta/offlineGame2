/**
 * CLI: full reseed of quiz questions from backend/data/quizQuestions.mock.json
 * Run: npm run seed:quiz  (from backend folder)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db_Connection.js';
import { reseedQuizzesFromJsonFile } from '../services/seedService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  await connectDB();
  const { inserted, version } = await reseedQuizzesFromJsonFile();
  // eslint-disable-next-line no-console
  console.log(`Quiz reseed complete: ${inserted} quizzes, data version ${version}`);
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
