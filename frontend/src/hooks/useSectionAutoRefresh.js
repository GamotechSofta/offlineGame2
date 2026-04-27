import { useEffect, useRef } from 'react';

/**
 * Section-level auto refresh utility.
 * Runs only when enabled and page is visible; can also refresh on focus/visibility regain.
 */
export const useSectionAutoRefresh = ({
  enabled = true,
  intervalMs = 15000,
  onRefresh,
  immediate = true,
  refreshOnVisible = true,
}) => {
  const refreshRef = useRef(onRefresh);
  const lastRunRef = useRef(0);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || typeof refreshRef.current !== 'function') return undefined;

    const run = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      lastRunRef.current = Date.now();
      refreshRef.current?.();
    };

    if (immediate) run();

    const id = setInterval(run, Math.max(1000, Number(intervalMs) || 15000));
    const onVisible = () => {
      if (!refreshOnVisible) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const now = Date.now();
      // Avoid double refresh when interval just fired.
      if (now - lastRunRef.current < 500) return;
      run();
    };

    if (typeof window !== 'undefined') window.addEventListener('focus', onVisible);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onVisible);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, immediate, intervalMs, refreshOnVisible]);
};

export default useSectionAutoRefresh;
