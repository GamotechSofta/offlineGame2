import React from 'react';
import { useNavigate } from 'react-router-dom';

const Section1 = () => {
  const navigate = useNavigate();
  const markets = [
    {
      gameName: "Rudraksh Morning",
      timeRange: "10:00 AM - 11:00 AM",
      result: "387-87-133",
      isOpen: false,
      timer: null
    },
    {
      gameName: "Milan Morning",
      timeRange: "10:00 AM - 11:00 AM",
      result: "***_**_***",
      isOpen: true,
      timer: "2 Hrs: 50 Mins: 27 Sec"
    },
    {
      gameName: "Rudraksh Night",
      timeRange: "10:00 AM - 11:00 AM",
      result: "***_**_***",
      isOpen: true,
      timer: "1 Hr: 23 Mins: 12 Sec"
    },
    {
      gameName: "Madhur Night",
      timeRange: "10:00 AM - 11:00 AM",
      result: "387-87-133",
      isOpen: false,
      timer: null
    },
    {
      gameName: "Kalyan Morning",
      timeRange: "11:00 AM - 12:00 PM",
      result: "***_**_***",
      isOpen: true,
      timer: "3 Hrs: 15 Mins: 45 Sec"
    },
    {
      gameName: "Time Bazar",
      timeRange: "12:00 PM - 01:00 PM",
      result: "456-78-234",
      isOpen: false,
      timer: null
    },
    {
      gameName: "Milan Day",
      timeRange: "02:00 PM - 04:00 PM",
      result: "***_**_***",
      isOpen: true,
      timer: "1 Hr: 45 Mins: 30 Sec"
    },
    {
      gameName: "Rajdhani Day",
      timeRange: "02:00 PM - 04:00 PM",
      result: "234-56-789",
      isOpen: false,
      timer: null
    },
    {
      gameName: "Kalyan Evening",
      timeRange: "05:00 PM - 07:00 PM",
      result: "***_**_***",
      isOpen: true,
      timer: "2 Hrs: 30 Mins: 15 Sec"
    },
    {
      gameName: "Mumbai Day",
      timeRange: "05:00 PM - 07:00 PM",
      result: "567-89-123",
      isOpen: false,
      timer: null
    },
    {
      gameName: "Rajdhani Night",
      timeRange: "08:00 PM - 10:00 PM",
      result: "***_**_***",
      isOpen: true,
      timer: "4 Hrs: 20 Mins: 10 Sec"
    },
    {
      gameName: "Kalyan Night",
      timeRange: "08:00 PM - 10:00 PM",
      result: "345-67-890",
      isOpen: false,
      timer: null
    },
    {
      gameName: "Mumbai Night",
      timeRange: "10:00 PM - 12:00 AM",
      result: "***_**_***",
      isOpen: true,
      timer: "5 Hrs: 10 Mins: 5 Sec"
    },
    {
      gameName: "Main Bazar",
      timeRange: "10:00 PM - 12:00 AM",
      result: "678-90-345",
      isOpen: false,
      timer: null
    }
  ];

  return (
    <section className="w-full bg-black py-4 sm:py-6 px-3 sm:px-4 md:px-8">
      {/* MARKETS Header */}
      {/* MARKETS Header */}
      <div className="flex items-end justify-center mb-8 w-full max-w-7xl mx-auto">
        {/* Left Line */}
        <div className="flex-1 h-[2px] bg-[#d4af37]"></div>

        {/* Center Trapezoid */}
        <div className="relative shrink-0">
          <svg width="240" height="40" viewBox="0 0 240 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 39 L30 2 L210 2 L240 39" stroke="#d4af37" strokeWidth="2" fill="black" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-3">
            <h2 className="text-white text-2xl font-bold tracking-wider">MARKETS</h2>
          </div>
        </div>

        {/* Right Line */}
        <div className="flex-1 h-[2px] bg-[#d4af37]"></div>
      </div>
      {/* Market Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {markets.map((market, index) => (
          <div
            key={index}
            onClick={() => navigate('/bidoptions')}
            className="bg-gray-800 rounded-lg overflow-hidden shadow-lg cursor-pointer transform hover:scale-[1.02] transition-transform duration-200"
          >
            {/* Status Banner */}
            <div className={`${market.isOpen ? 'bg-green-600' : 'bg-red-600'} py-2 px-3 text-center`}>
              <p className="text-white text-xs sm:text-sm font-semibold">
                {market.isOpen ? market.timer : 'MARKET CLOSED'}
              </p>
            </div>

            {/* Card Content */}
            <div className="p-3 sm:p-4">
              {/* Time with Clock Icon */}
              <div className="flex items-center gap-1.5 mb-2">
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-400 text-xs sm:text-sm">{market.timeRange}</p>
              </div>

              {/* Game Name */}
              <h3 className="text-white text-sm sm:text-base md:text-lg font-semibold mb-3">
                {market.gameName}
              </h3>

              {/* Result */}
              <div className="mb-4">
                <p className="text-yellow-400 text-xl sm:text-2xl md:text-3xl font-bold">
                  {market.result}
                </p>
              </div>

              {/* Play Now Button */}
              <button
                className={`w-full py-2 sm:py-2.5 rounded-lg font-bold text-xs sm:text-sm transition-colors ${market.isOpen
                  ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                  : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
              >
                PLAY NOW
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Section1;
