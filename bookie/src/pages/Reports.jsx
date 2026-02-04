import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';

const Reports = () => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] });

    useEffect(() => {
        fetchReport();
    }, [dateRange]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/reports?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, { headers: getBookieAuthHeaders() });
            const data = await response.json();
            if (data.success) setReport(data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Reports">
            <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Reports</h1>
            <div className="bg-gray-800 rounded-lg p-4 mb-4 sm:mb-6 flex flex-wrap gap-3 items-center border border-gray-700/50">
                <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
                <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" />
            </div>
            {loading ? (
                <p className="text-gray-400 py-12 text-center">Loading...</p>
            ) : report ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Total Revenue</h3><p className="text-2xl font-bold text-green-400">₹{report.totalRevenue}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Total Payouts</h3><p className="text-2xl font-bold text-red-400">₹{report.totalPayouts}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Net Profit</h3><p className="text-2xl font-bold text-yellow-400">₹{report.netProfit}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Total Bets</h3><p className="text-2xl font-bold">{report.totalBets}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Active Players</h3><p className="text-2xl font-bold">{report.activeUsers}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Winning Bets</h3><p className="text-2xl font-bold text-green-400">{report.winningBets}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Losing Bets</h3><p className="text-2xl font-bold text-red-400">{report.losingBets}</p></div>
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700/50"><h3 className="text-gray-400 text-sm mb-2">Win Rate</h3><p className="text-2xl font-bold">{report.winRate}%</p></div>
                </div>
            ) : (
                <p className="text-gray-400 py-12 text-center">No report data available</p>
            )}
        </Layout>
    );
};

export default Reports;
