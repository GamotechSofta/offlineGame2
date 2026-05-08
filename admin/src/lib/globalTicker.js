let listeners = new Set();
let timerId = null;
let isVisible = typeof document === 'undefined' ? true : document.visibilityState === 'visible';

function emitTick(now = Date.now()) {
  listeners.forEach((listener) => {
    try {
      listener({ now, isVisible });
    } catch {
      // Ignore listener failures to keep ticker alive.
    }
  });
}

function ensureTicker() {
  if (timerId || typeof window === 'undefined') return;
  timerId = window.setInterval(() => {
    if (!isVisible) return;
    emitTick(Date.now());
  }, 1000);
}

function stopTicker() {
  if (!timerId || typeof window === 'undefined') return;
  window.clearInterval(timerId);
  timerId = null;
}

function onVisibilityChange() {
  isVisible = document.visibilityState === 'visible';
  if (isVisible) {
    ensureTicker();
    emitTick(Date.now());
  } else {
    stopTicker();
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onVisibilityChange);
  window.addEventListener('blur', onVisibilityChange);
}

export function subscribeGlobalTicker(listener) {
  listeners.add(listener);
  ensureTicker();
  listener({ now: Date.now(), isVisible });
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopTicker();
  };
}
