import React from 'react';

const Header = () => {
  const scrollText = "Welcome to SARA777 Online Matka App";
  const repeatedText = Array(4).fill(scrollText).join(" | ");

  return (
    <div className="bg-black w-full py-2 sm:py-2.5 overflow-hidden relative">
      <div className="flex items-center">
        <div className="whitespace-nowrap animate-scroll flex">
          <span className="text-indigo-400 text-xs sm:text-sm md:text-base font-normal">
            {repeatedText} | {repeatedText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Header;
