import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AUTH_KEY } from '../utils/api';
import { subscribeBookiePanelBalance, disconnectPanelSocket } from '../lib/panelSocket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [bookie, setBookie] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            try {
                const stored = localStorage.getItem(AUTH_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed?.role && parsed.role !== 'super_bookie') {
                        localStorage.removeItem(AUTH_KEY);
                        setBookie(null);
                    } else {
                        setBookie(parsed);
                    }
                } else setBookie(null);
            } catch {
                setBookie(null);
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
        const handleStorage = (e) => {
            if (e.key === AUTH_KEY) checkAuth();
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const login = (data) => {
        localStorage.setItem(AUTH_KEY, JSON.stringify(data));
        setBookie(data);
    };

    const logout = () => {
        disconnectPanelSocket();
        localStorage.removeItem(AUTH_KEY);
        setBookie(null);
    };

    const updateBookie = useCallback((newData) => {
        setBookie((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, ...newData };
            localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    useEffect(() => {
        if (!bookie?.token) return undefined;
        const unsub = subscribeBookiePanelBalance((payload) => {
            updateBookie({ balance: Number(payload.balance) });
        });
        return unsub;
    }, [bookie?.token, updateBookie]);

    return (
        <AuthContext.Provider value={{ bookie, loading, login, logout, updateBookie }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
