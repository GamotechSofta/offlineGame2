import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const checkUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    checkUser();

    // Listen for storage changes (when user logs in/out in another tab)
    window.addEventListener('storage', checkUser);
    
    // Listen for custom login event
    window.addEventListener('userLogin', checkUser);
    window.addEventListener('userLogout', checkUser);

    return () => {
      window.removeEventListener('storage', checkUser);
      window.removeEventListener('userLogin', checkUser);
      window.removeEventListener('userLogout', checkUser);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    window.dispatchEvent(new Event('userLogout'));
    navigate('/login', { replace: true });
  };

  return (
    <nav className="bg-white w-full px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between border-b border-orange-100">
      {/* Left side - Hamburger menu, Home icon and Logo */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Hamburger Menu Icon */}
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="flex flex-col gap-1 sm:gap-1.5">
            <div className="w-2.5 sm:w-3 h-0.5 bg-black"></div>
            <div className="w-3 sm:w-4 h-0.5 bg-black"></div>
            <div className="w-2.5 sm:w-3 h-0.5 bg-black"></div>
          </div>
        </div>
        
        {/* Home Icon */}
        <Link 
          to="/" 
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
          title="Home"
        >
          <svg 
            className="w-5 h-5 sm:w-6 sm:h-6 text-black" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
            />
          </svg>
        </Link>
        
        {/* Logo Text - Clickable to home */}
        <Link to="/" className="flex items-center cursor-pointer">
          <span className="text-base sm:text-xl md:text-2xl font-bold text-orange-500 underline decoration-orange-500 decoration-2 underline-offset-2">
            RATAN
          </span>
          <span className="text-base sm:text-xl md:text-2xl font-bold text-orange-500 underline decoration-orange-500 decoration-2 underline-offset-2 ml-0.5 sm:ml-1">
            365
          </span>
        </Link>
      </div>

      {/* Right side - Buttons and User info */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
        {/* Bank Button */}
        <button 
          onClick={() => navigate('/bank')}
          className="bg-orange-500 text-white px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg shadow-md hover:bg-orange-600 transition-colors font-medium text-xs sm:text-sm md:text-base"
        >
          Bank
        </button>
        
        {/* User Profile Icon or Sign In/Sign Up */}
        {user ? (
          <>
            {/* Profile Icon - Clickable to profile or logout */}
            <div 
              onClick={handleLogout}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-orange-500 bg-orange-50 flex items-center justify-center cursor-pointer hover:bg-orange-100 transition-colors"
              title="Logout"
            >
              <svg 
                className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path 
                  fillRule="evenodd" 
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
                  clipRule="evenodd" 
                />
              </svg>
            </div>
            
            {/* Username - Hidden on very small screens */}
            <span className="text-gray-800 font-medium text-sm sm:text-base md:text-lg hidden sm:inline">
              {user.username}
            </span>
          </>
        ) : (
          /* Sign In/Sign Up Icon */
          <div 
            onClick={() => navigate('/login')}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-orange-500 bg-orange-50 flex items-center justify-center cursor-pointer hover:bg-orange-100 transition-colors"
            title="Sign In / Sign Up"
          >
            <svg 
              className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
