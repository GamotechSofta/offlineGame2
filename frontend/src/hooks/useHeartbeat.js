import { useEffect, useRef } from 'react';
import { API_BASE_URL, getAuthHeaders, clearUserSession } from '../config/api';
import { getBalance, updateUserBalance } from '../api/bets';
import { isUserLoggedIn } from '../session/userSession';

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute – also used to detect suspended accounts

export const useHeartbeat = () => {
  const intervalRef = useRef(null);
  const lastInteractionHeartbeatRef = useRef(0);

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

    const triggerHeartbeatOnInteraction = () => {
      const now = Date.now();
      // Avoid calling heartbeat on every tap/click burst.
      if (now - lastInteractionHeartbeatRef.current < 10000) return;
      lastInteractionHeartbeatRef.current = now;
      sendHeartbeat();
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
    document.addEventListener('click', triggerHeartbeatOnInteraction, true);
    document.addEventListener('touchstart', triggerHeartbeatOnInteraction, true);

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
      document.removeEventListener('click', triggerHeartbeatOnInteraction, true);
      document.removeEventListener('touchstart', triggerHeartbeatOnInteraction, true);
      window.removeEventListener('userLogout', handleLogout);
    };
  }, []);
};
