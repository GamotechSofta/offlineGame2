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

export const hasTwoSameDigits = (num) => new Set(String(num).split('')).size === 2;
export const hasAllSameDigits = (num) => new Set(String(num).split('')).size === 1;
export const hasAllUniqueDigits = (num) => new Set(String(num).split('')).size === 3;
const normalize3Digit = (value) => {
  const raw = String(value ?? '').trim();
  return /^\d{3}$/.test(raw) ? raw : null;
};
const digitsSignature = (num) => String(num).split('').sort().join('');
const getBoxType = (num) => {
  if (hasAllUniqueDigits(num)) return '6-way';
  if (hasTwoSameDigits(num)) return '3-way';
  return null;
};
const PAYOUT_TABLE = {
  str: 900,
  box_3: 300,
  box_6: 150,
  fp: 90,
  bp: 90,
  sp: 90,
  ap: 30,
};
// Kept for export compatibility. SP is now Split Pair, not cycle-based.
export const getSpCycleValue = (value) => {
  const digits = normalize3Digit(value);
  if (!digits) return null;
  return `${digits[0]}${digits[2]}`;
};
const getPayoutMultiplier = (mode, betNum, boxType) => {
  const normalizedMode = normalizeMode(mode);
  if (normalizedMode === 'str') return PAYOUT_TABLE.str;
  if (normalizedMode === 'box') {
    const resolvedBoxType = boxType || (betNum ? getBoxType(betNum) : null);
    if (resolvedBoxType === '3-way') return PAYOUT_TABLE.box_3;
    if (resolvedBoxType === '6-way') return PAYOUT_TABLE.box_6;
    return 0;
  }
  if (normalizedMode === 'fp') return PAYOUT_TABLE.fp;
  if (normalizedMode === 'bp') return PAYOUT_TABLE.bp;
  if (normalizedMode === 'sp') return PAYOUT_TABLE.sp;
  if (normalizedMode === 'ap') return PAYOUT_TABLE.ap;
  return 0;
};

const normalizeMode = (mode) => {
  const m = String(mode || '').toLowerCase();
  if (m === 'single') return 'str';
  return m;
};

export const validateBetForMode = (betNum, modeRaw) => {
  const mode = normalizeMode(modeRaw);
  const normalizedBet = normalize3Digit(betNum);
  if (!normalizedBet) {
    return { valid: false, reason: 'Number must be exactly 3 digits' };
  }
  if (mode === 'box') {
    const boxType = getBoxType(normalizedBet);
    if (!boxType) {
      return { valid: false, reason: 'BOX does not support triple numbers (e.g. 111)' };
    }
    return { valid: true, reason: '', boxType };
  }
  if (!['str', 'fp', 'bp', 'sp', 'ap'].includes(mode)) {
    return { valid: false, reason: `Unknown mode: ${modeRaw}` };
  }
  return { valid: true, reason: '' };
};

