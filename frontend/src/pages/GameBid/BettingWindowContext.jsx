import React, { createContext, useContext, useMemo } from 'react';
import { isBettingAllowed } from '../../utils/marketTiming';

const BettingWindowContext = createContext({ allowed: true, closeOnly: false, message: null });

export function BettingWindowProvider({ market, children }) {
    const value = useMemo(() => {
        if (!market?.startingTime || !market?.closingTime) return { allowed: true, closeOnly: false, message: null };
        const result = isBettingAllowed(market);
        return {
            allowed: result.allowed,
            closeOnly: result.closeOnly === true,
            message: result.message || null,
        };
    }, [market?.startingTime, market?.closingTime, market?.betClosureTime]);

    return (
        <BettingWindowContext.Provider value={value}>
            {children}
        </BettingWindowContext.Provider>
    );
}

export function useBettingWindow() {
    return useContext(BettingWindowContext);
}
