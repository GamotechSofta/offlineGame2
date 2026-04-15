import React, { useEffect, useRef, useState } from 'react';

const heroImageDesktop = '/playAndWinRealMoney.png';
const heroImageMobile = '/playAndWinRealMoneyMobile.png';

const desktopSlides = [heroImageDesktop, '/aviator.png'];
const mobileSlides = [heroImageMobile, '/aviatorMobile.png'];
const AUTO_SLIDE_MS = 4000;
const SWIPE_THRESHOLD_PX = 40;

const HeroSection = () => {
  const [currentDesktopIndex, setCurrentDesktopIndex] = useState(0);
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0);
  const desktopTouchStartX = useRef(null);
  const mobileTouchStartX = useRef(null);

  const goToNextDesktopSlide = () => {
    setCurrentDesktopIndex((prev) => (prev + 1) % desktopSlides.length);
  };

  const goToPrevDesktopSlide = () => {
    setCurrentDesktopIndex((prev) => (prev - 1 + desktopSlides.length) % desktopSlides.length);
  };

  const goToNextMobileSlide = () => {
    setCurrentMobileIndex((prev) => (prev + 1) % mobileSlides.length);
  };

  const goToPrevMobileSlide = () => {
    setCurrentMobileIndex((prev) => (prev - 1 + mobileSlides.length) % mobileSlides.length);
  };

  useEffect(() => {
    const desktopTimer = setInterval(() => {
      goToNextDesktopSlide();
    }, AUTO_SLIDE_MS);

    const mobileTimer = setInterval(() => {
      goToNextMobileSlide();
    }, AUTO_SLIDE_MS);

    return () => {
      clearInterval(desktopTimer);
      clearInterval(mobileTimer);
    };
  }, []);

  return (
    <>
      <section
        className="w-full max-w-full overflow-hidden mb-6 relative hidden md:block"
        style={{ aspectRatio: '1920/500' }}
        onTouchStart={(e) => {
          desktopTouchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? null;
          const startX = desktopTouchStartX.current;
          if (startX == null || endX == null) return;
          const diff = startX - endX;
          if (Math.abs(diff) < SWIPE_THRESHOLD_PX) return;
          if (diff > 0) goToNextDesktopSlide();
          else goToPrevDesktopSlide();
          desktopTouchStartX.current = null;
        }}
      >
        <div
          className="absolute inset-0 h-full w-full flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentDesktopIndex * 100}%)` }}
        >
          {desktopSlides.map((slideUrl) => (
            <div
              key={slideUrl}
              className="w-full h-full shrink-0"
              style={{
                backgroundImage: `url(${slideUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'top center',
                backgroundRepeat: 'no-repeat',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goToPrevDesktopSlide}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
          aria-label="Previous desktop banner"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goToNextDesktopSlide}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 transition"
          aria-label="Next desktop banner"
        >
          ›
        </button>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {desktopSlides.map((slideUrl, idx) => (
            <button
              key={`desktop-dot-${slideUrl}`}
              type="button"
              onClick={() => setCurrentDesktopIndex(idx)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                currentDesktopIndex === idx ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Go to desktop banner ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      <section
        className="w-full max-w-full overflow-hidden mb-6 md:hidden relative"
        onTouchStart={(e) => {
          mobileTouchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? null;
          const startX = mobileTouchStartX.current;
          if (startX == null || endX == null) return;
          const diff = startX - endX;
          if (Math.abs(diff) < SWIPE_THRESHOLD_PX) return;
          if (diff > 0) goToNextMobileSlide();
          else goToPrevMobileSlide();
          mobileTouchStartX.current = null;
        }}
      >
        <div
          className="w-full flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentMobileIndex * 100}%)` }}
        >
          {mobileSlides.map((slideUrl) => (
            <img
              key={slideUrl}
              src={slideUrl}
              alt=""
              className="w-full h-auto object-contain shrink-0"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={goToPrevMobileSlide}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/40 text-white active:bg-black/60 transition"
          aria-label="Previous mobile banner"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={goToNextMobileSlide}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/40 text-white active:bg-black/60 transition"
          aria-label="Next mobile banner"
        >
          ›
        </button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          {mobileSlides.map((slideUrl, idx) => (
            <button
              key={`mobile-dot-${slideUrl}`}
              type="button"
              onClick={() => setCurrentMobileIndex(idx)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                currentMobileIndex === idx ? 'bg-white' : 'bg-white/50'
              }`}
              aria-label={`Go to mobile banner ${idx + 1}`}
            />
          ))}
        </div>
      </section>
    </>
  );
};

export default HeroSection;
