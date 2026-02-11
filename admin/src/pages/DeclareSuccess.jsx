import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';

const DeclareSuccess = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { marketName, declareType, number } = location.state || {};

    useEffect(() => {
        if (!marketName && !declareType) {
            navigate('/add-result', { replace: true });
        }
    }, [marketName, declareType, navigate]);

    const handleLogout = () => {
        localStorage.removeItem('admin');
        sessionStorage.removeItem('adminPassword');
        navigate('/');
    };

    const handleAddAnother = () => {
        navigate('/add-result', { replace: true });
    };

    const handleDashboard = () => {
        navigate('/dashboard', { replace: true });
    };

    const label = declareType === 'open' ? 'Open' : 'Close';
    const displayText = number ? `${label}: ${number}` : label;

    return (
        <AdminLayout onLogout={handleLogout} title="Result Declared">
            <div className="w-full min-w-0 max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12">
                <div className="rounded-xl border-2 border-green-200 bg-green-500/10 p-6 sm:p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/30 flex items-center justify-center">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Result declared successfully</h1>
                    {marketName && (
                        <p className="text-gray-600 text-sm sm:text-base mb-1 truncate" title={marketName}>{marketName}</p>
                    )}
                    {displayText && (
                        <p className="text-orange-500 font-mono text-sm sm:text-base">{displayText}</p>
                    )}
                </div>

                <p className="text-gray-400 text-sm text-center mt-6 mb-6">
                    You can add another result or go to Dashboard. No redirect to Markets.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                        type="button"
                        onClick={handleAddAnother}
                        className="px-5 py-3 bg-orange-500 hover:bg-orange-600 text-gray-800 font-semibold rounded-xl transition-colors"
                    >
                        Add another result
                    </button>
                    <button
                        type="button"
                        onClick={handleDashboard}
                        className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl border border-gray-200 transition-colors"
                    >
                        Dashboard
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
};

export default DeclareSuccess;
