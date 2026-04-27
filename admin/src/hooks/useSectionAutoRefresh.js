import { useEffect, useRef } from 'react';

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

    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    useEffect(() => {
        if (!enabled || typeof onRefreshRef.current !== 'function') return undefined;

        const refreshNow = () => {
            if (document.visibilityState !== 'visible') return;
            onRefreshRef.current?.();
        };

        if (immediate) refreshNow();
        const timerId = window.setInterval(refreshNow, intervalMs);

        const onVisible = () => {
            if (!refreshOnVisible) return;
            if (document.visibilityState === 'visible') {
                onRefreshRef.current?.();
            }
        };

        if (refreshOnVisible) {
            window.addEventListener('focus', onVisible);
            document.addEventListener('visibilitychange', onVisible);
        }

        return () => {
            window.clearInterval(timerId);
            if (refreshOnVisible) {
                window.removeEventListener('focus', onVisible);
                document.removeEventListener('visibilitychange', onVisible);
            }
        };
    }, [enabled, intervalMs, immediate, refreshOnVisible]);
};

export default useSectionAutoRefresh;
