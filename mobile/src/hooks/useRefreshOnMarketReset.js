import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getTodayIST } from '../utils/marketTiming';

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

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refetchRef.current?.();
        lastDateKeyRef.current = getTodayIST();
      }
    });

    return () => {
      clearInterval(interval);
      subscription?.remove?.();
    };
  }, [intervalMs]);
}
