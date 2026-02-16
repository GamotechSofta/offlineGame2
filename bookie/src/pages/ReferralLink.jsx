import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders, getReferralUrl } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';

const ReferralLink = () => {
    const { t } = useLanguage();
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
        <Layout title={t('referralLink')}>
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{t('referralLinkTitle')}</h1>
            <p className="text-gray-400 mb-4 sm:mb-6">Share this link with players. When they sign up using this link, they will be added to your account.</p>
            {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}
            {loading ? (
                <p className="text-gray-400">{t('loading')}</p>
            ) : link ? (
                <div className="bg-white rounded-lg p-4 sm:p-6 border border-gray-200 max-w-2xl">
                    <div className="flex flex-wrap gap-3">
                        <input
                            type="text"
                            value={link}
                            readOnly
                            className="flex-1 min-w-0 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-800 font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        />
                        <button
                            onClick={handleCopy}
                            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-gray-800 font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/20"
                        >
                            {copied ? t('copied') : t('copyLink')}
                        </button>
                    </div>
                    <p className="mt-4 text-sm text-gray-500">Players who register via this link will appear in your Bet History, Reports, Wallet, and other sections.</p>
                </div>
            ) : null}
        </Layout>
    );
};

export default ReferralLink;
