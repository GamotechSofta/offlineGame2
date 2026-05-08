const TRACE_FLAG_KEY = 'adminTraceEnabled';
const WARN_RERENDER_THRESHOLD = 25;

function ensureStore() {
  if (typeof window === 'undefined') return null;
  if (!window.__adminTrace) {
    window.__adminTrace = {
      renders: {},
      api: { total: 0, byPath: {}, slow: [] },
      query: { invalidations: {}, fetches: {} },
      socket: { emits: {}, listeners: {} },
      marks: [],
    };
  }
  return window.__adminTrace;
}

export function isAdminTraceEnabled() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TRACE_FLAG_KEY) === '1';
}

export function traceRender(name) {
  if (!isAdminTraceEnabled()) return;
  const store = ensureStore();
  if (!store) return;
  store.renders[name] = (store.renders[name] || 0) + 1;
  if (store.renders[name] === WARN_RERENDER_THRESHOLD) {
    // eslint-disable-next-line no-console
    console.warn('[trace][render-storm]', { component: name, count: store.renders[name] });
  }
}

export function traceApi({ method, url, durationMs, responseBytes }) {
  if (!isAdminTraceEnabled()) return;
  const store = ensureStore();
  if (!store) return;
  const key = `${method} ${url}`;
  const stat = store.api.byPath[key] || { count: 0, totalMs: 0, avgMs: 0, maxMs: 0, bytes: 0 };
  stat.count += 1;
  stat.totalMs += durationMs;
  stat.avgMs = Number((stat.totalMs / stat.count).toFixed(2));
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  stat.bytes = Math.max(stat.bytes, responseBytes || 0);
  store.api.byPath[key] = stat;
  store.api.total += 1;
  if (durationMs >= 500) {
    store.api.slow.push({ key, durationMs, responseBytes, at: new Date().toISOString() });
    if (store.api.slow.length > 30) store.api.slow.shift();
  }
}

export function traceQueryInvalidation(key) {
  if (!isAdminTraceEnabled()) return;
  const store = ensureStore();
  if (!store) return;
  store.query.invalidations[key] = (store.query.invalidations[key] || 0) + 1;
}

export function traceQueryFetch(key) {
  if (!isAdminTraceEnabled()) return;
  const store = ensureStore();
  if (!store) return;
  store.query.fetches[key] = (store.query.fetches[key] || 0) + 1;
}

export function traceSocketEmit(event) {
  if (!isAdminTraceEnabled()) return;
  const store = ensureStore();
  if (!store) return;
  store.socket.emits[event] = (store.socket.emits[event] || 0) + 1;
}

export function traceSocketListener(event, activeCount) {
  if (!isAdminTraceEnabled()) return;
  const store = ensureStore();
  if (!store) return;
  store.socket.listeners[event] = activeCount;
}

export function useTraceRender(name) {
  traceRender(name);
}
