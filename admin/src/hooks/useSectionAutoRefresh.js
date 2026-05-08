import { useEffect, useRef } from 'react';
import { subscribeGlobalTicker } from '../lib/globalTicker';

/**
 * Lightweight section-level auto refresh.
 * Keeps existing UI on background polling and refreshes on focus/visibility.
 */
const useSectionAutoRefresh = ({
    enabled = true,
    intervalMs = 15000,
    onRefresh,
    immediate = true,
    refreshOnVisible = true,
}) => {
    const onRefreshRef = useRef(onRefresh);
    const lastRefreshAtRef = useRef(0);

    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!enabled || typeof onRefreshRef.current !== 'function') return;
        if (immediate && lastRefreshAtRef.current === 0) {
            lastRefreshAtRef.current = Date.now();
            onRefreshRef.current?.();
        }
    }, [enabled, immediate]);

    useEffect(() => {
        if (!enabled || typeof onRefreshRef.current !== 'function') return undefined;
        const unsubscribe = subscribeGlobalTicker(({ now, isVisible }) => {
            if (!isVisible) return;
            const elapsed = now - (lastRefreshAtRef.current || 0);
            if (elapsed < intervalMs) return;
            lastRefreshAtRef.current = now;
            onRefreshRef.current?.();
        });
        return unsubscribe;
    }, [enabled, intervalMs]);

    useEffect(() => {
        if (!enabled || !refreshOnVisible || typeof onRefreshRef.current !== 'function') return undefined;
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            lastRefreshAtRef.current = Date.now();
            onRefreshRef.current?.();
        };
        window.addEventListener('focus', onVisible);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.removeEventListener('focus', onVisible);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [enabled, refreshOnVisible]);
};

export default useSectionAutoRefresh;
