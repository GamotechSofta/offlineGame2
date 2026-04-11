/**
 * Client-side verification: SHA-256 over 32-byte seed (from server hex) → hex digest.
 * Must match server rule: buildSeedHashHex in backend randomService.js
 */
export async function sha256HexOfSeedBytes(seedHex) {
  const clean = String(seedHex || '').replace(/\s+/g, '');
  if (!/^[a-fA-F0-9]{64}$/.test(clean)) {
    throw new Error('Seed must be 64 hex characters');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyFairness(seedHex, expectedSeedHashHex) {
  const computed = await sha256HexOfSeedBytes(seedHex);
  const exp = String(expectedSeedHashHex || '').toLowerCase();
  return computed.toLowerCase() === exp.toLowerCase();
}
