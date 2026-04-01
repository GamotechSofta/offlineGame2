import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimesCircle } from 'react-icons/fa';
import { isBettingAllowed } from '../../utils/marketTiming';

const BettingWindowContext = createContext({ allowed: true, closeOnly: false, message: null });

function computeWindowState(market) {
    if (!market?.startingTime || !market?.closingTime) {
        return { allowed: true, closeOnly: false, message: null };
    }
    const result = isBettingAllowed(market);
    return {
        allowed: result.allowed,
        closeOnly: result.closeOnly === true,
        message: result.message || null,
    };
}

function MarketClosedModal({ market, allowed }) {
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);
    const prevAllowedRef = useRef(null);
    const hasShownRef = useRef(false);
    const marketIdRef = useRef(null);

    useEffect(() => {
        const mid = market?._id || market?.id || null;
        if (mid !== marketIdRef.current) {
            marketIdRef.current = mid;
            hasShownRef.current = false;
            prevAllowedRef.current = null;
            setVisible(false);
        }
    }, [market?._id, market?.id]);

    useEffect(() => {
        if (prevAllowedRef.current === true && allowed === false && !hasShownRef.current) {
            hasShownRef.current = true;
            setVisible(true);
        }
        prevAllowedRef.current = allowed;
    }, [allowed]);

    const goHome = () => {
        setVisible(false);
        navigate('/', { replace: true });
    };

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70"
            role="dialog"
            aria-modal="true"
            aria-labelledby="market-closed-title"
        >
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
                <button
                    type="button"
                    onClick={goHome}
                    className="absolute top-3 right-3 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                >
                    <span className="text-2xl font-light leading-none">×</span>
                </button>
                <div className="pt-10 pb-6 px-6 text-center">
                    <div className="flex justify-center mb-4">
                        <FaTimesCircle className="w-20 h-20 text-red-500" aria-hidden />
                    </div>
                    <h2 id="market-closed-title" className="text-xl font-bold text-gray-900 mb-2">
                        Market is closed
                    </h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Betting for this market has ended. You will be taken to the home page.
                    </p>
                    <button
                        type="button"
                        onClick={goHome}
                        className="w-full py-3 rounded-xl bg-[#1B3150] text-white font-semibold text-base hover:bg-[#152842] transition-colors"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}

export function BettingWindowProvider({ market, children }) {
    const [windowState, setWindowState] = useState(() => computeWindowState(market));

    useEffect(() => {
        const tick = () => setWindowState(computeWindowState(market));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [market?._id, market?.id, market?.startingTime, market?.closingTime, market?.betClosureTime]);

    const value = useMemo(
        () => ({
            allowed: windowState.allowed,
            closeOnly: windowState.closeOnly,
            message: windowState.message,
        }),
        [windowState.allowed, windowState.closeOnly, windowState.message]
    );

    return (
        <BettingWindowContext.Provider value={value}>
            <MarketClosedModal market={market} allowed={windowState.allowed} />
            {children}
        </BettingWindowContext.Provider>
    );
}

export function useBettingWindow() {
    return useContext(BettingWindowContext);
}
