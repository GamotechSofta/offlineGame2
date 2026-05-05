import { FILTER_TYPES } from '../types';

/** Two-digit string for integers 0–99 (e.g. 7 → "07"). */
export const pad2 = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return '00';
  return String(Math.trunc(x)).padStart(2, '0');
};

export const formatQuizNumber = (num) => String(num).padStart(2, '0');

export const quizLabel = (num) => `Quiz${formatQuizNumber(num)}`;

export const quizPrefix = (num) => `Q${formatQuizNumber(num)}`;

export const getBoardNumbers = () => Array.from({ length: 100 }, (_, i) => i);

export const getCellKey = (quizNum, num) => `${quizNum}-${num}`;

export const applyFilterNumbers = (filterType) => {
  const all = getBoardNumbers();
  if (filterType === FILTER_TYPES.EVEN) return all.filter((n) => n % 2 === 0);
  if (filterType === FILTER_TYPES.ODD) return all.filter((n) => n % 2 !== 0);
  return all;
};

export const getFamilyNumbers = (num) => {
  const n = Number(num);
  if (!Number.isInteger(n) || n < 0 || n > 99) return new Set();
  const a = Math.floor(n / 10);
  const b = n % 10;
  const famA = [a, (a + 5) % 10];
  const famB = [b, (b + 5) % 10];
  const result = new Set();
  for (const x of famA) {
    for (const y of famB) {
      result.add(`${x}${y}`);
      result.add(`${y}${x}`);
    }
  }
  return result;
};

export const getTotals = (selectedMap) => {
  const values = Object.values(selectedMap);
  const count = values.length;
  const totalAmount = values.reduce((sum, val) => sum + Number(val || 0), 0);
  return { count, totalAmount };
};

export const getLotterySetTotals = (selectedMap) => {
  const totals = {
    setA: { count: 0, amount: 0 },
    setB: { count: 0, amount: 0 },
    setC: { count: 0, amount: 0 },
    totalAmount: 0,
  };

  Object.entries(selectedMap || {}).forEach(([key, value]) => {
    const amount = Number(value || 0);
    if (amount <= 0) return;
    const quizNo = Number(String(key).split('-')[0] || 0);
    if (quizNo >= 1 && quizNo <= 10) {
      totals.setA.count += 1;
      totals.setA.amount += amount;
    } else if (quizNo >= 11 && quizNo <= 20) {
      totals.setB.count += 1;
      totals.setB.amount += amount;
    } else if (quizNo >= 21 && quizNo <= 30) {
      totals.setC.count += 1;
      totals.setC.amount += amount;
    }
    totals.totalAmount += amount;
  });

  return totals;
};

export const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
