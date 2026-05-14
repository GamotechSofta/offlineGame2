import { getCurrentUser } from '../session/userSession';

function getPlayerTokenForSocket() {
  const u = getCurrentUser();
  const t = u?.token;
  if (t && String(t) !== 'cookie-auth') return String(t).trim();
  return '';
}

/**
 * Join the server-side player wallet room so `wallet:update` is delivered to this tab.
 * Call after `io(...)`. Cookie-only sessions rely on `withCredentials` + server cookie parse.
 */
export function attachPlayerWalletSocket(socket) {
  const subscribe = () => {
    const token = getPlayerTokenForSocket();
    socket.emit('wallet:subscribe', token ? { token } : {});
  };
  socket.on('connect', subscribe);
  window.addEventListener('userLogin', subscribe);
  subscribe();
  return () => {
    socket.off('connect', subscribe);
    window.removeEventListener('userLogin', subscribe);
  };
}
