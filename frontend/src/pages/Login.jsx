import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refParam = searchParams.get('ref');
  const [isLogin, setIsLogin] = useState(!refParam);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
  });
  const [isAbove18, setIsAbove18] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAbove18) {
      setError('You must be above 18 years to continue');
      return;
    }

    if (isLogin) {
      // Login
      if (!formData.username || !formData.password) {
        setError('Username and password are required');
        return;
      }
    } else {
      // Signup
      if (!formData.username || !formData.email || !formData.password) {
        setError('Username, email and password are required');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/users/login' : '/users/signup';
      let deviceId = null;
      if (isLogin && typeof localStorage !== 'undefined') {
        deviceId = localStorage.getItem('deviceId');
        if (!deviceId && typeof crypto !== 'undefined' && crypto.randomUUID) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('deviceId', deviceId);
        } else if (!deviceId) {
          deviceId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
          localStorage.setItem('deviceId', deviceId);
        }
      }
      const body = isLogin
        ? { ...formData, ...(deviceId ? { deviceId } : {}) }
        : { ...formData, referredBy: refParam || undefined };
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        // Store user data (preserve signup date when available)
        const previousUser = localStorage.getItem('user');
        let previousCreatedAt = null;
        if (previousUser) {
          try {
            const parsed = JSON.parse(previousUser);
            previousCreatedAt = parsed?.createdAt || parsed?.created_at || parsed?.createdOn || null;
          } catch (e) {
            previousCreatedAt = null;
          }
        }

        const userPayload = {
          ...data.data,
          createdAt:
            data.data?.createdAt ||
            data.data?.created_at ||
            data.data?.createdOn ||
            (!isLogin ? new Date().toISOString() : previousCreatedAt)
        };

        localStorage.setItem('user', JSON.stringify(userPayload));
        // Dispatch custom event to update navbar
        window.dispatchEvent(new Event('userLogin'));
        // Redirect to home
        navigate('/');
      } else {
        setError(data.message || 'Something went wrong');
      }
    } catch (err) {
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col px-4 py-6 sm:py-8 relative overflow-hidden">
      <div className="relative z-10 w-full flex flex-col items-center justify-center flex-1">
        {/* Image - Full width */}
        <div className="w-full mb-6 flex justify-center">
          <img
            src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1769708293/Untitled_1080_x_1080_px_1080_x_1080_px_2_zsih9r.svg"
            alt="Login illustration"
            className="w-full max-w-sm h-auto"
          />
        </div>

        {/* LOG IN & SIGN UP Banner with gold outline */}
        <div className="w-full mb-3">
          <div className="bg-gray-800 border-2 border-yellow-500 rounded-full px-6 py-3 text-center">
            <h3 className="text-white text-xl sm:text-2xl font-bold uppercase">
              LOG IN & SIGN UP
            </h3>
          </div>
        </div>
        
        {/* Sub-heading */}
        <p className="text-gray-300 text-sm sm:text-base text-center mb-6 w-full">
          Enter The Realm Of Luck & Life-Changing Wins
        </p>

        {/* Middle Section - Login/Signup */}
        <div className="w-full max-w-md">
          {/* Toggle Buttons */}
          <div className="flex gap-2 mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                isLogin
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                !isLogin
                  ? 'bg-yellow-500 text-black'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Username *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Enter your username"
                required
              />
            </div>

            {/* Email (only for signup) */}
            {!isLogin && (
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>
            )}

            {/* Phone (optional for signup) */}
            {!isLogin && (
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                  placeholder="Enter your phone number"
                />
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="Enter your password"
                required
              />
            </div>

            {/* Checkbox */}
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isAbove18}
                    onChange={(e) => setIsAbove18(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isAbove18 ? 'bg-green-500 border-green-500' : 'border-gray-600'
                  }`}>
                    {isAbove18 && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-white text-sm">Yes, I Am Above 18 Years</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-white font-bold py-3 sm:py-4 rounded-lg hover:from-yellow-700 hover:to-yellow-600 transition-colors text-sm sm:text-base uppercase disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isLogin ? 'LOGIN' : 'SIGN UP'}
            </button>
          </form>
        </div>

        {/* Bottom Legal Text */}
        <div className="mt-auto pb-4 text-center w-full">
          <p className="text-gray-500 text-xs">
            By Continuing, You Agree To Our{' '}
            <span className="underline text-gray-400 cursor-pointer">Terms Of Use</span>
            {' '}&{' '}
            <span className="underline text-gray-400 cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
