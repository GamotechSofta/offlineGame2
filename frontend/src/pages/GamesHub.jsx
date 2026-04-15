import React from 'react';

const GAME_ITEMS = [
  {
    key: 'funtimer',
    title: 'FunTimer',
    image:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/v1776260116/2ac8e992-c5ef-4b11-ad37-ae8849525a4b.png',
  },
  {
    key: 'roulette',
    title: 'Roulette',
    image:
      'https://res.cloudinary.com/dzd47mpdo/image/upload/v1776261411/c6eed391-fac9-46f9-adbb-02eff964028a.png',
  },
  {
    key: 'aviator',
    title: 'Aviator',
    image:
      'https://res.cloudinary.com/dnyp5jknp/image/upload/v1771667250/Aviator_Games_kvsp7v.png',
  },
];

const GamesHub = () => {
  return (
    <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full bg-white border-b border-gray-200 px-3.5 pt-1.5 pb-1.5">
        <div className="mx-auto w-full max-w-md text-center">
          <h1 className="text-3xl font-extrabold leading-none tracking-tight text-[#1B3150]">Games</h1>
          <p className="mt-0.5 text-xs font-medium text-gray-500">Choose a game and start playing.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md space-y-1.5 px-2.5 pt-2.5">
        {GAME_ITEMS.map((game) => (
          <button
            key={game.key}
            type="button"
            className="relative h-56 w-full overflow-hidden rounded-xl bg-[#0f172a] text-left active:scale-[0.99] transition-transform"
          >
            <img src={game.image} alt={game.title} className="absolute inset-0 h-full w-full object-contain object-bottom" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1B3150]/85 via-[#1B3150]/25 to-transparent" />
            <div className="absolute bottom-2.5 left-2.5 text-white">
              <div className="text-2xl font-extrabold leading-none drop-shadow-sm">{game.title}</div>
              <div className="mt-1 text-[11px] text-white/95">Tap to explore</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default GamesHub;
