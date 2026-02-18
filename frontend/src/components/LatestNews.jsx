import React from 'react';

const LatestNews = () => {
  // Sample news items - you can replace this with API data later
  const newsItems = [
    { text: 'Congratulations to Ishana M. for winning ₹511!', icon: '🏆', amount: '₹511' },
    { text: 'Pallavi S. just won ₹701 - Amazing!', icon: '⭐', amount: '₹701' },
    { text: 'Aadi K. hit the jackpot with ₹1004!', icon: '💎', amount: '₹1004' },
    { text: 'Jeet H. won ₹1184 - Keep it up!', icon: '🎯', amount: '₹1184' },
    { text: 'Supriya N. won ₹75 - Great job!', icon: '🎁', amount: '₹75' },
    { text: 'New game results are out - Check now!', icon: '📢', amount: null },
    { text: 'Special bonus weekend - Double rewards!', icon: '🎲', amount: null },
  ];

  // Duplicate items multiple times for seamless infinite circular scroll
  // We duplicate enough times so when animation loops, it's seamless
  const duplicatedItems = [...newsItems, ...newsItems, ...newsItems, ...newsItems, ...newsItems];

  return (
    <div className="w-full bg-gradient-to-r from-orange-50 via-white to-orange-50 border-t-2 border-orange-200 shadow-md overflow-hidden relative max-w-full">
      {/* Gradient overlays for smooth fade effect - narrower on very small screens */}
      <div className="absolute left-0 top-0 bottom-0 w-12 min-[375px]:w-16 sm:w-20 bg-gradient-to-r from-orange-50 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-12 min-[375px]:w-16 sm:w-20 bg-gradient-to-l from-orange-50 to-transparent z-10 pointer-events-none"></div>
      
      <div className="flex items-center h-7 min-[375px]:h-8 md:h-9">
        {/* Label - Enhanced design */}
        <div className="shrink-0 bg-gradient-to-r from-orange-100 to-orange-50 border-r-2 border-orange-300 px-2 min-[375px]:px-3 sm:px-5 md:px-7 h-full flex items-center shadow-sm">
          <div className="flex items-center gap-1.5 min-[375px]:gap-2">
            <svg className="w-3.5 h-3.5 min-[375px]:w-4 min-[375px]:h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
            <span className="text-orange-500 font-bold text-[10px] min-[375px]:text-xs sm:text-sm md:text-base uppercase tracking-wider whitespace-nowrap">
              Latest News
            </span>
          </div>
        </div>

        {/* Scrolling News - Enhanced design */}
        <div className="flex-1 overflow-hidden relative h-full">
          <div className="flex animate-scroll-news h-full items-center">
            {duplicatedItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 min-[375px]:gap-3 sm:gap-4 md:gap-5 px-3 min-[375px]:px-5 sm:px-6 md:px-8 shrink-0 h-full group"
              >
                {/* Icon with background */}
                <div className="flex items-center justify-center w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 border-2 border-orange-200 shadow-sm shrink-0">
                  <span className="text-sm min-[375px]:text-base sm:text-lg md:text-xl leading-none">{item.icon}</span>
                </div>
                
                {/* Text content */}
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-gray-800 text-[10px] min-[375px]:text-xs sm:text-sm md:text-base font-semibold whitespace-nowrap group-hover:text-orange-500 transition-colors truncate max-w-[200px] min-[375px]:max-w-none">
                    {item.text}
                  </span>
                  {item.amount && (
                    <span className="text-orange-500 font-bold text-[10px] min-[375px]:text-xs sm:text-sm md:text-base whitespace-nowrap shrink-0">
                      {item.amount}
                    </span>
                  )}
                </div>
                
                {/* Separator dot */}
                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full shadow-sm"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LatestNews;
