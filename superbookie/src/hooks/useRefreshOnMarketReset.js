import { useEffect, useRef } from 'react';
import { getTodayIST } from '../utils/istDate';

/**
 * Auto-refreshes when IST date changes (market reset at midnight IST).
 * Also refetches when tab becomes visible.
 */
export function useRefreshOnMarketReset(refetch, intervalMs = 60000) {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  const lastDateKeyRef = useRef(null);

  useEffect(() => {
    const checkAndRefetch = () => {
      const today = getTodayIST();
      if (lastDateKeyRef.current !== null && lastDateKeyRef.current !== today) {
        refetchRef.current?.();
      }
      lastDateKeyRef.current = today;
    };

    lastDateKeyRef.current = getTodayIST();
    const interval = setInterval(checkAndRefetch, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchRef.current?.();
        lastDateKeyRef.current = getTodayIST();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);
}
