const inflight = new Map();

/**
 * Deduplicate concurrent requests for the same key.
 * Useful when multiple components invalidate/refetch together.
 */
export function dedupeRequest(key, factory) {
  if (!key || typeof factory !== 'function') {
    return Promise.reject(new Error('Invalid dedupe request arguments'));
  }
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve()
    .then(factory)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}
