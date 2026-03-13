/**
 * Roulette RNG: returns a number 0-36 (European wheel).
 * Uniform over 37 outcomes — house edge comes from payouts (1/37), not from RNG manipulation.
 */
import crypto from 'crypto';

/** Spin the wheel. Returns integer 0-36 (European roulette). Each number has probability 1/37. */
export function spin() {
    return crypto.randomInt(0, 37);
}
