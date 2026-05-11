import React from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/HeroSection';
import Section1 from '../components/Section1';
import lotteryTileDesktop from '../assets/Untitled (1225 x 211 px) (1).png';
import gamesTileDesktop from '../assets/Untitled (1225 x 211 px) (2).png';

const BANNER_TILES = [
  {
    srcMobile: '/Lottery%20(1200%20x%20600%20px)%20(1).png',
    srcDesktop: lotteryTileDesktop,
    path: '/lottery',
    label: 'Lottery — open lottery dashboard',
  },
  {
    srcMobile: '/Lottery%20(1200%20x%20600%20px).png',
    srcDesktop: gamesTileDesktop,
    path: '/games',
    label: 'Games — open games hub',
  },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen min-h-ios-screen bg-gray-200 w-full max-w-full overflow-x-hidden">
      <HeroSection />
      <section className="w-full max-w-full px-3 sm:px-4 mb-2 md:mb-1.5">
        <div
          className="flex w-full flex-row flex-nowrap items-stretch gap-2 sm:gap-3 md:gap-4"
          aria-label="Quick links"
        >
          {BANNER_TILES.map(({ srcMobile, srcDesktop, path, label }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="group flex min-h-0 min-w-0 flex-1 basis-0 overflow-hidden rounded-xl border-0 bg-zinc-950 p-0 shadow-md ring-1 ring-black/40 transition hover:brightness-[1.04] hover:ring-black/55 active:scale-[0.995] md:rounded-lg"
              aria-label={label}
            >
              {/* Mobile: 1200×600 → 2:1 | Desktop: 2400×600 → 4:1 — cover fills frame (no gray pillarboxing) */}
              <picture className="relative block w-full overflow-hidden aspect-[2/1] md:aspect-auto md:h-[88px] lg:h-[96px] xl:h-[104px]">
                <source media="(min-width: 768px)" srcSet={srcDesktop} />
                <img
                  src={srcMobile}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover object-center select-none pointer-events-none"
                  draggable={false}
                />
              </picture>
            </button>
          ))}
        </div>
      </section>
      <Section1 />
    </div>
  );
};

export default Home;
