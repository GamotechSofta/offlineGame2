import { isTraceEnabled, noteApiTrace } from '../services/traceMetricsService.js';
const DEFAULT_SLOW_MS = 250;
const LOG_ALL_REQUESTS = process.env.API_PERF_LOG_ALL === '1';

export const apiPerfLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  let responseBytes = 0;
  let serializationMs = 0;

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (isTraceEnabled()) {
      const serializationStart = process.hrtime.bigint();
      const body = JSON.stringify(payload);
      serializationMs = Number(process.hrtime.bigint() - serializationStart) / 1e6;
      responseBytes = Buffer.byteLength(body);
      if (serializationMs >= DEFAULT_SLOW_MS) {
        console.warn('[api-perf][slow-serialize]', {
          method: req.method,
          path: req.originalUrl || req.url,
          serializationMs: Math.round(serializationMs * 100) / 100,
          responseBytes,
        });
      }
      return res.type('application/json').send(body);
    }
    return originalJson(payload);
  };

  res.on('finish', () => {
    const finishedAt = process.hrtime.bigint();
    const elapsedMs = Number(finishedAt - startedAt) / 1e6;
    const roundedElapsedMs = Math.round(elapsedMs * 100) / 100;
    const level = elapsedMs >= DEFAULT_SLOW_MS ? 'warn' : 'info';
    const payload = {
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: roundedElapsedMs,
    };
    if (level === 'warn') {
      console.warn('[api-perf][slow]', payload);
    } else if (LOG_ALL_REQUESTS) {
      console.log('[api-perf]', payload);
    }
    noteApiTrace({
      method: req.method,
      path: req.originalUrl || req.url,
      durationMs: roundedElapsedMs,
      responseBytes,
      serializationMs,
    });
  });

  next();
};

export const withQueryTiming = async (label, queryFn) => {
  const startedAt = process.hrtime.bigint();
  try {
    return await queryFn();
  } finally {
    const finishedAt = process.hrtime.bigint();
    const elapsedMs = Number(finishedAt - startedAt) / 1e6;
    const roundedElapsedMs = Math.round(elapsedMs * 100) / 100;
    const isSlow = elapsedMs >= DEFAULT_SLOW_MS;
    const logPayload = { label, durationMs: roundedElapsedMs };
    if (isSlow) {
      console.warn('[mongo-perf][slow]', logPayload);
    } else {
      console.log('[mongo-perf]', logPayload);
    }
  }
};
