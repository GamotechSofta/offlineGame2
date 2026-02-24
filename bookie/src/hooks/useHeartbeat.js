import { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../utils/api';
import { getBookieAuthHeaders } from '../utils/api';

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute – also detects suspended accounts

const logoutSuspendedBookie = () => {
  localStorage.removeItem('bookie');
  window.location.href = '/';
};

export const useHeartbeat = () => {
  const intervalRef = useRef(null);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const bookie = JSON.parse(localStorage.getItem('bookie') || 'null');
        if (!bookie) return;

        const res = await fetch(`${API_BASE_URL}/bookie/heartbeat`, {
          method: 'POST',
          headers: getBookieAuthHeaders(),
          body: JSON.stringify({}),
        });
        const data = await res.json();

        if (!data.success && data.code === 'ACCOUNT_SUSPENDED') {
          logoutSuspendedBookie();
        } else if (!res.ok && res.status === 403) {
          logoutSuspendedBookie();
        }
      } catch {
        // Silently ignore network errors
      }
    };

    const bookie = localStorage.getItem('bookie');
    if (!bookie) return;

    sendHeartbeat();
    intervalRef.current = setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
};