export const evaluateModeAgainstResult = (modeRaw, betNumRaw, resultNumRaw) => {
  const mode = normalizeMode(modeRaw);
  const betNum = normalize3Digit(betNumRaw);
  const resultNum = normalize3Digit(resultNumRaw);
  if (!betNum) return { matched: false, reason: 'invalid bet format (requires exactly 3 digits)' };
  if (!resultNum) return { matched: false, reason: 'invalid result format (requires exactly 3 digits)' };
  const frontPair = betNum[0] === resultNum[0] && betNum[1] === resultNum[1];
  const backPair = betNum[1] === resultNum[1] && betNum[2] === resultNum[2];
  const splitPair = betNum[0] === resultNum[0] && betNum[2] === resultNum[2];

  if (mode === 'str') {
    const matched = betNum === resultNum;
    return { matched, reason: matched ? `straight exact match (${resultNum})` : 'straight exact match not found' };
  }
  if (mode === 'box') {
    const boxType = getBoxType(betNum);
    if (!boxType) return { matched: false, reason: 'BOX bet must be 3-way or 6-way', boxType: null };
    const matched = digitsSignature(betNum) === digitsSignature(resultNum);
    return {
      matched,
      reason: matched ? `box ${boxType} matched permutation` : `box ${boxType} did not match`,
      boxType,
    };
  }
  if (mode === 'fp') {
    return { matched: frontPair, reason: frontPair ? `first two digits matched (${resultNum.slice(0, 2)})` : 'first two digits did not match' };
  }
  if (mode === 'bp') {
    return { matched: backPair, reason: backPair ? `last two digits matched (${resultNum.slice(1)})` : 'last two digits did not match' };
  }
  if (mode === 'sp') {
    return { matched: splitPair, reason: splitPair ? 'split pair matched' : 'split pair did not match' };
  }
  if (mode === 'ap') {
    if (frontPair) return { matched: true, reason: `front pair matched (${resultNum.slice(0, 2)})`, matchedPair: resultNum.slice(0, 2) };
    if (backPair) return { matched: true, reason: `back pair matched (${resultNum.slice(1)})`, matchedPair: resultNum.slice(1) };
    if (splitPair) return { matched: true, reason: 'split pair matched', matchedPair: `${resultNum[0]}${resultNum[2]}` };
    return { matched: false, reason: 'no position-based pair matched' };
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

  const entries = panelsToCheck
    .map((panel) => ({
      panel,
      num: normalize3Digit(Array.isArray(results?.[panel]) ? results[panel].join('') : results?.[panel]),
    }))
    .filter((entry) => entry.num != null);

  if (!entries.length) {
    return {
      won: false,
      matchedPanel: null,
      matchedResult: null,
      matchReason: 'No valid result panels available',
      matchedPanels: [],
    };
  }

  const matches = [];
  for (const entry of entries) {
    const evalResult = evaluateModeAgainstResult(mode, betNum, entry.num);
    if (evalResult.matched) {
      const displayResult =
        mode === 'fp'
          ? entry.num.slice(0, 2)
          : mode === 'bp'
            ? entry.num.slice(1)
            : mode === 'sp'
              ? `${entry.num[0]}${entry.num[2]}`
              : mode === 'ap'
                ? evalResult.matchedPair
              : entry.num;
      matches.push({
        panel: entry.panel,
        result: displayResult,
        reason: `${evalResult.reason} on Panel ${entry.panel}`,
        boxType: evalResult.boxType || null,
        mode,
        betNum,
      });
      if (!options.returnAllMatches) {
        return {
          won: true,
          matchedPanel: entry.panel,
          matchedResult: displayResult,
          matchReason: `${evalResult.reason} on Panel ${entry.panel}`,
          matchedPanels: [entry.panel],
          boxType: evalResult.boxType || null,
          mode,
          betNum,
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
      boxType: matches[0].boxType || null,
      mode,
      betNum,
      allMatches: matches,
    };
  }

  const firstFail = evaluateModeAgainstResult(mode, betNum, entries[0].num);
  return {
    won: false,
    matchedPanel: null,
    matchedResult: null,
    matchReason: `No match found (${firstFail.reason})`,
    matchedPanels: [],
    boxType: null,
    mode,
    betNum,
  };
};

export const settleAllBets = (bets, results) => {
  return bets.map((bet) => {
    const evaluation = matchBet(bet, results, { returnAllMatches: true });
    const points = Number(bet.points || 0);
    const multiplier = evaluation.won
      ? getPayoutMultiplier(
        evaluation.mode || bet.mode,
        evaluation.betNum || bet.number,
        evaluation.boxType,
      )
      : 0;
    const winAmount = evaluation.won ? points * multiplier : 0;
    const payoutLabel = evaluation.won ? `${points} x ${multiplier}` : null;
    return {
      ...bet,
      outcome: evaluation.won ? 'win' : 'loss',
      matchedPanel: evaluation.matchedPanel,
      matchedResult: evaluation.matchedResult,
      matchReason: evaluation.matchReason,
      winAmount,
      multiplier,
      payoutLabel,
    };
  });
};

export const calculateSettlementSummary = (bets) => {
  const totalBets = bets.length;
  const totalPoints = bets.reduce((sum, bet) => sum + Number(bet.points || 0), 0);
  const totalWinAmount = bets.reduce((sum, bet) => sum + Number(bet.winAmount || 0), 0);
  const totalLossAmount = bets.reduce((sum, bet) => (bet.outcome === 'loss' ? sum + Number(bet.points || 0) : sum), 0);
  const totalInvested = totalPoints;
  const netResult = totalWinAmount - totalInvested;
  return {
    totalBets,
    totalPoints,
    totalInvested,
    totalWinAmount,
    totalLossAmount,
    netResult,
  };
};

export const checkWinningBets = (bets, results) => {
  const updatedBets = settleAllBets(bets, results);
  const summary = calculateSettlementSummary(updatedBets);
  return {
    updatedBets,
    totalWinPoints: summary.totalWinAmount,
    totalLossPoints: summary.totalLossAmount,
    summary,
  };
};

export const testCases = [
  { mode: 'single', bet: '12', result: '123', expected: false },
  { mode: 'single', bet: '1234', result: '123', expected: false },
  { mode: 'single', bet: '123', result: '123', expected: true },
  { mode: 'single', bet: '112', result: '112', expected: true },
  { mode: 'single', bet: '111', result: '111', expected: true },
  { mode: 'single', bet: '123', result: '132', expected: false },
  { mode: 'str', bet: '123', result: '123', expected: true },
  { mode: 'box', bet: '123', result: '321', expected: true },
  { mode: 'box', bet: '112', result: '121', expected: true },
  { mode: 'box', bet: '111', result: '111', expected: false },
  { mode: 'box', bet: '123', result: '124', expected: false },
  { mode: 'fp', bet: '123', result: '129', expected: true },
  { mode: 'fp', bet: '123', result: '213', expected: false },
  { mode: 'bp', bet: '123', result: '923', expected: true },
  { mode: 'bp', bet: '123', result: '132', expected: false },
  { mode: 'sp', bet: '123', result: '153', expected: true },
  { mode: 'sp', bet: '123', result: '923', expected: false },
  { mode: 'ap', bet: '123', result: '129', expected: true },
  { mode: 'ap', bet: '123', result: '923', expected: true },
  { mode: 'ap', bet: '123', result: '153', expected: true },
  { mode: 'ap', bet: '123', result: '312', expected: false },
  { mode: 'ap', bet: '123', result: '456', expected: false },
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
  { mode: 'sp', bet: '123', result: '153', expected: true },
  { mode: 'sp', bet: '123', result: '129', expected: false },
  { mode: 'sp', bet: '777', result: '717', expected: true },
  { mode: 'sp', bet: '112', result: '102', expected: true },
  { mode: 'sp', bet: '123', result: '923', expected: false },
  { mode: 'sp', bet: '12', result: '123', expected: false },
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
