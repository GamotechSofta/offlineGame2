import type { GameMode } from '../utils/formatResult'

export type QuizGroup = {
  setName: string
  label: string
  start: number
  end: number
  accent: string
  headerBg: string
  cellBg: string
}

export const QUIZ_GROUPS_2D: QuizGroup[] = [
  {
    setName: 'A',
    label: 'Set A',
    start: 1,
    end: 10,
    accent: 'border-rose-300',
    headerBg: 'bg-[#e95757]',
    cellBg: 'bg-[#f4a7c8] text-slate-900 border-[#bf6f95]',
  },
  {
    setName: 'B',
    label: 'Set B',
    start: 11,
    end: 20,
    accent: 'border-blue-300',
    headerBg: 'bg-[#6e94d1]',
    cellBg: 'bg-[#a9c9ff] text-slate-900 border-[#6e94d1]',
  },
  {
    setName: 'C',
    label: 'Set C',
    start: 21,
    end: 30,
    accent: 'border-emerald-300',
    headerBg: 'bg-[#77b077]',
    cellBg: 'bg-[#b8e6b8] text-slate-900 border-[#77b077]',
  },
]

export const QUIZ_GROUPS_3D: QuizGroup[] = [
  {
    setName: 'A',
    label: 'Panel A',
    start: 1,
    end: 1,
    accent: 'border-blue-300',
    headerBg: 'bg-blue-600',
    cellBg: 'bg-blue-50 text-blue-900 border-blue-200',
  },
  {
    setName: 'B',
    label: 'Panel B',
    start: 2,
    end: 2,
    accent: 'border-rose-300',
    headerBg: 'bg-rose-600',
    cellBg: 'bg-rose-50 text-rose-900 border-rose-200',
  },
  {
    setName: 'C',
    label: 'Panel C',
    start: 3,
    end: 3,
    accent: 'border-emerald-300',
    headerBg: 'bg-emerald-600',
    cellBg: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
]

export const getQuizGroups = (mode: GameMode) => (mode === '3d' ? QUIZ_GROUPS_3D : QUIZ_GROUPS_2D)
