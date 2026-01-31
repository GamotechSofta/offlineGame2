import React from 'react';
import { useNavigate } from 'react-router-dom';

const Bids = () => {
  const navigate = useNavigate();

  const items = [
    {
      title: 'Bid History',
      subtitle: 'You can view your market bid history',
      color: '#f3b61b'
    },
    {
      title: 'Game Results',
      subtitle: 'You can view your market result history',
      color: '#25d366',
      iconUrl: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769799295/result_ekwn16.png'
    },
    {
      title: 'Sara Starline Bid History',
      subtitle: 'You can view starline history',
      color: '#ef4444'
    },
    {
      title: 'Sara Starline Result History',
      subtitle: 'You can view starline result',
      color: '#3b82f6'
    },
    
  ];

  return (
    <div className="min-h-screen bg-black text-white px-4 py-5">
      <div className="w-full max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center text-white"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">My Bids</h1>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
                  style={{ backgroundColor: item.color }}
                >
                  {item.iconUrl ? (
                    <img
                      src={item.iconUrl}
                      alt={item.title}
                      className="w-7 h-7 object-contain"
                    />
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-base sm:text-lg font-semibold">{item.title}</p>
                  <p className="text-xs sm:text-sm text-gray-400">{item.subtitle}</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Bids;
