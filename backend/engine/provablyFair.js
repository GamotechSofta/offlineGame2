/**
 * Provably fair: server + client seed + nonce to HMAC then number 0-36.
 */
import crypto from 'crypto';

export function hashServerSeed(serverSeed) {
    return crypto.createHash('sha256').update(serverSeed, 'utf8').digest('hex');
}

export function getWinningNumberFromSeeds(serverSeed, clientSeed, nonce) {
    const message = clientSeed + ':' + nonce;
    const hmac = crypto.createHmac('sha256', serverSeed).update(message, 'utf8').digest();
    return hmac.readUInt32BE(0) % 37;
}

export function verifySpin(serverSeed, clientSeed, nonce, winningNumber) {
    return getWinningNumberFromSeeds(serverSeed, clientSeed, nonce) === winningNumber;
}
