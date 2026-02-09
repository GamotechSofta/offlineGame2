import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const banners = [
    {
      image: "https://res.cloudinary.com/dzd47mpdo/image/upload/v1770623700/Black_Gold_Modern_Casino_Night_Party_Facebook_Cover_1545_x_900_px_ufrc1r.png",
      alt: "Black Gold Casino Night Banner"
    },
    {
      image: "https://res.cloudinary.com/dzd47mpdo/image/upload/v1769946386/goa_games_first_banner_1_whcjgm.jpg",
      alt: "Spin to Win Banner"
    },
    {
      image: "https://res.cloudinary.com/dzd47mpdo/image/upload/v1769709356/Black_and_White_Minimalist_Casino_Night_Facebook_Cover_1920_x_600_mm_iocl92.png",
      alt: "Casino Banner"
    },
  ];

  const hotGames = [
    { 
      id: 'single-digit', 
      name: 'SINGLE DIGIT',
      image: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg'
    },
    { 
      id: 'double-pana', 
      name: 'DOUBLE PANA',
      image: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg'
    },
    { 
      id: 'single-pana', 
      name: 'SINGLE PANA',
      image: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg'
    },
    { 
      id: 'jodi', 
      name: 'JODI',
      image: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg'
    },
    { 
      id: 'triple-pana', 
      name: 'TRIPLE PANA',
      image: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714392/Untitled_1080_x_1080_px_1080_x_1080_px_9_ugcdef.svg'
    },
    { 
      id: 'full-sangam', 
      name: 'FULL SANGAM',
      image: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1770033671/Untitled_design_2_kr1imj.svg'
    },
  ];

  const len = banners.length;

  const stop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = () => {
    if (len <= 1) return;
    stop();
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % len);
    }, 4000);
  };

  useEffect(() => {
    start();
    return stop;
  }, [len]);

  const handleGameClick = (gameId) => {
    console.log('Game clicked:', gameId);
  };


  return (
    <section className="w-full bg-[#0a0a0a]">
      {/* Desktop Layout */}
      <div className="hidden md:flex gap-5 px-5 pb-8 max-w-[1400px] mx-auto">
        {/* Left Side - Banner (60%) */}
        <div className="w-[60%] relative">
          <div className="relative rounded-xl overflow-hidden h-full">
            {/* Banner Slider */}
            <div
              className="flex will-change-transform h-full"
              style={{
                transform: `translateX(-${index * 100}%)`,
                transition: 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={stop}
              onMouseLeave={start}
            >
              {banners.map((banner, i) => (
                <div key={i} className="w-full shrink-0 grow-0 basis-full relative h-full">
                  <img
                    src={banner.image}
                    alt={banner.alt}
                    className="w-full h-full min-h-[360px] object-cover"
                    loading="eager"
                    draggable="false"
                  />
                </div>
              ))}
            </div>

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

            {/* Dots Indicator */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === index 
                      ? 'w-8 bg-amber-500' 
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + len) % len)}
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:scale-105 z-10"
              aria-label="Previous"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % len)}
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 hover:scale-105 z-10"
              aria-label="Next"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Right Side - Hot Games (40%) */}
        <div className="w-[40%] flex flex-col">
          {/* Title */}
          <h2 className="text-2xl font-black text-white mb-4 text-center tracking-wide drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
            Hot Games
          </h2>

          {/* Games Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4 flex-1">
            {hotGames.map((game) => (
              <button
                key={game.id}
                onClick={() => handleGameClick(game.id)}
                className="group bg-[#1c1c1c] hover:bg-[#242424] rounded-2xl p-3 transition-all duration-200 hover:scale-[1.03] border border-gray-800/50 hover:border-amber-500/30 flex flex-col items-center justify-center"
              >
                {/* Game Image */}
                <div className="w-16 h-16 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <img 
                    src={game.image} 
                    alt={game.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Game Name */}
                <span className="text-[10px] font-bold text-gray-400 group-hover:text-gray-300 transition-colors text-center leading-tight uppercase tracking-wide">
                  {game.name}
                </span>
              </button>
            ))}
          </div>

          {/* Featured Games */}
          <div className="grid grid-cols-2 gap-3">
            {/* STARTLINE Button */}
            <button
              onClick={() => handleGameClick('startline')}
              className="flex text-white items-center gap-3 p-3 rounded-2xl transition-all duration-200 border border-amber-500/30 hover:border-amber-500/50  "
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-500">
                <svg className="w-6 h-6 text-black" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              </div>
              <span className="text-sm font-extrabold flex-1 text-left tracking-wide text-white">
                STARLINE
              </span>
              <svg className="w-5 h-5 shrink-0 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* KING BAZAAR Button */}
            <button
              onClick={() => handleGameClick('king-bazaar')}
              className="flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 bg-[#1e1e1e] hover:bg-[#252525]"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-purple-200">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  {/* 3D Dice */}
                  <rect x="3" y="3" width="18" height="18" rx="3" fill="#9333ea"/>
                  <circle cx="7.5" cy="7.5" r="1.5" fill="#fbbf24"/>
                  <circle cx="12" cy="12" r="1.5" fill="#ef4444"/>
                  <circle cx="16.5" cy="16.5" r="1.5" fill="#22c55e"/>
                  <circle cx="16.5" cy="7.5" r="1.5" fill="#3b82f6"/>
                  <circle cx="7.5" cy="16.5" r="1.5" fill="#f97316"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-extrabold tracking-wide text-white block leading-tight">
                  KING
                </span>
                <span className="text-sm font-extrabold tracking-wide text-white block leading-tight">
                  BAZAAR
                </span>
              </div>
              <svg className="w-5 h-5 shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

    </section>
  );
};

export default HeroSection;
