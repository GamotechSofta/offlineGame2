import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { API_BASE_URL, getAuthHeaders, clearUserSession } from '../config/api';
import { getBalance, updateUserBalance } from '../api/bets';
import { getItem } from '../config/storage';

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export function useHeartbeat() {
  const intervalRef = useRef(null);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const userData = await getItem('user');
        if (!userData) return;
        const user = JSON.parse(userData);
        const userId = user?.id || user?._id;
        if (!userId) return;
        const res = await fetch(`${API_BASE_URL}/users/heartbeat`, {
          method: 'POST',
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
      } catch (_) {}
    };

    let mounted = true;
    const run = async () => {
      const userData = await getItem('user');
      if (!mounted || !userData) return;
      sendHeartbeat();
      intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    };
    run();

    const refreshBalance = async () => {
      try {
        const res = await getBalance();
        if (res.success && res.data?.balance != null) await updateUserBalance(res.data.balance);
      } catch (_) {}
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sendHeartbeat();
        refreshBalance();
      }
    });

    const handleLogout = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const unsub = () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      subscription?.remove?.();
    };

    return unsub;
  }, []);
}
