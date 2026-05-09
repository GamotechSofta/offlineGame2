const TRACE_ENABLED = process.env.TRACE_RUNTIME === '1';
const SLOW_API_MS = Number(process.env.TRACE_SLOW_API_MS || 500);
const SLOW_MONGO_MS = Number(process.env.TRACE_SLOW_MONGO_MS || 150);
const LARGE_PAYLOAD_BYTES = Number(process.env.TRACE_LARGE_PAYLOAD_BYTES || 250_000);

const traceState = {
  enabled: TRACE_ENABLED,
  api: {
    total: 0,
    slow: 0,
    byPath: {},
    largeResponses: 0,
    largestResponseBytes: 0,
    largestResponsePath: '',
  },
  mongo: {
    total: 0,
    slow: 0,
    byModelOp: {},
    slowest: [],
  },
  socket: {
    emits: {},
    listeners: {},
    duplicateListenerWarnings: 0,
  },
};

function pushSlowMongo(entry) {
  traceState.mongo.slowest.push(entry);
  if (traceState.mongo.slowest.length > 15) {
    traceState.mongo.slowest.sort((a, b) => b.durationMs - a.durationMs);
    traceState.mongo.slowest.length = 15;
  }
}

export function isTraceEnabled() {
  return traceState.enabled;
}

export function noteApiTrace({ method, path, durationMs, responseBytes }) {
  if (!traceState.enabled) return;
  traceState.api.total += 1;
  const key = `${method} ${path}`;
  const stat = traceState.api.byPath[key] || { count: 0, slow: 0, totalMs: 0, maxMs: 0, avgMs: 0 };
  stat.count += 1;
  stat.totalMs += durationMs;
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  if (durationMs >= SLOW_API_MS) {
    stat.slow += 1;
    traceState.api.slow += 1;
  }
  stat.avgMs = Number((stat.totalMs / stat.count).toFixed(2));
  traceState.api.byPath[key] = stat;

  if (responseBytes >= LARGE_PAYLOAD_BYTES) {
    traceState.api.largeResponses += 1;
  }
  if (responseBytes > traceState.api.largestResponseBytes) {
    traceState.api.largestResponseBytes = responseBytes;
    traceState.api.largestResponsePath = key;
  }
}

export function noteMongoTrace({ model, op, durationMs, collection, filterShape }) {
  if (!traceState.enabled) return;
  traceState.mongo.total += 1;
  const key = `${model}.${op}`;
  const stat = traceState.mongo.byModelOp[key] || { count: 0, slow: 0, totalMs: 0, maxMs: 0, avgMs: 0 };
  stat.count += 1;
  stat.totalMs += durationMs;
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  if (durationMs >= SLOW_MONGO_MS) {
    stat.slow += 1;
    traceState.mongo.slow += 1;
    pushSlowMongo({
      model,
      op,
      collection,
      durationMs: Number(durationMs.toFixed(2)),
      filterShape,
      sampledAt: new Date().toISOString(),
    });
  }
  stat.avgMs = Number((stat.totalMs / stat.count).toFixed(2));
  traceState.mongo.byModelOp[key] = stat;
}

export function noteSocketEmit(event) {
  if (!traceState.enabled) return;
  traceState.socket.emits[event] = (traceState.socket.emits[event] || 0) + 1;
}

export function noteSocketListener(event, listenerCount) {
  if (!traceState.enabled) return;
  traceState.socket.listeners[event] = listenerCount;
  if (listenerCount > 15) {
    traceState.socket.duplicateListenerWarnings += 1;
  }
}

export function getTraceMetrics() {
  return {
    ...traceState,
    thresholds: {
      slowApiMs: SLOW_API_MS,
      slowMongoMs: SLOW_MONGO_MS,
      largePayloadBytes: LARGE_PAYLOAD_BYTES,
    },
  };
}
