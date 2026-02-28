import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getItem, setItem, removeItem, setUserCache, getUserCache, subscribeUserChange } from '../config/storage';
import { clearUserSession } from '../config/api';

const AuthContext = createContext({ user: null, balance: null, authReady: false, loadUser: () => {}, setUser: () => {}, logout: () => {} });

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [balance, setBalance] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const raw = await getItem('user');
      const u = raw ? JSON.parse(raw) : null;
      const hasToken = !!(u && u.token);
      setUserState(hasToken ? u : null);
      setUserCache(hasToken ? u : null);
      if (hasToken) {
        const b = u?.balance ?? u?.walletBalance ?? u?.wallet ?? 0;
        setBalance(Number(b));
      } else {
        setBalance(0);
      }
    } catch (e) {
      setUserState(null);
      setUserCache(null);
      setBalance(0);
    } finally {
      setAuthReady(true);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const unsub = subscribeUserChange(() => {
      const u = getUserCache();
      setUserState(u || null);
      if (u) setBalance(Number(u?.balance ?? u?.walletBalance ?? u?.wallet ?? 0));
      else setBalance(0);
    });
    return unsub;
  }, [loadUser]);

  const setUser = useCallback(async (userData) => {
    setUserState(userData);
    setUserCache(userData);
    if (userData) {
      await setItem('user', JSON.stringify(userData));
      setBalance(Number(userData?.balance ?? userData?.walletBalance ?? userData?.wallet ?? 0));
    }
  }, []);

  const logout = useCallback(async () => {
    await removeItem('user');
    setUserState(null);
    setUserCache(null);
    setBalance(0);
    clearUserSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, balance, authReady, setBalance, loadUser, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
