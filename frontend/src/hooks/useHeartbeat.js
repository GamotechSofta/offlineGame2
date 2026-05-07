import { useEffect, useRef } from 'react';
import { API_BASE_URL, getAuthHeaders, clearUserSession } from '../config/api';
import { getBalance, updateUserBalance } from '../api/bets';
import { isUserLoggedIn } from '../session/userSession';

const HEARTBEAT_INTERVAL_MS = 10 * 1000; // Faster session invalidation detection across devices

export const useHeartbeat = () => {
  const intervalRef = useRef(null);
  const interactionHeartbeatInFlightRef = useRef(false);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        if (!isUserLoggedIn()) return;
        const res = await fetch(`${API_BASE_URL}/users/heartbeat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({}),
        });
        if (res.status === 401) {
          clearUserSession();
          return;
        }
        const data = await res.json();
        if (!data.success && data.code === 'ACCOUNT_SUSPENDED') {
          clearUserSession();
        } else if (!res.ok && res.status === 403) {
          clearUserSession();
        }
      } catch {
        // Silently ignore network errors
      }
    };

    if (!isUserLoggedIn()) return;

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    const refreshBalance = async () => {
      try {
        const res = await getBalance();
        if (res.success && res.data?.balance != null) updateUserBalance(res.data.balance);
      } catch (_) {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        refreshBalance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleUserInteraction = () => {
      if (interactionHeartbeatInFlightRef.current) return;
      interactionHeartbeatInFlightRef.current = true;
      Promise.resolve(sendHeartbeat()).finally(() => {
        interactionHeartbeatInFlightRef.current = false;
      });
    };
    document.addEventListener('click', handleUserInteraction, true);
    document.addEventListener('touchstart', handleUserInteraction, true);

    const handleLogout = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    window.addEventListener('userLogout', handleLogout);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleUserInteraction, true);
      document.removeEventListener('touchstart', handleUserInteraction, true);
      window.removeEventListener('userLogout', handleLogout);
    };
  }, []);
};
