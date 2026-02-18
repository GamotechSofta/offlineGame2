import React, { useState } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const AddUser = () => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        phone: '',
        role: 'user',
        balance: 0,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'balance' ? parseFloat(value) || 0 : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/users/create`, {
                method: 'POST',
                headers: getBookieAuthHeaders(),
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (data.success) {
                setSuccess(t('playerCreatedSuccess'));
                setFormData({
                    username: '',
                    email: '',
                    password: '',
                    phone: '',
                    role: 'user',
                    balance: 0,
                });
            } else {
                setError(data.message || t('failedToCreateUser'));
            }
        } catch (err) {
            setError(t('error') + ': Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title={t('addPlayer')}>
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{t('addNewPlayer')}</h1>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl border border-gray-200">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                {t('username')} *
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                {t('email')} *
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                {t('password')} *
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 pr-10 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder={t('enterPassword')}
                                    required
                                    minLength="6"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 focus:outline-none"
                                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                                >
                                    {showPassword ? <FaEyeSlash className="h-5 w-5" /> : <FaEye className="h-5 w-5" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{t('passwordRequiredForLogin')}</p>
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                {t('phone')} *
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setFormData({ ...formData, phone: value });
                                }}
                                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                placeholder="10-digit phone number"
                                required
                                maxLength="10"
                            />
                            <p className="text-xs text-gray-500 mt-1">{t('phoneRequiredForLogin')}</p>
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                Role *
                            </label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                required
                            >
                                <option value="user">Player</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-gray-600 text-sm font-medium mb-2">
                                {t('initialBalance')}
                            </label>
                            <input
                                type="number"
                                name="balance"
                                value={formData.balance}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-gray-800 font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20"
                        >
                            {loading ? t('loading') : t('createPlayer')}
                        </button>
                    </div>
                </form>
        </Layout>
    );
};

export default AddUser;
