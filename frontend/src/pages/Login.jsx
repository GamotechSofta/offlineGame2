import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refParam = searchParams.get('ref');
  const [isLogin, setIsLogin] = useState(!refParam);
  const [loginMethod, setLoginMethod] = useState('phone'); // 'phone' or 'email'
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    otp: '',
    password: '',
    confirmPassword: '',
  });
  const [isAbove18, setIsAbove18] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;
    
    // Only allow digits for phone number
    if (name === 'phone') {
      processedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    
    // Only allow digits for OTP
    if (name === 'otp') {
      processedValue = value.replace(/\D/g, '').slice(0, 6);
    }
    
    setFormData({
      ...formData,
      [name]: processedValue,
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
      if (loginMethod === 'phone') {
        if (!formData.phone || !formData.otp) {
          setError('Phone number and OTP are required');
          return;
        }
        if (!/^[6-9]\d{9}$/.test(formData.phone)) {
          setError('Please enter a valid 10-digit phone number');
          return;
        }
        if (!/^\d{4,6}$/.test(formData.otp)) {
          setError('OTP must be 4-6 digits');
        return;
        }
      } else {
        // Email/Password login
        if (!formData.email || !formData.password) {
          setError('Email and password are required');
          return;
        }
      }
    } else {
      // Signup
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.otp || !formData.password || !formData.confirmPassword) {
        setError('All fields are required');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (!/^\d{4,6}$/.test(formData.otp)) {
        setError('OTP must be 4-6 digits');
        return;
      }
      if (!/^[6-9]\d{9}$/.test(formData.phone)) {
        setError('Please enter a valid 10-digit phone number');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/users/login' : '/users/signup';
      let deviceId = '';
      if (isLogin) {
        try {
          deviceId = typeof localStorage !== 'undefined' ? (localStorage.getItem('deviceId') || '') : '';
          if (!deviceId) {
            deviceId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('deviceId', deviceId);
            }
          }
        } catch (e) {
          deviceId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        }
      }
      const body = isLogin
        ? (loginMethod === 'phone'
            ? { phone: formData.phone, otp: formData.otp, deviceId: deviceId || undefined }
            : { email: formData.email, password: formData.password, deviceId: deviceId || undefined })
        : { 
            username: `${formData.firstName} ${formData.lastName}`.trim(),
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            otp: formData.otp,
            password: formData.password,
            referredBy: refParam || undefined 
          };
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
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white relative overflow-hidden">
      {/* Desktop: Two Column Layout */}
      <div className="hidden md:flex h-screen overflow-hidden">
        {/* Left Side - Image (Fixed, Not Scrollable, Fits Screen) */}
        <div className="w-1/2 h-screen fixed left-0 top-0 overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-900">
          <img
            src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770101961/Black_and_Gold_Classy_Casino_Night_Party_Instagram_Post_1080_x_1080_px_d1n00g.png"
            alt="Login banner"
            className="w-full h-full object-cover"
          />
        </div>

         {/* Right Side - Form (Scrollable) */}
         <div className="w-1/2 ml-auto overflow-y-auto h-screen">
           <div className={`flex items-center justify-center min-h-full ${isLogin ? 'p-4 lg:p-6' : 'p-3 lg:p-4'}`}>
             <div className="w-full max-w-md">
            {/* Title Section */}
            <div className={`w-full ${isLogin ? 'mb-4 lg:mb-5' : 'mb-2'}`}>
              <h1 className={`${isLogin ? 'text-2xl lg:text-3xl mb-1.5' : 'text-xl lg:text-2xl mb-1'} font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent`}>
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className={`text-gray-400 ${isLogin ? 'text-sm lg:text-base' : 'text-xs lg:text-sm'}`}>
                {isLogin ? 'Sign in to continue' : 'Join us and start winning'}
              </p>
            </div>

            {/* Form Container */}
            <div className="w-full">
              {/* Toggle Buttons - Improved styling */}
              <div className={`flex gap-2 ${isLogin ? 'mb-4' : 'mb-2'} bg-gray-800/50 backdrop-blur-sm rounded-xl p-1.5 border border-gray-700/50`}>
            <button
              type="button"
              onClick={() => {
                setIsLogin(true);
                setLoginMethod('phone');
                setError('');
                setFormData({
                  username: '',
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  otp: '',
                  password: '',
                  confirmPassword: '',
                });
              }}
              className={`flex-1 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                isLogin
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setIsLogin(false);
                setLoginMethod('phone');
                setError('');
                setFormData({
                  username: '',
                  firstName: '',
                  lastName: '',
                  email: '',
                  phone: '',
                  otp: '',
                  password: '',
                  confirmPassword: '',
                });
              }}
              className={`flex-1 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                !isLogin
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Sign Up
            </button>
              </div>

              {/* Error Message - Improved styling */}
              {error && (
                <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2 backdrop-blur-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Login Method Toggle (only for login) - Improved styling */}
              {isLogin && (
                <div className="flex gap-2 mb-4 bg-gray-800/50 backdrop-blur-sm rounded-xl p-1.5 border border-gray-700/50">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod('phone');
                  setError('');
                  setFormData({
                    ...formData,
                    email: '',
                    password: '',
                  });
                }}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    loginMethod === 'phone'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone & OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('email');
                    setError('');
                    setFormData({
                      ...formData,
                      phone: '',
                      otp: '',
                    });
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    loginMethod === 'email'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email & Password
                </button>
            </div>
          )}

              {/* Form - Improved spacing and styling */}
              <form onSubmit={handleSubmit} className={isLogin ? "space-y-3" : "space-y-2"}>
                {/* Phone & OTP Login Fields */}
                {isLogin && loginMethod === 'phone' && (
                  <>
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1.5">
                        Phone Number <span className="text-yellow-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          maxLength="10"
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                          placeholder="10-digit phone number"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1.5">
                        OTP Verification Code <span className="text-yellow-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          name="otp"
                          value={formData.otp}
                          onChange={handleChange}
                          maxLength="6"
                          inputMode="numeric"
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                          placeholder="Enter 4-6 digit OTP"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Email & Password Login Fields */}
                {isLogin && loginMethod === 'email' && (
                  <>
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1.5">
                        Email Address <span className="text-yellow-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                          placeholder="your.email@example.com"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1.5">
                        Password <span className="text-yellow-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                          placeholder="Enter your password"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* First Name and Last Name (only for signup) */}
                {!isLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1">
                        First Name <span className="text-yellow-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                        placeholder="First Name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1">
                        Last Name <span className="text-yellow-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                        placeholder="Last Name"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Email (only for signup) */}
                {!isLogin && (
                  <div>
                    <label className="block text-gray-300 text-xs font-medium mb-1">
                      Email Address <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Phone (only for signup) */}
                {!isLogin && (
                  <div>
                    <label className="block text-gray-300 text-xs font-medium mb-1">
                      Phone Number <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        maxLength="10"
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                        placeholder="10-digit phone number"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* OTP Verification (only for signup) */}
                {!isLogin && (
                  <div>
                    <label className="block text-gray-300 text-xs font-medium mb-1">
                      OTP Verification Code <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="otp"
                        value={formData.otp}
                        onChange={handleChange}
                        maxLength="6"
                        inputMode="numeric"
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                        placeholder="Enter 4-6 digit OTP"
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Password (only for signup) */}
                {!isLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1">
                        Password <span className="text-yellow-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                          placeholder="Create password"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-300 text-xs font-medium mb-1">
                        Confirm Password <span className="text-yellow-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full bg-gray-800/80 border border-gray-700/50 rounded-lg px-3 pl-9 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm text-sm"
                          placeholder="Confirm password"
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}


                {/* Checkbox - Improved styling */}
                <div className={isLogin ? "mb-3" : "mb-2"}>
                  <label className="flex items-start gap-2 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={isAbove18}
                        onChange={(e) => setIsAbove18(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`${isLogin ? 'w-4 h-4' : 'w-3.5 h-3.5'} rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                        isAbove18 
                          ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-500 shadow-md shadow-green-500/30' 
                          : 'border-gray-600 group-hover:border-gray-500 bg-gray-800/50'
                      }`}>
                        {isAbove18 && (
                          <svg className={`${isLogin ? 'w-3 h-3' : 'w-2.5 h-2.5'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className={`text-gray-300 ${isLogin ? 'text-xs' : 'text-[10px]'} leading-tight flex-1`}>
                      I confirm that I am above 18 years of age and agree to the{' '}
                      <span className="text-yellow-500 underline">Terms of Use</span> and{' '}
                      <span className="text-yellow-500 underline">Privacy Policy</span>
                    </span>
                  </label>
                </div>

                {/* Submit Button - Improved styling */}
                <button
                  type="submit"
                  disabled={loading || !isAbove18}
                  className={`w-full bg-gradient-to-r from-yellow-500 via-yellow-500 to-yellow-600 text-black font-bold ${isLogin ? 'py-2.5' : 'py-2'} rounded-lg hover:from-yellow-400 hover:via-yellow-500 hover:to-yellow-600 transition-all duration-200 text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40 active:scale-[0.98]`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Please wait...
                    </span>
                  ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                  )}
                </button>
              </form>
            </div>

              {/* Bottom Legal Text - Improved styling */}
              <div className={`${isLogin ? 'mt-4' : 'mt-2'} text-center w-full`}>
                <p className={`text-gray-400 ${isLogin ? 'text-xs' : 'text-[10px]'} leading-tight`}>
                  By continuing, you agree to our{' '}
                  <span className="text-yellow-500 hover:text-yellow-400 underline cursor-pointer transition-colors">Terms of Use</span>
                  {' '}and{' '}
                  <span className="text-yellow-500 hover:text-yellow-400 underline cursor-pointer transition-colors">Privacy Policy</span>
                </p>
              </div>
            </div>
          </div>
          </div>
        </div>
        
      {/* Mobile: Single Column Layout */}
      <div className="md:hidden flex flex-col px-4 sm:px-6 py-4 sm:py-6 min-h-screen">
        <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center justify-center flex-1">
          {/* Image - Reduced size for mobile */}
          <div className="w-full mb-4 sm:mb-6 flex justify-center">
            <img
              src="https://res.cloudinary.com/dzd47mpdo/image/upload/v1770101961/Black_and_Gold_Classy_Casino_Night_Party_Instagram_Post_1080_x_1080_px_d1n00g.png"
              alt="Login banner"
              className="w-full max-w-[200px] sm:max-w-[240px] h-auto rounded-lg"
            />
          </div>

          {/* Title Section */}
          <div className="w-full mb-4 sm:mb-5">
            <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-400 text-sm sm:text-base text-center">
              {isLogin ? 'Sign in to continue' : 'Join us and start winning'}
            </p>
          </div>

        {/* Middle Section - Login/Signup */}
          <div className="w-full">
            {/* Toggle Buttons - Improved styling */}
            <div className="flex gap-2 mb-5 bg-gray-800/50 backdrop-blur-sm rounded-xl p-1.5 border border-gray-700/50">
            <button
                type="button"
              onClick={() => {
                setIsLogin(true);
                  setLoginMethod('phone');
                setError('');
                  setFormData({
                    username: '',
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    otp: '',
                    password: '',
                    confirmPassword: '',
                  });
                }}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                isLogin
                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Login
            </button>
            <button
                type="button"
              onClick={() => {
                setIsLogin(false);
                  setLoginMethod('phone');
                setError('');
                  setFormData({
                    username: '',
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    otp: '',
                    password: '',
                    confirmPassword: '',
                  });
                }}
                className={`flex-1 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 ${
                !isLogin
                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-lg shadow-yellow-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              Sign Up
            </button>
          </div>

            {/* Error Message - Improved styling */}
          {error && (
              <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-center gap-2 backdrop-blur-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Login Method Toggle (only for login) - Improved styling */}
            {isLogin && (
              <div className="flex gap-2 mb-5 bg-gray-800/50 backdrop-blur-sm rounded-xl p-1.5 border border-gray-700/50">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('phone');
                    setError('');
                    setFormData({
                      ...formData,
                      email: '',
                      password: '',
                    });
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    loginMethod === 'phone'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone & OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('email');
                    setError('');
                    setFormData({
                      ...formData,
                      phone: '',
                      otp: '',
                    });
                  }}
                  className={`flex-1 py-2 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                    loginMethod === 'email'
                      ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black shadow-md'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email & Password
                </button>
            </div>
          )}

            {/* Form - Improved spacing and styling */}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {/* Phone & OTP Login Fields */}
              {isLogin && loginMethod === 'phone' && (
                <>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2.5">
                      Phone Number <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        maxLength="10"
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                        placeholder="10-digit phone number"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2.5">
                      OTP Verification Code <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        name="otp"
                        value={formData.otp}
                        onChange={handleChange}
                        maxLength="6"
                        inputMode="numeric"
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                        placeholder="Enter 4-6 digit OTP"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email & Password Login Fields */}
              {isLogin && loginMethod === 'email' && (
                <>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2.5">
                      Email Address <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2.5">
                      Password <span className="text-yellow-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                        placeholder="Enter your password"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* First Name and Last Name (only for signup) */}
              {!isLogin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2.5">
                      First Name <span className="text-yellow-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="First Name"
                      required
                    />
                  </div>
            <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2.5">
                      Last Name <span className="text-yellow-500">*</span>
              </label>
              <input
                type="text"
                      name="lastName"
                      value={formData.lastName}
                onChange={handleChange}
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="Last Name"
                required
              />
            </div>
                </div>
              )}

            {/* Email (only for signup) */}
            {!isLogin && (
              <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2.5">
                    Email Address <span className="text-yellow-500">*</span>
                </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="your.email@example.com"
                  required
                />
                  </div>
              </div>
            )}

              {/* Phone (only for signup) */}
            {!isLogin && (
              <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2.5">
                    Phone Number <span className="text-yellow-500">*</span>
                </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                      maxLength="10"
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="10-digit phone number"
                      required
                    />
                  </div>
                </div>
              )}

              {/* OTP Verification (only for signup) */}
              {!isLogin && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2.5">
                    OTP Verification Code <span className="text-yellow-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="otp"
                      value={formData.otp}
                      onChange={handleChange}
                      maxLength="6"
                      inputMode="numeric"
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="Enter 4-6 digit OTP"
                      required
                    />
                  </div>
              </div>
            )}

              {/* Password (only for signup) */}
              {!isLogin && (
            <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2.5">
                    Password <span className="text-yellow-500">*</span>
              </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="Create a strong password"
                required
              />
            </div>
                </div>
              )}

              {/* Confirm Password (only for signup) */}
              {!isLogin && (
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2.5">
                    Confirm Password <span className="text-yellow-500">*</span>
                  </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 pl-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all backdrop-blur-sm"
                      placeholder="Re-enter your password"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Checkbox - Improved styling */}
              <div className="mb-5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={isAbove18}
                    onChange={(e) => setIsAbove18(e.target.checked)}
                    className="sr-only"
                  />
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isAbove18 
                        ? 'bg-gradient-to-br from-green-500 to-green-600 border-green-500 shadow-lg shadow-green-500/30' 
                        : 'border-gray-600 group-hover:border-gray-500 bg-gray-800/50'
                  }`}>
                    {isAbove18 && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                  <span className="text-gray-300 text-sm leading-relaxed flex-1">
                    I confirm that I am above 18 years of age and agree to the{' '}
                    <span className="text-yellow-500 underline">Terms of Use</span> and{' '}
                    <span className="text-yellow-500 underline">Privacy Policy</span>
                  </span>
              </label>
            </div>

              {/* Submit Button - Improved styling */}
            <button
              type="submit"
                disabled={loading || !isAbove18}
                className="w-full bg-gradient-to-r from-yellow-500 via-yellow-500 to-yellow-600 text-black font-bold py-3.5 sm:py-4 rounded-xl hover:from-yellow-400 hover:via-yellow-500 hover:to-yellow-600 transition-all duration-200 text-sm sm:text-base uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40 active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Please wait...
                  </span>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
            </button>
          </form>

            {/* Bottom Legal Text - Improved styling */}
            <div className="mt-6 sm:mt-8 pb-4 text-center w-full">
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                By continuing, you agree to our{' '}
                <span className="text-yellow-500 hover:text-yellow-400 underline cursor-pointer transition-colors">Terms of Use</span>
                {' '}and{' '}
                <span className="text-yellow-500 hover:text-yellow-400 underline cursor-pointer transition-colors">Privacy Policy</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
