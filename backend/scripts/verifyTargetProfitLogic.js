/**
 * Run: node scripts/verifyTargetProfitLogic.js
 * Pure logic checks (no DB). Exit 0 = all pass.
 */
import { verifyTargetProfitSelectionLogic } from '../services/quizTargetProfitService.js';

const result = verifyTargetProfitSelectionLogic();
for (const check of result.checks) {
  const mark = check.ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${check.name}  (${check.detail})`);
}
if (!result.ok) {
  console.error('\nSome checks failed.');
  process.exit(1);
}
console.log('\nAll target-profit selection checks passed (2D/3D share this logic).');
