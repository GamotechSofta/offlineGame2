import { useEffect, useRef } from 'react';
import { subscribeAdminLive } from '../lib/adminSocket';

const useAdminLiveInvalidation = ({
  enabled = true,
  onInvalidate,
  throttleMs = 800,
}) => {
  const invalidateRef = useRef(onInvalidate);
  const throttleRef = useRef(null);

  useEffect(() => {
    invalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    if (!enabled || typeof invalidateRef.current !== 'function') return undefined;
    const runThrottled = () => {
      if (document.visibilityState !== 'visible') return;
      if (throttleRef.current) return;
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        invalidateRef.current?.();
      }, throttleMs);
    };
    const unsubscribe = subscribeAdminLive(runThrottled, runThrottled);
    return () => {
      unsubscribe?.();
      if (throttleRef.current) {
        window.clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [enabled, throttleMs]);
};

export default useAdminLiveInvalidation;
