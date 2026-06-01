import { useEffect, useRef } from 'react';
import { API_BASE_URL, getBookieAuthHeaders, clearBookieSession, AUTH_KEY } from '../utils/api';

const HEARTBEAT_INTERVAL_MS = 60 * 1000;

const logoutSuspended = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '/';
};

export const useHeartbeat = () => {
    const intervalRef = useRef(null);

    useEffect(() => {
        const sendHeartbeat = async () => {
            try {
                const session = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
                if (!session?.token) return;

                const res = await fetch(`${API_BASE_URL}/super-bookie/heartbeat`, {
                    method: 'POST',
                    headers: getBookieAuthHeaders(),
                    body: JSON.stringify({}),
                });
                const data = await res.json();

                if (res.status === 401) {
                    clearBookieSession();
                    return;
                }
                if (!data.success && data.code === 'ACCOUNT_SUSPENDED') {
                    logoutSuspended();
                } else if (!res.ok && res.status === 403) {
                    logoutSuspended();
                }
            } catch {
                // ignore network errors
            }
        };

        if (!localStorage.getItem(AUTH_KEY)) return;

        sendHeartbeat();
        intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

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
