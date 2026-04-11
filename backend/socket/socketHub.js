import { Server } from 'socket.io';

/** @type {Server | null} */
let io = null;

/**
 * Attach Socket.IO to the HTTP server (same port as Express API).
 * @param {import('http').Server} httpServer
 * @param {{ allowedOrigins: string[]; isProduction: boolean }} opts
 */
export function initQuizSocket(httpServer, opts) {
  const { allowedOrigins, isProduction } = opts;
  const allowAll = !allowedOrigins?.length || allowedOrigins.includes('*');
  const origin =
    !isProduction || allowAll
      ? true
      : allowedOrigins;

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', () => {
    /* optional: connection logging */
  });

  // eslint-disable-next-line no-console
  console.log('[socket] quiz Socket.IO ready at /socket.io');
  return io;
}

/** @returns {Server | null} */
export function getQuizSocketIo() {
  return io;
}
