// Mock data for the lottery application

export const QUIZ_GROUPS = [
  {
    setName: 'Set A',
    start: 1,
    end: 10
  },
  {
    setName: 'Set B', 
    start: 11,
    end: 20
  },
  {
    setName: 'Set C',
    start: 21,
    end: 30
  }
];

export const RESULT_HISTORY = [
  {
    id: 1,
    quizNumber: 1,
    result: [2, 15, 28, 33, 47, 59],
    timestamp: '2024-01-15 14:30:00',
    prize: 'First Prize'
  },
  {
    id: 2,
    quizNumber: 2,
    result: [8, 12, 23, 36, 41, 55],
    timestamp: '2024-01-15 15:00:00',
    prize: 'Second Prize'
  },
  {
    id: 3,
    quizNumber: 3,
    result: [5, 18, 27, 32, 46, 58],
    timestamp: '2024-01-15 15:30:00',
    prize: 'Third Prize'
  },
  {
    id: 4,
    quizNumber: 4,
    result: [1, 14, 29, 34, 49, 57],
    timestamp: '2024-01-15 16:00:00',
    prize: 'Consolation'
  },
  {
    id: 5,
    quizNumber: 5,
    result: [7, 16, 25, 38, 43, 56],
    timestamp: '2024-01-15 16:30:00',
    prize: 'First Prize'
  }
];
