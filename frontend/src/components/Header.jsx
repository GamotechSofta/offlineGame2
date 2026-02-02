import React from 'react';

const Header = () => {
  const scrollText = "Welcome to SARA777 Online Matka App";
  const repeatedText = Array(4).fill(scrollText).join(" | ");

  return (
    <div className="fixed top-[60px] sm:top-[68px] md:top-[80px] left-0 right-0 z-40 bg-black w-full py-1.5 sm:py-2 md:py-2.5 lg:py-3 overflow-hidden">
      <div className="flex items-center">
        <div className="whitespace-nowrap animate-scroll flex">
          <span className="text-white text-xs sm:text-sm md:text-base lg:text-lg font-normal">
            {repeatedText} | {repeatedText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Header;
