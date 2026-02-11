import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const BetCartContext = createContext({});

export const BetCartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState([]);

    /**
     * Add bets to the cart.
     * @param {Array} items - Array of { number, points, type/session }
     * @param {string} gameType - URL param game type (e.g. 'single-digit')
     * @param {string} gameLabel - Display label (e.g. 'Single Digit')
     * @param {string} betType - API bet type (e.g. 'single', 'jodi', 'panna', 'full-sangam', 'half-sangam')
     * @returns {number} Number of items added
     */
    const addToCart = useCallback((items, gameType, gameLabel, betType) => {
        const newItems = (items || [])
            .filter((item) => item && (Number(item.points) > 0))
            .map((item) => ({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                gameType,
                gameTypeLabel: gameLabel,
                betType,
                number: String(item.number ?? '').trim(),
                points: Number(item.points) || 0,
                session: (item.type || item.session || 'OPEN').toUpperCase(),
            }));
        if (newItems.length > 0) {
            setCartItems((prev) => [...prev, ...newItems]);
        }
        return newItems.length;
    }, []);

    const removeFromCart = useCallback((id) => {
        setCartItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const clearCart = useCallback(() => {
        setCartItems([]);
    }, []);

    const cartCount = cartItems.length;
    const cartTotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + item.points, 0),
        [cartItems]
    );

    const value = useMemo(() => ({
        cartItems,
        cartCount,
        cartTotal,
        addToCart,
        removeFromCart,
        clearCart,
    }), [cartItems, cartCount, cartTotal, addToCart, removeFromCart, clearCart]);

    return (
        <BetCartContext.Provider value={value}>
            {children}
        </BetCartContext.Provider>
    );
};

export const useBetCart = () => useContext(BetCartContext);
export default BetCartContext;
