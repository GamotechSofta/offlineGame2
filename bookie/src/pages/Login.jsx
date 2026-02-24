import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const PHONE_REGEX = /^[6-9]\d{9}$/;

const Login = () => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { bookie, login } = useAuth();

    useEffect(() => {
        if (bookie) navigate('/dashboard');
    }, [bookie, navigate]);

    const handlePhoneChange = (e) => {
        setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Prevent multiple submissions
        if (loading) return;
        
        if (!phone || !password) {
            setError('Phone number and password are required');
            return;
        }
        if (!PHONE_REGEX.test(phone)) {
            setError('Please enter a valid 10-digit phone number (starting with 6–9)');
            return;
        }
        setLoading(true);

        try {
            console.log('Attempting login with phone:', phone);
            const response = await fetch(`${API_BASE_URL}/bookie/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ phone, password }),
            });
            console.log('Login response status:', response.status);

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // If response is not JSON, check status code
                if (response.status === 401) {
                    setError('Invalid credentials. Please check your phone number and password.');
                } else if (response.status === 403) {
                    setError('Your account has been suspended. Please contact admin.');
                } else {
                    setError(`Server error (${response.status}). Please try again.`);
                }
                setLoading(false);
                return;
            }

            if (data.success) {
                login(data.data);
                navigate('/dashboard');
            } else {
                // Show the actual error message from server
                setError(data.message || `Login failed (${response.status})`);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-gray-200">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Bookie Panel</h1>
                    <p className="text-gray-500">Login to manage your operations</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-600 text-sm font-medium mb-2">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={handlePhoneChange}
                            maxLength={10}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="10-digit phone number"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-600 text-sm font-medium mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-300 rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                placeholder="Enter password"
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
                        className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
