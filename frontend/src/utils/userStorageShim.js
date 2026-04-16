let patched = false;
let inMemoryUserJson = null;

export function installUserStorageShim() {
  if (patched || typeof window === 'undefined' || !window.localStorage) return;

  const storage = window.localStorage;
  const nativeGetItem = storage.getItem.bind(storage);
  const nativeSetItem = storage.setItem.bind(storage);
  const nativeRemoveItem = storage.removeItem.bind(storage);

  // Migrate existing persisted user once into memory, then remove from disk.
  try {
    const persisted = nativeGetItem('user');
    if (persisted) inMemoryUserJson = persisted;
    nativeRemoveItem('user');
  } catch (_) {}

  storage.getItem = function patchedGetItem(key) {
    if (key === 'user') return inMemoryUserJson;
    return nativeGetItem(key);
  };

  storage.setItem = function patchedSetItem(key, value) {
    if (key === 'user') {
      inMemoryUserJson = value == null ? null : String(value);
      return;
    }
    nativeSetItem(key, value);
  };

  storage.removeItem = function patchedRemoveItem(key) {
    if (key === 'user') {
      inMemoryUserJson = null;
      return;
    }
    nativeRemoveItem(key);
  };

  patched = true;
}

