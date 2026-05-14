import { io } from 'socket.io-client';
import { getAdminSocketUrl } from './auth';
import { traceSocketEmit, traceSocketListener } from './runtimeTrace';

let socketInstance = null;

export function getAdminSocket() {
  if (socketInstance) return socketInstance;
  socketInstance = io(getAdminSocketUrl(), {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return socketInstance;
}

export function connectAdminSocket() {
  const socket = getAdminSocket();
  if (!socket.connected) socket.connect();
  return socket;
}

export function subscribeAdminPayments(onPaymentsUpdate) {
  const socket = connectAdminSocket();
  const handleConnect = () => {
    traceSocketEmit('admin:subscribe');
    socket.emit('admin:subscribe');
  };
  const handlePayments = (payload) => onPaymentsUpdate?.(payload);
  socket.on('connect', handleConnect);
  socket.on('admin:payments:update', handlePayments);
  traceSocketListener('connect', socket.listeners('connect').length);
  traceSocketListener('admin:payments:update', socket.listeners('admin:payments:update').length);
  if (socket.connected) handleConnect();
  return () => {
    socket.off('connect', handleConnect);
    socket.off('admin:payments:update', handlePayments);
    traceSocketListener('connect', socket.listeners('connect').length);
    traceSocketListener('admin:payments:update', socket.listeners('admin:payments:update').length);
  };
}

export function subscribeAdminLive(onDashboardUpdate, onMarketUpdate) {
  const socket = connectAdminSocket();
  const handleConnect = () => {
    traceSocketEmit('admin:subscribe');
    socket.emit('admin:subscribe');
  };
  const handleDashboard = (payload) => onDashboardUpdate?.(payload);
  const handleMarket = (payload) => onMarketUpdate?.(payload);
  socket.on('connect', handleConnect);
  socket.on('admin:dashboard:update', handleDashboard);
  socket.on('admin:market:update', handleMarket);
  traceSocketListener('connect', socket.listeners('connect').length);
  traceSocketListener('admin:dashboard:update', socket.listeners('admin:dashboard:update').length);
  traceSocketListener('admin:market:update', socket.listeners('admin:market:update').length);
  if (socket.connected) handleConnect();
  return () => {
    socket.off('connect', handleConnect);
    socket.off('admin:dashboard:update', handleDashboard);
    socket.off('admin:market:update', handleMarket);
    traceSocketListener('connect', socket.listeners('connect').length);
    traceSocketListener('admin:dashboard:update', socket.listeners('admin:dashboard:update').length);
    traceSocketListener('admin:market:update', socket.listeners('admin:market:update').length);
  };
}
