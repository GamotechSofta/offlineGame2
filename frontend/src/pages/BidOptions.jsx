import React from 'react';
import { useNavigate } from 'react-router-dom';

const BidOptions = () => {
  const navigate = useNavigate();

  const options = [
    {
      id: 1,
      title: 'Single Digit',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg"
          alt="Single Digit"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 2,
      title: 'Single Digit Bulk',
      icon: (
        <img
        src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769756244/Untitled_90_x_160_px_1080_x_1080_px_1_yinraf.svg"
        alt="Single Digit"
        className="w-30 h-30 object-contain"
      />
      ),
    },
    {
      id: 3,
      title: 'Jodi',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg"
          alt="Jodi"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 4,
      title: 'Jodi Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714108/Untitled_1080_x_1080_px_1080_x_1080_px_7_rpzykt.svg"
          alt="Jodi Bulk"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 5,
      title: 'Single Pana',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg"
          alt="Single Pana"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 6,
      title: 'Single Pana Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714254/Untitled_1080_x_1080_px_1080_x_1080_px_8_jdbxyd.svg"
          alt="Single Pana Bulk"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 7,
      title: 'Double Pana',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg"
          alt="Double Pana"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 8,
      title: 'Double Pana Bulk',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769713943/Untitled_1080_x_1080_px_1080_x_1080_px_6_uccv7o.svg"
          alt="Double Pana Bulk"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 9,
      title: 'Triple Pana',
      icon: (
        <img
          src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769714392/Untitled_1080_x_1080_px_1080_x_1080_px_9_ugcdef.svg"
          alt="Triple Pana"
          className="w-30 h-30 object-contain"
        />
      ),
    },
    {
      id: 10,
      title: 'Full Sangam',
      icon: (
        <div className="flex items-center gap-0.5">
          <div className="w-7 h-9 bg-white border border-gray-300 rounded shadow-sm flex items-center justify-center -mr-2 z-10">
            <span className="text-black text-[8px] font-bold">A</span>
          </div>
          <div className="w-7 h-9 bg-white border border-gray-300 rounded shadow-sm flex items-center justify-center mr-1 z-0">
            <span className="text-black text-[8px]">A</span>
          </div>

          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center shadow-sm">
            <div className="w-1 h-1 bg-red-600 rounded-full"></div>
          </div>
          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center shadow-sm -ml-1">
            <div className="w-1 h-1 bg-red-600 mr-2 rounded-full"></div>
            <div className="w-1 h-1 bg-red-600 rounded-full"></div>
          </div>
        </div>
      ),
    },
    {
      id: 11,
      title: 'Half Sangam (A)',
      icon: (
        <div className="flex items-center gap-1">
          <div className="w-8 h-10 bg-white border border-gray-300 rounded shadow-sm flex items-center justify-center">
            <span className="text-black text-[10px] font-bold">A</span>
          </div>
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center shadow-sm">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
          </div>
        </div>
      ),
    },
    {
      id: 12,
      title: 'Half Sangam (B)',
      icon: (
        <div className="flex items-center gap-1">
          <div className="w-8 h-10 bg-white border border-gray-300 rounded shadow-sm flex items-center justify-center">
            <span className="text-black text-[10px] font-bold">A</span>
          </div>
          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center shadow-sm">
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
          </div>
        </div>
      ),
    }
  ];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center">
      {/* Header */}
      <div className="w-full flex items-center p-4 bg-black border-b border-gray-800 relative">
        <button
          onClick={() => navigate('/')}
          className="absolute left-4 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div className="w-full text-center">
          {/* Using a similar golden outlined visual for header as likely intended */}
          <h1 className="text-white font-bold text-lg tracking-wider uppercase inline-block border-b-2 border-yellow-500 pb-1">
            RUDRAKSH MORNING
          </h1>
        </div>
      </div>

      {/* Grid Content */}
      <div className="w-full max-w-md p-3 grid grid-cols-2 gap-3">
        {options.map((option) => (
          <div
            key={option.id}
            onClick={() => navigate('/game-bid', {
              state: {
                title: option.title,
                gameMode: option.title.toLowerCase().includes('bulk') ? 'bulk' : 'easy'
              }
            })}
            className="relative rounded-2xl bg-gradient-to-br from-[#1b1d22] via-[#15171b] to-[#0f1013] border border-white/10 p-3 flex flex-col items-center justify-center gap-2 hover:from-[#23262d] hover:via-[#1a1d22] hover:to-[#121418] active:scale-[0.98] transition-all cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.35)] group"
          >
            {/* Icon Container with subtle glow effect */}
            <div className="flex items-center justify-center w-30 h-30 transform scale-90 group-hover:scale-100 transition-transform duration-300">
              {option.icon}
            </div>

            {/* Title */}
            <span className="text-white text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-center">
              {option.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BidOptions;
