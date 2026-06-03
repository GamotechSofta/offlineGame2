import { io } from 'socket.io-client';
import { getPanelSocketUrl } from '../utils/api';

const AUTH_KEY = 'bookie';

function getStoredToken() {
    try {
        const session = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
        return session?.token || '';
    } catch {
        return '';
    }
}

let socketInstance = null;

export function getPanelSocket() {
    if (!socketInstance) {
        socketInstance = io(getPanelSocketUrl(), {
            path: '/socket.io',
            transports: ['websocket'],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });
    }
    return socketInstance;
}

/**
 * Live bookie / super bookie panel balance (sidebar, game bid context).
 * @param {(payload: { balance: number, reason?: string }) => void} onBalanceUpdate
 */
export function subscribeBookiePanelPayments(onPaymentsUpdate) {
    const socket = getPanelSocket();

    const handleConnect = () => {
        const token = getStoredToken();
        if (!token) return;
        socket.auth = { token };
        socket.emit('bookie:subscribe', { token });
    };

    const handlePayments = (payload) => onPaymentsUpdate?.(payload);

    socket.on('connect', handleConnect);
    socket.on('bookie:payments:update', handlePayments);

    const token = getStoredToken();
    if (token) {
        if (!socket.connected) socket.connect();
        else handleConnect();
    }

    return () => {
        socket.off('connect', handleConnect);
        socket.off('bookie:payments:update', handlePayments);
    };
}

export function subscribeBookiePanelBalance(onBalanceUpdate) {
    const socket = getPanelSocket();

    const handleConnect = () => {
        const token = getStoredToken();
        if (!token) return;
        socket.auth = { token };
        socket.emit('bookie:subscribe', { token });
    };

    const handleBalance = (payload) => {
        if (payload && Number.isFinite(Number(payload.balance))) {
            onBalanceUpdate?.(payload);
        }
    };

    socket.on('connect', handleConnect);
    socket.on('bookie:balance:update', handleBalance);

    const token = getStoredToken();
    if (token) {
        if (!socket.connected) socket.connect();
        else handleConnect();
    }

    return () => {
        socket.off('connect', handleConnect);
        socket.off('bookie:balance:update', handleBalance);
    };
}

export function disconnectPanelSocket() {
    if (socketInstance?.connected) {
        socketInstance.disconnect();
    }
}
