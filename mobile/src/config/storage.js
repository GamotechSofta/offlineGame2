import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory cache for sync access (e.g. getAuthHeaders) and event-style updates
let _userCache = null;
const _listeners = new Set();

export async function getItem(key) {
  try {
    return await AsyncStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

export async function setItem(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
    if (key === 'user') {
      _userCache = value ? JSON.parse(value) : null;
      _listeners.forEach((fn) => fn());
    }
  } catch (e) {}
}

export async function removeItem(key) {
  try {
    await AsyncStorage.removeItem(key);
    if (key === 'user') {
      _userCache = null;
      _listeners.forEach((fn) => fn());
    }
  } catch (e) {}
}

export function getUserCache() {
  return _userCache;
}

export function setUserCache(user) {
  _userCache = user;
  _listeners.forEach((fn) => fn());
}

export function subscribeUserChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
