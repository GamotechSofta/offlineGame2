import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const GlobalTimerContext = createContext({ now: Date.now(), isVisible: true });

export function GlobalTimerProvider({ children }) {
  const [now, setNow] = useState(Date.now());
  const [isVisible, setIsVisible] = useState(typeof document === 'undefined' ? true : document.visibilityState === 'visible');

  useEffect(() => {
    let timerId = null;

    const tick = () => setNow(Date.now());
    const start = () => {
      if (timerId) return;
      timerId = window.setInterval(tick, 1000);
    };
    const stop = () => {
      if (!timerId) return;
      window.clearInterval(timerId);
      timerId = null;
    };
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible';
      setIsVisible(visible);
      if (visible) {
        tick();
        start();
      } else {
        stop();
      }
    };

    if (isVisible) start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    window.addEventListener('blur', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
      window.removeEventListener('blur', onVisibility);
    };
  }, [isVisible]);

  const value = useMemo(() => ({ now, isVisible }), [now, isVisible]);
  return <GlobalTimerContext.Provider value={value}>{children}</GlobalTimerContext.Provider>;
}

export function useGlobalTimer() {
  return useContext(GlobalTimerContext);
}
