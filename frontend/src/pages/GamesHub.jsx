import React from 'react';

const GAME_ITEMS = [
  {
    key: 'aviator',
    title: 'Aviator',
    subtitle: 'Crash style game',
    accent: 'from-sky-600 to-indigo-700',
    emoji: '✈️',
  },
  {
    key: 'funtimer',
    title: 'FunTimer',
    subtitle: 'Fast timer challenge',
    accent: 'from-violet-600 to-purple-700',
    emoji: '⏱️',
  },
  {
    key: 'roulette',
    title: 'Roulette',
    subtitle: 'Spin and win',
    accent: 'from-rose-600 to-red-700',
    emoji: '🎯',
  },
];

const GamesHub = () => {
  return (
    <div className="min-h-screen bg-gray-200 px-3 sm:px-4 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-3 rounded-2xl border-2 border-gray-300 bg-white px-4 py-3">
          <h1 className="text-xl font-bold text-gray-800">Games</h1>
          <p className="mt-1 text-sm text-gray-600">Choose a game to continue</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_ITEMS.map((game) => (
            <div
              key={game.key}
              className="rounded-2xl border-2 border-gray-300 bg-white p-3 shadow-sm"
            >
              <div className={`rounded-xl bg-gradient-to-r ${game.accent} px-3 py-3 text-white`}>
                <div className="text-2xl">{game.emoji}</div>
                <div className="mt-2 text-lg font-bold leading-tight">{game.title}</div>
                <div className="text-xs text-white/90">{game.subtitle}</div>
              </div>
              <div className="mt-3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-center text-xs font-semibold text-gray-600">
                Coming soon
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GamesHub;
