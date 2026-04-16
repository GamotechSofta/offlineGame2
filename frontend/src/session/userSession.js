let currentUser = null;
const listeners = new Set();

function canUseWindow() {
  return typeof window !== 'undefined';
}

function parseUser(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function notify() {
  for (const listener of listeners) {
    try {
      listener(currentUser);
    } catch (_) {}
  }
}

function emitSessionEvent(type) {
  if (!canUseWindow()) return;
  window.dispatchEvent(new Event(type));
}

function hasIdentity(user) {
  return Boolean(user && (user.id || user._id));
}

export function bootstrapUserSession() {
  if (!canUseWindow()) return null;
  if (currentUser) return currentUser;
  const parsed = parseUser(window.localStorage.getItem('user'));
  if (parsed) {
    currentUser = parsed;
  }
  return currentUser;
}

export function getCurrentUser() {
  return currentUser || bootstrapUserSession();
}

export function isUserLoggedIn() {
  return hasIdentity(getCurrentUser());
}

export function setCurrentUser(user, options = {}) {
  const { emitEvent = true } = options;
  currentUser = parseUser(user);
  if (canUseWindow()) {
    if (currentUser) {
      window.localStorage.setItem('user', JSON.stringify(currentUser));
    } else {
      window.localStorage.removeItem('user');
    }
  }
  notify();
  if (emitEvent) emitSessionEvent('userLogin');
  return currentUser;
}

export function patchCurrentUser(patch = {}, options = {}) {
  const prev = getCurrentUser() || {};
  return setCurrentUser({ ...prev, ...patch }, options);
}

export function clearCurrentUser(options = {}) {
  const { emitEvent = true } = options;
  currentUser = null;
  if (canUseWindow()) {
    window.localStorage.removeItem('user');
  }
  notify();
  if (emitEvent) emitSessionEvent('userLogout');
}

export function subscribeUserSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

