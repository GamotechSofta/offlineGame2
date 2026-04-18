import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';

const BANNER_TILES = [
  {
    src: '/Lottery.png',
    path: '/lottery',
    label: 'Lottery — open lottery dashboard',
  },
  {
    src: '/Lottery%20(2).png',
    path: '/games',
    label: 'Games — open games hub',
  },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen min-h-ios-screen bg-gray-200 w-full max-w-full overflow-x-hidden">
      <HeroSection />
      <section className="w-full max-w-full px-3 sm:px-4 mb-4">
        <div
          className="flex w-full flex-row flex-nowrap gap-2 sm:gap-2.5 justify-start overflow-x-auto overflow-y-visible snap-x snap-mandatory scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Quick links"
        >
          {BANNER_TILES.map(({ src, path, label }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="snap-start shrink-0 w-[calc(50%-4px)] sm:w-auto max-w-[104px] sm:max-w-[118px] md:max-w-[148px] lg:max-w-[156px] overflow-hidden rounded-lg shadow-md ring-1 ring-black/5 hover:opacity-95 active:scale-[0.99] transition-all p-0 border-0 bg-transparent cursor-pointer"
              aria-label={label}
            >
              <img
                src={src}
                alt=""
                className="w-full h-12 sm:h-14 md:h-[4.5rem] lg:h-[4.75rem] object-contain object-center block select-none pointer-events-none"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </section>
      <Section1 />
    </div>
  );
};

export default Home;
