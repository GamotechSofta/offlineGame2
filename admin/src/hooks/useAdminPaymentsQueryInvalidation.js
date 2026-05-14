import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeAdminPayments } from '../lib/adminSocket';

/**
 * Refetches payment list / pending counts only when the server emits `admin:payments:update`
 * (deposit/withdrawal lifecycle), not on every generic admin dashboard/market tick.
 */
const useAdminPaymentsQueryInvalidation = ({
  enabled = true,
  queryKeys = [],
  throttleMs = 600,
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
      if (throttleRef.current) return;
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        keysRef.current.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }, throttleMs);
    };
    const unsubscribe = subscribeAdminPayments(invalidate);
    return () => {
      unsubscribe?.();
      if (throttleRef.current) {
        window.clearTimeout(throttleRef.current);
        throttleRef.current = null;
      }
    };
  }, [enabled, queryClient, throttleMs]);
};

export default useAdminPaymentsQueryInvalidation;
