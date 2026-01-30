import React from 'react';
import { useNavigate } from 'react-router-dom';

const BidOptions = () => {
  const navigate = useNavigate();

  const options = [
    {
      id: 1,
      title: 'Single Digit',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-blue-200" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="#E0E7FF" stroke="none" />
          <circle cx="12" cy="12" r="2" fill="#DC2626" />
        </svg>
      ),
    },
    {
      id: 2,
      title: 'Single Digit Bulk',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-blue-200" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="16" rx="2" fill="#E0E7FF" stroke="none" />
          <circle cx="12" cy="12" r="2" fill="#DC2626" />
        </svg>
      ),
    },
    {
      id: 3,
      title: 'Jodi',
      icon: (
        <div className="flex gap-1 justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-blue-200" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#E0E7FF" stroke="none" />
            <circle cx="8" cy="8" r="1.5" fill="#DC2626" />
            <circle cx="16" cy="16" r="1.5" fill="#DC2626" />
          </svg>
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-blue-200" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#E0E7FF" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="#DC2626" />
          </svg>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Jodi Bulk',
      icon: (
        <div className="flex gap-1 justify-center">
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-blue-200" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#E0E7FF" stroke="none" />
            <circle cx="8" cy="8" r="1.5" fill="#DC2626" />
            <circle cx="16" cy="16" r="1.5" fill="#DC2626" />
          </svg>
          <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-blue-200" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#E0E7FF" stroke="none" />
            <circle cx="12" cy="12" r="1.5" fill="#DC2626" />
          </svg>
        </div>
      ),
    },
    {
      id: 5,
      title: 'Single Pana',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12" stroke="currentColor" strokeWidth="1">
          <rect x="5" y="2" width="14" height="20" rx="2" fill="white" stroke="gray" />
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="black">A♣</text>
          <path d="M12 14 L12 14" stroke="black" />
        </svg>
      ),
    },
    {
      id: 6,
      title: 'Single Pana Bulk',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12" stroke="currentColor" strokeWidth="1">
          <rect x="5" y="2" width="14" height="20" rx="2" fill="white" stroke="gray" />
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="10" fill="black">A♣</text>
          <path d="M12 14 L12 14" stroke="black" />
        </svg>
      ),
    },
    {
      id: 7,
      title: 'Double Pana',
      icon: (
        <div className="relative w-12 h-12 flex justify-center items-center">
          <div className="absolute top-0 right-2 w-8 h-10 bg-white border border-gray-300 rounded shadow-md transform rotate-6 z-0"></div>
          <div className="absolute top-1 left-2 w-8 h-10 bg-white border border-gray-300 rounded shadow-md transform -rotate-6 z-10 flex items-center justify-center">
            <span className="text-black text-xs font-bold">A♣</span>
          </div>
        </div>
      ),
    },
    {
      id: 8,
      title: 'Double Pana Bulk',
      icon: (
        <div className="relative w-12 h-12 flex justify-center items-center">
          <div className="absolute top-0 right-2 w-8 h-10 bg-white border border-gray-300 rounded shadow-md transform rotate-6 z-0"></div>
          <div className="absolute top-1 left-2 w-8 h-10 bg-white border border-gray-300 rounded shadow-md transform -rotate-6 z-10 flex items-center justify-center">
            <span className="text-black text-xs font-bold">A♣</span>
          </div>
        </div>
      ),
    },
    {
      id: 9,
      title: 'Triple Pana',
      icon: (
        <div className="relative w-14 h-12 flex justify-center items-center">
          <div className="absolute top-0 right-0 w-7 h-9 bg-white border border-gray-300 rounded shadow-md transform rotate-12 z-0"></div>
          <div className="absolute top-0 left-0 w-7 h-9 bg-white border border-gray-300 rounded shadow-md transform -rotate-12 z-0"></div>
          <div className="absolute top-1 left-3 w-7 h-9 bg-white border border-gray-300 rounded shadow-md z-10 flex items-center justify-center">
            <span className="text-black text-[10px] font-bold">A♣</span>
          </div>
        </div>
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
      <div className="w-full max-w-md p-4 grid grid-cols-2 gap-4">
        {options.map((option) => (
          <div
            key={option.id}
            onClick={() => navigate('/game-bid', {
              state: {
                title: option.title,
                gameMode: option.title.toLowerCase().includes('bulk') ? 'bulk' : 'easy'
              }
            })}
            className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:bg-gray-800 active:scale-95 transition-all cursor-pointer shadow-lg group"
          >
            {/* Icon Container with subtle glow effect */}
            <div className="transform group-hover:scale-110 transition-transform duration-300">
              {option.icon}
            </div>

            {/* Title */}
            <span className="text-white text-xs font-bold tracking-wide uppercase text-center">
              {option.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BidOptions;
