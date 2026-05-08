import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeAdminLive } from '../lib/adminSocket';

const useAdminLiveQueryInvalidation = ({
  enabled = true,
  queryKeys = [],
  throttleMs = 700,
}) => {
  const queryClient = useQueryClient();
  const throttleRef = useRef(null);
  const keysRef = useRef(queryKeys);

  useEffect(() => {
    keysRef.current = Array.isArray(queryKeys) ? queryKeys : [];
  }, [queryKeys]);

  useEffect(() => {
    if (!enabled) return undefined;
    const invalidate = () => {
      if (document.visibilityState !== 'visible') return;
      if (throttleRef.current) return;
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        keysRef.current.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }, throttleMs);
    };
    const unsubscribe = subscribeAdminLive(invalidate, invalidate);
    return () => {
      unsubscribe?.();
      if (throttleRef.current) {
        window.clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [enabled, queryClient, throttleMs]);
};

export default useAdminLiveQueryInvalidation;
