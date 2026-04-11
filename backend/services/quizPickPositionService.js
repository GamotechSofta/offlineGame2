import { getShuffleOrderIndices } from './quizShuffleService.js';

/**
 * Winning cell for the quiz board / study list: shuffled position 0..99.
 * Prefers persisted hintPosition; otherwise derives from permutation + chosenIndex (legacy rows).
 */
export async function resolveWinningShuffledPosition(quizId, slotStartIso, pick) {
  if (
    pick?.hintPosition != null &&
    Number.isInteger(pick.hintPosition) &&
    pick.hintPosition >= 0 &&
    pick.hintPosition <= 99
  ) {
    return pick.hintPosition;
  }
  if (!pick?.seedHex || pick.chosenIndex == null || !Number.isInteger(pick.chosenIndex)) {
    throw new Error('PICK_POSITION_UNRESOLVABLE');
  }
  const order = await getShuffleOrderIndices(quizId, slotStartIso, pick.seedHex);
  const pos = order.indexOf(pick.chosenIndex);
  if (pos < 0) {
    throw new Error('PICK_ORDER_MISMATCH');
  }
  return pos;
}
