export const GAME_INTERVAL_SECONDS = 15 * 60;

export const generate3DResult = () => ({
  A: Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)),
  B: Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)),
  C: Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)),
});

export const getNextDrawTime = (now = new Date()) => {
  const d = new Date(now);
  const mins = d.getMinutes();
  d.setSeconds(0, 0);
  d.setMinutes(Math.floor(mins / 15) * 15 + 15);
  return d;
};

export const getSlotMeta = (now = new Date()) => {
  // 15-minute slot math drives both countdown and auto-result refresh.
  const mins = now.getMinutes();
  const secs = now.getSeconds();
  const elapsedInQuarter = (mins % 15) * 60 + secs;
  const remaining = GAME_INTERVAL_SECONDS - elapsedInQuarter;
  const slotStartMinute = Math.floor(mins / 15) * 15;
  const slotKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${slotStartMinute}`;
  return {
    remainingSeconds: remaining <= 0 ? GAME_INTERVAL_SECONDS : remaining,
    nextDraw: getNextDrawTime(now),
    slotKey,
  };
};

// Signature used by BOX (permutation-insensitive compare)
const digitsSignature = (num) => String(num).split('').sort().join('');
export const hasTwoSameDigits = (num) => new Set(String(num).split('')).size === 2;
export const hasAllSameDigits = (num) => new Set(String(num).split('')).size === 1;
export const hasAllUniqueDigits = (num) => new Set(String(num).split('')).size === 3;
const normalize3Digit = (value) =>
  String(value ?? '')
    .replace(/\D/g, '')
    .slice(-3)
    .padStart(3, '0');

const normalizeMode = (mode) => {
  const m = String(mode || '').toLowerCase();
  if (m === 'all') return 'single';
  if (m === 'str') return 'single';
  if (m === 'dp') return 'duplicates';
  if (m === 'tp') return 'triples';
  return m;
};

export const validateBetForMode = (betNum, modeRaw) => {
  const mode = normalizeMode(modeRaw);
  const normalizedBet = normalize3Digit(betNum);
  if (!/^\d{3}$/.test(normalizedBet)) {
    return { valid: false, reason: 'Number must be exactly 3 digits' };
  }
  if (mode === 'sp' && !hasAllUniqueDigits(normalizedBet)) {
    return { valid: false, reason: 'SP requires all 3 digits to be unique' };
  }
  if (mode === 'duplicates' && !hasTwoSameDigits(normalizedBet)) {
    return { valid: false, reason: 'DP requires exactly two digits to be same' };
  }
  if (mode === 'triples' && !hasAllSameDigits(normalizedBet)) {
    return { valid: false, reason: 'TP requires all 3 digits to be same' };
  }
  return { valid: true, reason: '' };
};

export const evaluateModeAgainstResult = (modeRaw, betNumRaw, resultNumRaw) => {
  const mode = normalizeMode(modeRaw);
  const betNum = normalize3Digit(betNumRaw);
  const resultNum = normalize3Digit(resultNumRaw);
  if (!/^\d{3}$/.test(betNum) || !/^\d{3}$/.test(resultNum)) {
    return { matched: false, reason: 'invalid bet/result format' };
  }
  const frontPair = betNum[0] === resultNum[0] && betNum[1] === resultNum[1];
  const backPair = betNum[1] === resultNum[1] && betNum[2] === resultNum[2];
  const outerPair = betNum[0] === resultNum[0] && betNum[2] === resultNum[2];

  if (mode === 'single') {
    const matched = betNum === resultNum;
    return { matched, reason: matched ? `exact match (${resultNum})` : 'exact number did not match' };
  }
  if (mode === 'box') {
    const matched = digitsSignature(betNum) === digitsSignature(resultNum);
    return { matched, reason: matched ? `matched permutation with ${resultNum}` : 'no permutation matched' };
  }
  if (mode === 'fp') {
    return { matched: frontPair, reason: frontPair ? `first two digits matched (${resultNum.slice(0, 2)})` : 'first two digits did not match' };
  }
  if (mode === 'bp') {
    return { matched: backPair, reason: backPair ? `last two digits matched (${resultNum.slice(1)})` : 'last two digits did not match' };
  }
  if (mode === 'ap') {
    // AP = any two-digit pair match, position independent.
    const getPairs = (num) => {
      const d = normalize3Digit(num);
      return [
        `${d[0]}${d[1]}`,
        `${d[1]}${d[2]}`,
        `${d[0]}${d[2]}`,
      ].map((p) => p.split('').sort().join(''));
    };
    const betPairs = getPairs(betNum);
    const resultPairs = getPairs(resultNum);
    const matchedPair = betPairs.find((p) => resultPairs.includes(p));
    if (!matchedPair) return { matched: false, reason: 'no pair matched (position independent)' };
    return { matched: true, reason: `pair ${matchedPair} matched with ${resultNum}` };
  }
  if (mode === 'sp') {
    if (!hasAllUniqueDigits(betNum)) return { matched: false, reason: 'SP invalid: digits are not unique' };
    if (!hasAllUniqueDigits(resultNum)) return { matched: false, reason: 'SP result invalid: digits are not unique' };
    const matched = betNum === resultNum;
    return { matched, reason: matched ? `SP exact match with ${resultNum}` : 'SP exact match not found' };
  }
  if (mode === 'duplicates') {
    if (!hasTwoSameDigits(betNum)) return { matched: false, reason: 'DP invalid: exactly two digits must be same' };
    if (!hasTwoSameDigits(resultNum)) return { matched: false, reason: 'DP result invalid: exactly two digits must be same' };
    const matched = betNum === resultNum;
    return { matched, reason: matched ? `DP exact match with ${resultNum}` : 'DP exact match not found' };
  }
  if (mode === 'triples') {
    if (!hasAllSameDigits(betNum)) return { matched: false, reason: 'TP invalid: all three digits must be same' };
    if (!hasAllSameDigits(resultNum)) return { matched: false, reason: 'TP result invalid: all three digits must be same' };
    const matched = betNum === resultNum;
    return { matched, reason: matched ? `TP exact match with ${resultNum}` : 'TP exact match not found' };
  }
  return { matched: false, reason: `Unknown mode: ${modeRaw}` };
};

export const matchBet = (bet, results, options = {}) => {
  const mode = normalizeMode(bet.mode);
  const betNum = normalize3Digit(bet.number);
  const validation = validateBetForMode(betNum, mode);
  if (!validation.valid) {
    return {
      won: false,
      matchedPanel: null,
      matchedResult: null,
      matchReason: validation.reason,
      matchedPanels: [],
    };
  }

  // If bet.panels exists (e.g. "A,B"), evaluate only those panels; else default A/B/C.
  const panelOrder = ['A', 'B', 'C'];
  const selectedPanelsRaw = String(bet.panels || '')
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const hasAll = selectedPanelsRaw.includes('ALL');
  const selectedPanels = selectedPanelsRaw.filter((p) => panelOrder.includes(p));
  const panelsToCheck = hasAll || !selectedPanels.length ? panelOrder : selectedPanels;

  const entries = panelsToCheck.map((panel) => ({
    panel,
    num: normalize3Digit(Array.isArray(results?.[panel]) ? results[panel].join('') : results?.[panel]),
  }));

  const matches = [];
  for (const entry of entries) {
    const evalResult = evaluateModeAgainstResult(mode, betNum, entry.num);
    if (evalResult.matched) {
      matches.push({
        panel: entry.panel,
        result: entry.num,
        reason: `${evalResult.reason} on Panel ${entry.panel}`,
      });
      if (!options.returnAllMatches) {
        return {
          won: true,
          matchedPanel: entry.panel,
          matchedResult: entry.num,
          matchReason: `${evalResult.reason} on Panel ${entry.panel}`,
          matchedPanels: [entry.panel],
        };
      }
    }
  }

  if (matches.length) {
    return {
      won: true,
      matchedPanel: matches[0].panel,
      matchedResult: matches[0].result,
      matchReason: matches[0].reason,
      matchedPanels: matches.map((m) => m.panel),
      allMatches: matches,
    };
  }

  const firstFail = evaluateModeAgainstResult(mode, betNum, entries[0]?.num || '000');
  return {
    won: false,
    matchedPanel: null,
    matchedResult: null,
    matchReason: `No match found (${firstFail.reason})`,
    matchedPanels: [],
  };
};

export const checkWinningBets = (bets, results) => {
  // Evaluate each bet against current draw and annotate the row with outcome.
  let totalWinPoints = 0;
  let totalLossPoints = 0;
  const updatedBets = bets.map((bet) => {
    const evaluation = matchBet(bet, results);
    if (evaluation.won) totalWinPoints += Number(bet.points || 0);
    else totalLossPoints += Number(bet.points || 0);
    return {
      ...bet,
      outcome: evaluation.won ? 'win' : 'loss',
      matchedPanel: evaluation.matchedPanel,
      matchedResult: evaluation.matchedResult,
      matchReason: evaluation.matchReason,
    };
  });
  return { updatedBets, totalWinPoints, totalLossPoints };
};

export const testCases = [
  { mode: 'single', bet: '123', result: '123', expected: true },
  { mode: 'single', bet: '123', result: '132', expected: false },
  { mode: 'str', bet: '123', result: '123', expected: true },
  { mode: 'box', bet: '123', result: '321', expected: true },
  { mode: 'box', bet: '123', result: '124', expected: false },
  { mode: 'fp', bet: '123', result: '129', expected: true },
  { mode: 'fp', bet: '123', result: '213', expected: false },
  { mode: 'bp', bet: '123', result: '923', expected: true },
  { mode: 'bp', bet: '123', result: '132', expected: false },
  { mode: 'ap', bet: '123', result: '129', expected: true },
  { mode: 'ap', bet: '123', result: '923', expected: true },
  { mode: 'ap', bet: '123', result: '153', expected: true },
  { mode: 'ap', bet: '123', result: '456', expected: false },
  { mode: 'sp', bet: '123', result: '123', expected: true },
  { mode: 'sp', bet: '123', result: '321', expected: false },
  { mode: 'sp', bet: '121', result: '121', expected: false },
  { mode: 'duplicates', bet: '112', result: '112', expected: true },
  { mode: 'duplicates', bet: '121', result: '121', expected: true },
  { mode: 'duplicates', bet: '123', result: '123', expected: false },
  { mode: 'duplicates', bet: '111', result: '111', expected: false },
  { mode: 'triples', bet: '111', result: '111', expected: true },
  { mode: 'triples', bet: '777', result: '777', expected: true },
  { mode: 'triples', bet: '112', result: '112', expected: false },
];

// Dedicated STR/ SP verification packs (kept separate for focused audits).
export const strTestCases = [
  { mode: 'str', bet: '123', result: '123', expected: true },
  { mode: 'str', bet: '123', result: '132', expected: false },
  { mode: 'str', bet: '121', result: '121', expected: true },
  { mode: 'str', bet: '111', result: '111', expected: true },
  { mode: 'str', bet: '111', result: '112', expected: false },
];

export const spTestCases = [
  { mode: 'sp', bet: '123', result: '123', expected: true },
  { mode: 'sp', bet: '123', result: '321', expected: false },
  { mode: 'sp', bet: '123', result: '112', expected: false },
  { mode: 'sp', bet: '456', result: '456', expected: true },
  { mode: 'sp', bet: '121', result: '121', expected: false },
  { mode: 'sp', bet: '111', result: '111', expected: false },
];

export const runStrSpSelfTest = () => {
  const all = [...strTestCases, ...spTestCases];
  const failedCases = [];
  let passed = 0;
  all.forEach((tc) => {
    const actual = evaluateModeAgainstResult(tc.mode, tc.bet, tc.result).matched;
    if (actual === tc.expected) passed += 1;
    else failedCases.push({ ...tc, actual });
  });
  return {
    total: all.length,
    passed,
    failed: failedCases.length,
    failedCases,
  };
};

export const runLogicSelfTest = () => {
  const failedCases = [];
  let passed = 0;
  testCases.forEach((tc) => {
    const actual = evaluateModeAgainstResult(tc.mode, tc.bet, tc.result).matched;
    if (actual === tc.expected) {
      passed += 1;
    } else {
      failedCases.push({
        ...tc,
        actual,
      });
    }
  });
  return {
    total: testCases.length,
    passed,
    failed: failedCases.length,
    failedCases,
  };
};

export const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
