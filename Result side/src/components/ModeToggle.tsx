import type { GameMode } from '../utils/formatResult'

type ModeToggleProps = {
  mode: GameMode
  onChange: (mode: GameMode) => void
  disabled?: boolean
}

export default function ModeToggle({ mode, onChange, disabled = false }: ModeToggleProps) {
  return (
    <div
      className={`relative flex rounded-xl bg-black/25 p-1 ring-1 ring-white/15 ${disabled ? 'opacity-70' : ''}`}
      role="tablist"
      aria-label="Select game mode"
    >
      <div
        className="absolute top-1 bottom-1 rounded-lg bg-white shadow-md transition-[left,transform] duration-[420ms] ease-[cubic-bezier(0.34,1.15,0.64,1)]"
        style={{
          width: 'calc(50% - 4px)',
          left: mode === '2d' ? '4px' : 'calc(50%)',
        }}
        aria-hidden
      />
      {(['2d', '3d'] as GameMode[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={mode === tab}
          disabled={disabled}
          onClick={() => onChange(tab)}
          className={`relative z-10 min-h-10 min-w-[4.5rem] rounded-lg px-4 text-sm font-bold uppercase transition-colors duration-200 sm:min-w-[5rem] ${
            mode === tab ? 'text-[#1B3150]' : 'text-white/90 hover:text-white'
          } disabled:cursor-not-allowed`}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
