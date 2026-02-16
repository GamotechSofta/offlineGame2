import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // If already logged in, go to dashboard
    React.useEffect(() => {
        const admin = localStorage.getItem('admin');
        if (admin) navigate('/dashboard', { replace: true });
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Frontend validation
        if (!username || !password) {
            setError('Username and password are required');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
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
                localStorage.setItem('admin', JSON.stringify(data.data));
                sessionStorage.setItem('adminPassword', password);
                navigate('/dashboard');
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-100/60 rounded-full blur-3xl animate-pulse-soft"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-100/60 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="relative bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-200 animate-slideUp">
                {/* Logo/Icon */}
                <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center glow-orange">
                    <svg className="w-8 h-8 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Super Admin
                    </h1>
                    <p className="text-gray-500 text-sm">Secure access to your dashboard</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm animate-slideUp">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="relative group">
                        <label className="block text-sm font-medium text-gray-500 mb-2 group-focus-within:text-orange-500 transition-colors">
                            Username
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 
                                         focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 
                                         transition-all duration-200 hover:border-gray-400"
                                placeholder="Enter your username"
                                required
                            />
                        </div>
                    </div>

                    <div className="relative group">
                        <label className="block text-sm font-medium text-gray-500 mb-2 group-focus-within:text-orange-500 transition-colors">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 
                                         focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 
                                         transition-all duration-200 hover:border-gray-400"
                                placeholder="Enter your password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <FaEyeSlash className="w-5 h-5" />
                                ) : (
                                    <FaEye className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 
                                 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 
                                 glow-orange hover:-translate-y-0.5
                                 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                                 flex items-center justify-center gap-2"
                    >
                        {loading && (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        )}
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Additional security info */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Secured with end-to-end encryption
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
