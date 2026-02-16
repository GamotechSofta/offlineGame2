import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { API_BASE_URL, getBookieAuthHeaders } from '../utils/api';
import { useLanguage } from '../context/LanguageContext';
import {
    FaSearch,
    FaCalendarAlt,
    FaDownload,
    FaPrint,
    FaEdit,
    FaCheck,
    FaTimes,
    FaFileCsv,
    FaSyncAlt,
    FaUsers,
    FaMoneyBillWave,
    FaArrowUp,
    FaArrowDown,
} from 'react-icons/fa';

// Customer Balance Overview Reports Page

const formatCurrency = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return '\u20B90';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(num);
};

const Reports = () => {
    const { t } = useLanguage();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ yene: '', dene: '' });
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');
    const [updateSuccess, setUpdateSuccess] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchCustomerBalance();
    }, []);

    const fetchCustomerBalance = async (showRefreshing = false) => {
        try {
            if (showRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError('');
            const response = await fetch(`${API_BASE_URL}/reports/customer-balance`, {
                headers: getBookieAuthHeaders(),
            });
            const data = await response.json();
            if (data.success) {
                setCustomers(data.data || []);
            } else {
                setError(data.message || t('failedToFetchCustomerBalance'));
            }
        } catch (err) {
            setError(t('networkErrorCheckServer'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleEdit = (customer) => {
        setEditingId(customer.userId);
        setEditValues({
            yene: customer.yene.toString(),
            dene: customer.dene.toString(),
        });
        setUpdateError('');
        setUpdateSuccess('');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValues({ yene: '', dene: '' });
        setUpdateError('');
        setUpdateSuccess('');
    };

    const handleSave = async (userId) => {
        try {
            setUpdating(true);
            setUpdateError('');
            setUpdateSuccess('');

            const numToTake = Number(editValues.yene);
            const numToGive = Number(editValues.dene);

            if (!Number.isFinite(numToTake) || numToTake < 0) {
                setUpdateError(t('yeneMustBeNonNegative'));
                setUpdating(false);
                return;
            }

            if (!Number.isFinite(numToGive) || numToGive < 0) {
                setUpdateError(t('deneMustBeNonNegative'));
                setUpdating(false);
                return;
            }

            const response = await fetch(`${API_BASE_URL}/users/${userId}/to-give-take`, {
                method: 'PATCH',
                headers: {
                    ...getBookieAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toTake: numToTake,
                    toGive: numToGive,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setUpdateSuccess(t('updatedSuccessfully'));
                // Refresh the data
                setTimeout(() => {
                    fetchCustomerBalance();
                    setEditingId(null);
                    setEditValues({ yene: '', dene: '' });
                    setUpdateSuccess('');
                }, 1000);
            } else {
                setUpdateError(data.message || t('failedToUpdate'));
            }
        } catch (err) {
            setUpdateError(t('networkErrorTryAgain'));
        } finally {
            setUpdating(false);
        }
    };

    const handleExportCSV = () => {
        const headers = [t('srNo'), t('name'), t('yene'), t('dene'), t('aad')];
        const rows = filteredCustomers.map((c) => [
            c.srNo,
            c.name,
            c.yene,
            c.dene,
            c.aad,
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customer-balance-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const q = searchQuery.trim().toLowerCase();
    const filteredCustomers = q
        ? customers.filter((c) => {
            const name = (c.name || '').toLowerCase();
            const srNo = c.srNo.toString();
            return name.includes(q) || srNo.includes(q);
        })
        : customers;

    // Calculate summary statistics
    const totalYene = filteredCustomers.reduce((sum, c) => sum + (c.yene || 0), 0);
    const totalDene = filteredCustomers.reduce((sum, c) => sum + (c.dene || 0), 0);
    const totalAad = filteredCustomers.reduce((sum, c) => sum + (c.aad || 0), 0);
    const positiveBalance = filteredCustomers.filter((c) => c.aad >= 0).length;
    const negativeBalance = filteredCustomers.filter((c) => c.aad < 0).length;

    return (
        <Layout title={t('report')}>
            <div className="space-y-4 sm:space-y-6">
                {/* Header with Refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                                <FaMoneyBillWave className="w-5 h-5 text-orange-500" />
                            </span>
                            {t('customerBalanceOverview')}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">{t('showingDataFor')}: {filteredCustomers.length} {filteredCustomers.length === 1 ? t('customer') : t('customers')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchCustomerBalance(true)}
                        disabled={refreshing || loading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-orange-500/20 border border-gray-200 hover:border-orange-300 text-gray-600 hover:text-orange-500 transition-all disabled:opacity-60 text-sm font-medium"
                    >
                        <FaSyncAlt className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {t('refresh')}
                    </button>
                </div>

                {/* Summary Cards */}
                {!loading && filteredCustomers.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-xl p-4 border border-blue-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('totalCustomers')}</p>
                            <p className="text-xl sm:text-2xl font-bold text-gray-800 font-mono">{filteredCustomers.length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-transparent rounded-xl p-4 border border-red-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FaArrowDown className="w-3 h-3" />
                                {t('yene')} ({t('total')})
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-red-600 font-mono">{formatCurrency(totalYene)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-transparent rounded-xl p-4 border border-blue-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <FaArrowUp className="w-3 h-3" />
                                {t('dene')} ({t('total')})
                            </p>
                            <p className="text-xl sm:text-2xl font-bold text-blue-600 font-mono">{formatCurrency(totalDene)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-transparent rounded-xl p-4 border border-green-200">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('aad')} ({t('total')})</p>
                            <p className={`text-xl sm:text-2xl font-bold font-mono ${totalAad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(totalAad)}
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-transparent rounded-xl p-4 border border-purple-200 col-span-2 lg:col-span-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('balanceStatus')}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-green-600 font-semibold text-sm">+{positiveBalance}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-red-600 font-semibold text-sm">-{negativeBalance}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Search and Filters */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4">
                    {/* Search Bar */}
                    <div className="relative">
                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder={t('searchByNameOrSrNo')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all text-sm sm:text-base"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleExportCSV}
                            disabled={filteredCustomers.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors text-sm shadow-sm hover:shadow-md"
                        >
                            <FaFileCsv className="w-4 h-4" />
                            {t('exportCustomerBalanceCSV')}
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            disabled={filteredCustomers.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors text-sm shadow-sm hover:shadow-md print:hidden"
                        >
                            <FaPrint className="w-4 h-4" />
                            {t('print')}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
                        <div className="flex-shrink-0">
                            <FaTimes className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-red-800 font-medium">{t('error')}</p>
                            <p className="text-red-600 text-sm mt-1">{error}</p>
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {updateSuccess && (
                    <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 flex items-start gap-3">
                        <div className="flex-shrink-0">
                            <FaCheck className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-green-800 font-medium">{t('success')}</p>
                            <p className="text-green-600 text-sm mt-1">{updateSuccess}</p>
                        </div>
                    </div>
                )}

                {/* Update Error Message */}
                {updateError && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start gap-3">
                        <div className="flex-shrink-0">
                            <FaTimes className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1">
                            <p className="text-red-800 font-medium">{t('error')}</p>
                            <p className="text-red-600 text-sm mt-1">{updateError}</p>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
                            <p className="mt-4 text-gray-400">{t('loading')}</p>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-400 text-lg font-medium">{t('noData')}</p>
                            <p className="text-gray-500 text-sm mt-2">
                                {searchQuery ? t('noResultsFound') : t('noCustomersAvailable')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">{t('srNo')}</th>
                                        <th className="px-4 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[150px]">{t('name')}</th>
                                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px]">{t('yene')}</th>
                                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px]">{t('dene')}</th>
                                        <th className="px-4 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[130px]">{t('aad')}</th>
                                        <th className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-24">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredCustomers.map((customer) => {
                                        const isEditing = editingId === customer.userId;
                                        return (
                                            <tr 
                                                key={customer.userId} 
                                                className={`hover:bg-orange-50/50 transition-colors ${isEditing ? 'bg-orange-50' : ''}`}
                                            >
                                                <td className="px-4 py-4 text-sm font-medium text-gray-600">{customer.srNo}</td>
                                                <td className="px-4 py-4">
                                                    <div className="font-semibold text-gray-800">{customer.name}</div>
                                                    {customer.phone && (
                                                        <div className="text-xs text-gray-500 mt-0.5">{customer.phone}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    {isEditing ? (
                                                        <div className="flex justify-end">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={editValues.yene}
                                                                onChange={(e) => setEditValues({ ...editValues, yene: e.target.value })}
                                                                className="w-28 px-3 py-2 border-2 border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                                                                disabled={updating}
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-right">
                                                            <span className="font-mono font-semibold text-red-600 text-base">
                                                                {formatCurrency(customer.yene)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    {isEditing ? (
                                                        <div className="flex justify-end">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={editValues.dene}
                                                                onChange={(e) => setEditValues({ ...editValues, dene: e.target.value })}
                                                                className="w-28 px-3 py-2 border-2 border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-mono"
                                                                disabled={updating}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-right">
                                                            <span className="font-mono font-semibold text-blue-600 text-base">
                                                                {formatCurrency(customer.dene)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-sm">
                                                    <div className="text-right">
                                                        <span className={`font-mono font-bold text-base ${
                                                            customer.aad >= 0 
                                                                ? 'text-green-600' 
                                                                : 'text-red-600'
                                                        }`}>
                                                            {formatCurrency(customer.aad)}
                                                        </span>
                                                        {customer.aad !== 0 && (
                                                            <div className={`text-xs mt-0.5 flex items-center justify-end gap-1 ${
                                                                customer.aad >= 0 ? 'text-green-500' : 'text-red-500'
                                                            }`}>
                                                                {customer.aad >= 0 ? (
                                                                    <FaArrowUp className="w-2.5 h-2.5" />
                                                                ) : (
                                                                    <FaArrowDown className="w-2.5 h-2.5" />
                                                                )}
                                                                {customer.aad >= 0 ? t('positive') : t('negative')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSave(customer.userId)}
                                                                disabled={updating}
                                                                className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                                                title={t('save')}
                                                            >
                                                                <FaCheck className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={handleCancelEdit}
                                                                disabled={updating}
                                                                className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                                                title={t('cancel')}
                                                            >
                                                                <FaTimes className="w-4 h-4" />
                                                            </button>
                                                            {updating && (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEdit(customer)}
                                                                className="p-2 text-orange-600 hover:text-white hover:bg-orange-600 rounded-lg transition-all shadow-sm hover:shadow-md"
                                                                title={t('edit')}
                                                            >
                                                                <FaEdit className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Summary Footer */}
                {!loading && filteredCustomers.length > 0 && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="text-gray-600">
                                <span className="font-medium">{t('showingDataFor')}:</span>{' '}
                                <span className="font-bold text-gray-800">{filteredCustomers.length}</span>{' '}
                                {filteredCustomers.length === 1 ? t('customer') : t('customers')}
                                {searchQuery && filteredCustomers.length !== customers.length && (
                                    <span className="text-gray-500"> ({t('filteredFrom')} {customers.length})</span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                    {t('positive')}: {positiveBalance}
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    {t('negative')}: {negativeBalance}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Reports;
