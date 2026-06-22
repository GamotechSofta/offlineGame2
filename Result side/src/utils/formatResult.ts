export type GameMode = '2d' | '3d'

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const pad3 = (n: number) => String(n).padStart(3, '0')

export const formatQuizResult = (quizId: number, result: number | null | undefined, mode: GameMode) => {
  const q = mode === '3d' ? String(quizId) : pad2(quizId)
  if (result == null || !Number.isInteger(result)) return `Q${q} —`
  return mode === '3d' ? `Q${q}-${pad3(result)}` : `Q${q}-${pad2(result)}`
}

export const formatResultDigits = (result: number | null | undefined, mode: GameMode) => {
  if (result == null || !Number.isInteger(result)) return '—'
  return mode === '3d' ? pad3(result) : pad2(result)
}
