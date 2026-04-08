import { FILTER_TYPES } from '../types';

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

export const getTotals = (selectedMap) => {
  const values = Object.values(selectedMap);
  const count = values.length;
  const totalAmount = values.reduce((sum, val) => sum + Number(val || 0), 0);
  return { count, totalAmount };
};

export const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};
