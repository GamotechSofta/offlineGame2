import React, { useEffect, useRef, useState } from 'react';

const heroImageDesktop = '/playAndWinRealMoney.png';
const heroImageMobile = '/playAndWinRealMoneyMobile.png';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const AUTO_SLIDE_MS = 4000;
const SWIPE_THRESHOLD_PX = 40;

const HeroSection = () => {
  const [desktopBanners, setDesktopBanners] = useState([heroImageDesktop]);
  const [mobileBanners, setMobileBanners] = useState([heroImageMobile]);
  const [currentDesktopIndex, setCurrentDesktopIndex] = useState(0);
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0);
  const desktopTouchStartX = useRef(null);
  const mobileTouchStartX = useRef(null);
  const desktopSlides = desktopBanners;
  const mobileSlides = mobileBanners;

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
      setCurrentDesktopIndex((prev) => (prev + 1) % desktopSlides.length);
    }, AUTO_SLIDE_MS);

    const mobileTimer = setInterval(() => {
      setCurrentMobileIndex((prev) => (prev + 1) % mobileSlides.length);
    }, AUTO_SLIDE_MS);

    return () => {
      clearInterval(desktopTimer);
      clearInterval(mobileTimer);
    };
  }, [desktopSlides.length, mobileSlides.length]);

  useEffect(() => {
    let mounted = true;
    const fetchBanners = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/banner-settings`);
        const json = await res.json();
        if (!mounted || !json?.success) return;
        const nextDesktop = Array.isArray(json?.data?.desktopBanners) ? json.data.desktopBanners.filter(Boolean) : [];
        const nextMobile = Array.isArray(json?.data?.mobileBanners) ? json.data.mobileBanners.filter(Boolean) : [];
        if (nextDesktop.length) setDesktopBanners(nextDesktop);
        if (nextMobile.length) setMobileBanners(nextMobile);
      } catch {
        // Keep local fallback images if API fails.
      }
    };
    fetchBanners();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (currentDesktopIndex >= desktopSlides.length) {
      setCurrentDesktopIndex(0);
    }
  }, [currentDesktopIndex, desktopSlides.length]);

  useEffect(() => {
    if (currentMobileIndex >= mobileSlides.length) {
      setCurrentMobileIndex(0);
    }
  }, [currentMobileIndex, mobileSlides.length]);

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
      </section>
    </>
  );
};

export default HeroSection;
