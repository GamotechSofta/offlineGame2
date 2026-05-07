import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { getCurrentUser, setCurrentUser } from '../session/userSession';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isAbove18, setIsAbove18] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceLimit, setDeviceLimit] = useState(null);
  const [deviceActionLoadingId, setDeviceActionLoadingId] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;
    
    // Only allow digits for phone number
    if (name === 'phone') {
      processedValue = value.replace(/\D/g, '').slice(0, 10);
    }
    
    setFormData({
      ...formData,
      [name]: processedValue,
    });
    setError('');
    setDeviceLimit(null);
  };

  const formatLastSeen = (iso) => {
    if (!iso) return 'Last used: recently';
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return 'Last used: recently';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Last used: just now';
    if (mins < 60) return `Last used: ${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Last used: ${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `Last used: ${days} day${days > 1 ? 's' : ''} ago`;
  };

  const handleLogoutDevice = async (deviceId) => {
    if (!deviceId || loading || deviceActionLoadingId) return;
    setError('');
    setDeviceActionLoadingId(deviceId);
    try {
      const response = await fetch(`${API_BASE_URL}/users/logout-device`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          password: formData.password,
          deviceId,
        }),
      });
      const data = await response.json();
      if (!data?.success) {
        setError(data?.message || 'Failed to log out device');
        return;
      }
      setDeviceLimit(null);
      // Retry login once device is logged out.
      setTimeout(() => {
        const form = document.getElementById('player-login-form');
        if (form) form.requestSubmit();
      }, 50);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDeviceActionLoadingId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isAbove18) {
      setError('You must be above 18 years to continue');
      return;
    }

    // Login validation
    if (!formData.phone) {
      setError('Phone number is required');
      return;
    }
    if (!formData.password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      let deviceId = '';
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

      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: formData.phone, 
          password: formData.password, 
          deviceId: deviceId || undefined 
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        setError('Invalid response from server. Please try again.');
        setLoading(false);
        return;
      }

      if (data.success) {
        // Store user data in shared session service (in-memory, not persisted).
        const previousUser = getCurrentUser();
        let previousCreatedAt = null;
        if (previousUser) {
          try {
            const parsed = typeof previousUser === 'string' ? JSON.parse(previousUser) : previousUser;
            previousCreatedAt = parsed?.createdAt || parsed?.created_at || parsed?.createdOn || null;
          } catch (e) {
            previousCreatedAt = null;
          }
        }

        const userPayload = {
          ...data.data,
          createdAt: data.data?.createdAt || data.data?.created_at || data.data?.createdOn || previousCreatedAt
        };

        setCurrentUser(userPayload);
        // Redirect to home after login
        navigate('/');
      } else {
        if (data?.code === 'DEVICE_LIMIT_REACHED') {
          setDeviceLimit({
            message: data?.message || 'Login pending, device limit reached',
            devices: Array.isArray(data?.data?.activeDevices) ? data.data.activeDevices : [],
          });
          setError('');
          return;
        }
        setError(data.message || 'Something went wrong');
      }
    } catch (err) {
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020b22] px-4 py-8 sm:bg-gray-50 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 sm:hidden">
        <div className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-[#2563eb]/20 blur-3xl" />
        <div className="absolute bottom-10 -left-20 h-72 w-72 rounded-full bg-[#1d4ed8]/20 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <div className="relative w-full rounded-2xl border border-[#244c89] bg-[#071737]/85 p-6 shadow-sm backdrop-blur-sm sm:border-gray-200 sm:bg-white sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#60a5fa] sm:text-3xl sm:text-[#1B3150]">Sign In</h1>
            <p className="mt-1 text-sm text-gray-200 sm:text-gray-600">Access your account to continue.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form id="player-login-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-100 sm:text-gray-700">
                Phone Number <span className="text-[#1B3150]">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-gray-400 sm:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength="10"
                  className="w-full rounded-lg border border-[#2a4f85] bg-[#03112d] py-2.5 pl-10 pr-3 text-sm text-white placeholder-gray-400 focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 sm:border-gray-300 sm:bg-white sm:text-gray-900 sm:focus:border-[#1B3150] sm:focus:ring-[#1B3150]/20"
                  placeholder="10-digit phone number"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-100 sm:text-gray-700">
                Password <span className="text-[#1B3150]">*</span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#2a4f85] bg-[#03112d] py-2.5 pl-10 pr-10 text-sm text-white placeholder-gray-400 focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 sm:border-gray-300 sm:bg-white sm:text-gray-900 sm:focus:border-[#1B3150] sm:focus:ring-[#1B3150]/20"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-300 hover:text-[#60a5fa] sm:text-gray-500 sm:hover:text-[#1B3150]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={isAbove18}
                  onChange={(e) => setIsAbove18(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1B3150] focus:ring-[#1B3150]"
                />
                <span className="text-xs leading-5 text-gray-200 sm:text-gray-600">
                  I confirm that I am above 18 years of age and agree to the{' '}
                  <span className="text-[#1B3150] underline">Terms of Use</span> and{' '}
                  <span className="text-[#1B3150] underline">Privacy Policy</span>.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !isAbove18}
              className="w-full rounded-lg bg-[#2563eb] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60 sm:bg-[#1B3150] sm:hover:bg-[#152842]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Please wait...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {deviceLimit && (
            <div className="mt-4 rounded-xl border border-[#2a4f85] bg-[#03112d] p-4 text-white sm:border-gray-200 sm:bg-gray-50 sm:text-gray-900">
              <h3 className="text-base font-semibold">{deviceLimit.message || 'Login Pending, Device Limit Reached'}</h3>
              <p className="mt-1 text-xs text-gray-300 sm:text-gray-600">You can log out other devices to log in your device</p>
              <div className="mt-3 space-y-2">
                {(deviceLimit.devices || []).map((d) => (
                  <div key={d.deviceId} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-2.5 sm:border-gray-200 sm:bg-white">
                    <div>
                      <div className="text-sm font-semibold">{d.deviceName || 'Active Device'}</div>
                      <div className="text-[11px] text-gray-300 sm:text-gray-500">{formatLastSeen(d.lastSeenAt)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLogoutDevice(d.deviceId)}
                      disabled={!!deviceActionLoadingId}
                      className="rounded-md bg-[#1B3150] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {deviceActionLoadingId === d.deviceId ? 'Logging out...' : 'Log Out'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-200 sm:text-gray-600">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-[#60a5fa] sm:text-[#1B3150] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
