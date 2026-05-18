/**
 * Bet screen layout preference: 'cart' (sidebar + cart) or 'single' (all games in one scroll + sticky submit).
 */
export const BOOKIE_BET_LAYOUT_KEY = 'bookie_bet_layout';

export const LAYOUT_CART = 'cart';
export const LAYOUT_SINGLE = 'single';

export const getStoredBetLayout = () => {
    try {
        const v = localStorage.getItem(BOOKIE_BET_LAYOUT_KEY);
        if (v === LAYOUT_SINGLE || v === LAYOUT_CART) return v;
    } catch (e) { /* ignore */ }
    return LAYOUT_CART;
};

export const setStoredBetLayout = (value) => {
    try {
        if (value === LAYOUT_SINGLE || value === LAYOUT_CART) {
            localStorage.setItem(BOOKIE_BET_LAYOUT_KEY, value);
        }
    } catch (e) { /* ignore */ }
};
