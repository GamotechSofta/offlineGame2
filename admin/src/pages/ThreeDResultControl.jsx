import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { clearAdminSession, fetchWithAuth } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3010/api/v1';

const ThreeDResultControl = () => {
    const navigate = useNavigate();
    const [currentSlot, setCurrentSlot] = useState(null);
    const [hasSecretDeclarePassword, setHasSecretDeclarePassword] = useState(false);
    const [pagePassword, setPagePassword] = useState('');
    const [pageUnlocked, setPageUnlocked] = useState(false);
    const [unlockingPage, setUnlockingPage] = useState(false);
    const [pageUnlockError, setPageUnlockError] = useState('');
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const handleLogout = useCallback(() => {
        clearAdminSession();
        navigate('/');
    }, [navigate]);

    const fetchCurrentSlot = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot`);
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to load current slot');
            setCurrentSlot(data?.data?.slot || null);
        } catch (err) {
            setError(err.message || 'Failed to load current slot');
            setCurrentSlot(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWithAuth(`${API_BASE_URL}/admin/me/secret-declare-password-status`)
            .then((res) => (res.status === 401 ? null : res.json()))
            .then((json) => {
                if (json?.success) {
                    const hasPassword = Boolean(json?.hasSecretDeclarePassword);
                    setHasSecretDeclarePassword(hasPassword);
                    setPageUnlocked(!hasPassword);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!hasSecretDeclarePassword || pageUnlocked) {
            fetchCurrentSlot();
        }
    }, [fetchCurrentSlot, hasSecretDeclarePassword, pageUnlocked]);

    const unlockPage = useCallback(async () => {
        const secret = pagePassword.trim();
        if (!secret) {
            setPageUnlockError('Please enter security password');
            return;
        }
        setUnlockingPage(true);
        setPageUnlockError('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/current-slot/hints`, {
                method: 'POST',
                body: JSON.stringify({ secretDeclarePassword: secret }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Invalid security password');
            setPageUnlocked(true);
            setPagePassword('');
        } catch (err) {
            setPageUnlocked(false);
            setPageUnlockError(err?.message || 'Invalid security password');
        } finally {
            setUnlockingPage(false);
        }
    }, [pagePassword]);

    const updateDeclaration = useCallback(async (action) => {
        const slotStartIso = currentSlot?.slotStartIso;
        if (!slotStartIso) return;
        setUpdating(true);
        setError('');
        setNotice('');
        try {
            const res = await fetchWithAuth(`${API_BASE_URL}/admin/lottery3d/slots/declaration`, {
                method: 'PATCH',
                body: JSON.stringify({ slotStartIso, action }),
            });
            if (res.status === 401) return;
            const data = await res.json();
            if (!data?.success) throw new Error(data?.message || 'Failed to update declaration');
            setCurrentSlot((prev) => (
                prev
                    ? {
                        ...prev,
                        declaration: data?.data?.declaration || prev.declaration || null,
                    }
                    : prev
            ));
            setNotice(action === 'declare' ? 'Result declared successfully.' : 'Auto declare preference updated.');
        } catch (err) {
            setError(err.message || 'Failed to update declaration');
        } finally {
            setUpdating(false);
        }
    }, [currentSlot?.slotStartIso]);

    const declaration = currentSlot?.declaration || {};
    const slotEndMs = currentSlot?.slotEndIso ? new Date(currentSlot.slotEndIso).getTime() : null;
    const canDeclareNow = Number.isFinite(slotEndMs) ? Date.now() >= slotEndMs : false;
    const statusLabel = declaration.declared
        ? 'Declared'
        : (declaration.autoDeclareBlocked ? 'Auto declare paused' : 'Auto declare enabled');

    return (
        <AdminLayout onLogout={handleLogout} title="3D Result Control">
            <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">3D Result Declaration Control</h1>
                        <p className="text-sm text-gray-500">Hold automatic result declaration and declare manually when needed.</p>
                    </div>
                    <button
                        type="button"
                        onClick={fetchCurrentSlot}
                        className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                        disabled={loading}
                    >
                        {loading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div> : null}
                {notice ? <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">{notice}</div> : null}

                {hasSecretDeclarePassword && !pageUnlocked ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-5 max-w-xl">
                        <h3 className="text-lg font-semibold text-gray-800">Unlock Result Control</h3>
                        <p className="text-sm text-gray-500 mt-1">Enter security password to view Result Control content.</p>
                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                            <input
                                type="password"
                                value={pagePassword}
                                onChange={(e) => {
                                    setPagePassword(e.target.value);
                                    setPageUnlockError('');
                                }}
                                placeholder="Enter security password"
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                            />
                            <button
                                type="button"
                                onClick={unlockPage}
                                disabled={unlockingPage}
                                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold"
                            >
                                {unlockingPage ? 'Unlocking...' : 'Unlock'}
                            </button>
                        </div>
                        {pageUnlockError ? <p className="mt-2 text-sm text-red-600">{pageUnlockError}</p> : null}
                    </div>
                ) : null}

                {hasSecretDeclarePassword && !pageUnlocked ? null : (
                    <>

                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-gray-500">Current Slot Start</p>
                            <p className="font-semibold text-gray-800 break-all">{currentSlot?.slotStartIso || '--'}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 p-3">
                            <p className="text-gray-500">Declaration Status</p>
                            <p className="font-semibold text-gray-800">{statusLabel}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                        {declaration.declared ? (
                            <span className="text-sm text-gray-500 font-medium">This slot is locked after declaration.</span>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => updateDeclaration('hold')}
                                    disabled={updating || loading || !currentSlot?.slotStartIso}
                                    className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-semibold disabled:opacity-60"
                                >
                                    Hold Auto Declare
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateDeclaration('auto')}
                                    disabled={updating || loading || !currentSlot?.slotStartIso}
                                    className="px-3 py-2 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 text-sm font-semibold disabled:opacity-60"
                                >
                                    Enable Auto Declare
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateDeclaration('declare')}
                                    disabled={updating || loading || !currentSlot?.slotStartIso || !canDeclareNow}
                                    className="px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:bg-green-400"
                                >
                                    {updating ? 'Updating...' : (canDeclareNow ? 'Declare Now' : 'Wait Slot End')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default ThreeDResultControl;

