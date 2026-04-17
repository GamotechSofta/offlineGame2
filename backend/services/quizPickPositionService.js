import { getShuffleOrderIndices } from './quizShuffleService.js';

/**
 * Winning cell for the quiz board / study list.
 * 2D range: 0..99, 3D range: 0..999.
 * Prefers persisted hintPosition; otherwise derives from permutation + chosenIndex (legacy rows).
 */
export async function resolveWinningShuffledPosition(quizId, slotStartIso, pick, gameMode = '2d') {
  const maxPosition = gameMode === '3d' ? 999 : 99;
  if (
    pick?.hintPosition != null &&
    Number.isInteger(pick.hintPosition) &&
    pick.hintPosition >= 0 &&
    pick.hintPosition <= maxPosition
  ) {
    return pick.hintPosition;
  }
  if (!pick?.seedHex || pick.chosenIndex == null || !Number.isInteger(pick.chosenIndex)) {
    throw new Error('PICK_POSITION_UNRESOLVABLE');
  }
  const expectedLength = gameMode === '3d' ? 1000 : 100;
  const order = await getShuffleOrderIndices(quizId, slotStartIso, pick.seedHex, gameMode, expectedLength);
  const pos = order.indexOf(pick.chosenIndex);
  if (pos < 0) {
    throw new Error('PICK_ORDER_MISMATCH');
  }
  return pos;
}
