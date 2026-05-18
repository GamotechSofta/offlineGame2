import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AUTH_KEY } from '../utils/api';
import { subscribeBookiePanelBalance, disconnectPanelSocket } from '../lib/panelSocket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [superBookie, setSuperBookie] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = () => {
            try {
                const stored = localStorage.getItem(AUTH_KEY);
                if (stored) setSuperBookie(JSON.parse(stored));
                else setSuperBookie(null);
            } catch {
                setSuperBookie(null);
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
        setSuperBookie(data);
    };

    const logout = () => {
        disconnectPanelSocket();
        localStorage.removeItem(AUTH_KEY);
        setSuperBookie(null);
    };

    const updateSuperBookie = useCallback((newData) => {
        setSuperBookie((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, ...newData };
            localStorage.setItem(AUTH_KEY, JSON.stringify(updated));
            return updated;
        });
    }, []);

    useEffect(() => {
        if (!superBookie?.token) return undefined;
        const unsub = subscribeBookiePanelBalance((payload) => {
            updateSuperBookie({ balance: Number(payload.balance) });
        });
        return unsub;
    }, [superBookie?.token, updateSuperBookie]);

    return (
        <AuthContext.Provider value={{ superBookie, bookie: superBookie, loading, login, logout, updateBookie: updateSuperBookie, updateSuperBookie }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
