import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getStoredBetLayout, setStoredBetLayout, LAYOUT_CART, LAYOUT_SINGLE, BOOKIE_BET_LAYOUT_KEY } from '../utils/bookieLayout';

const BetLayoutContext = createContext({
    layout: LAYOUT_CART,
    setLayout: () => {},
});

export const BetLayoutProvider = ({ children }) => {
    const [layout, setLayoutState] = useState(getStoredBetLayout);

    const setLayout = useCallback((value) => {
        if (value !== LAYOUT_CART && value !== LAYOUT_SINGLE) return;
        setStoredBetLayout(value);
        setLayoutState(value);
    }, []);

    // Sync from storage when it changes (e.g. Settings in same app or another tab)
    useEffect(() => {
        const sync = () => setLayoutState(getStoredBetLayout());
        sync();
        const onStorage = (e) => {
            if (e.key === BOOKIE_BET_LAYOUT_KEY && (e.newValue === LAYOUT_CART || e.newValue === LAYOUT_SINGLE)) {
                setLayoutState(e.newValue);
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    return (
        <BetLayoutContext.Provider value={{ layout, setLayout }}>
            {children}
        </BetLayoutContext.Provider>
    );
};

export const useBetLayout = () => {
    const ctx = useContext(BetLayoutContext);
    if (!ctx) {
        return {
            layout: getStoredBetLayout(),
            setLayout: (v) => setStoredBetLayout(v),
        };
    }
    return ctx;
};
