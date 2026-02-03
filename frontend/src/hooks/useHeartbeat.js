import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config/api';
import { getBalance, updateUserBalance } from '../api/bets';

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute – also used to detect suspended accounts

const logoutSuspendedUser = () => {
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('userLogout'));
  window.location.href = '/login';
};

export const useHeartbeat = () => {
  const intervalRef = useRef(null);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const userData = localStorage.getItem('user');
        if (!userData) return;
        const user = JSON.parse(userData);
        const userId = user?.id || user?._id;
        if (!userId) return;
        const res = await fetch(`${API_BASE_URL}/users/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!data.success && data.code === 'ACCOUNT_SUSPENDED') {
          logoutSuspendedUser();
        } else if (!res.ok && res.status === 403) {
          logoutSuspendedUser();
        }
      } catch {
        // Silently ignore network errors
      }
    };

    const userData = localStorage.getItem('user');
    if (!userData) return;

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
      window.removeEventListener('userLogout', handleLogout);
    };
  }, []);
};
