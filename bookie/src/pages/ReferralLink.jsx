import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders, getReferralUrl } from '../utils/api';

const ReferralLink = () => {
    const [link, setLink] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchReferralLink();
    }, []);

    const fetchReferralLink = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/bookie/referral-link`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setLink(getReferralUrl(data.data.bookieId));
            } else {
                setError(data.message || 'Failed to fetch referral link');
            }
        } catch (err) {
            setError('Network error. Please check if the server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Layout title="My Referral Link">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">My Referral Link</h1>
            <p className="text-gray-400 mb-4 sm:mb-6">Share this link with players. When they sign up using this link, they will be added to your account.</p>
            {error && <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">{error}</div>}
            {loading ? (
                <p className="text-gray-400">Loading...</p>
            ) : link ? (
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50 max-w-2xl">
                    <div className="flex flex-wrap gap-3">
                        <input
                            type="text"
                            value={link}
                            readOnly
                            className="flex-1 min-w-0 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                        />
                        <button
                            onClick={handleCopy}
                            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold rounded-xl transition-all shadow-lg shadow-yellow-500/20"
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">Players who register via this link will appear in your Bet History, Reports, Wallet, and other sections.</p>
                </div>
            ) : null}
        </Layout>
    );
};

export default ReferralLink;
