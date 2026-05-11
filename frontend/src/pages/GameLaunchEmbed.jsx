import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/** Session backup so refresh on /games/play can still recover the session URL (never put tokens in the path or query). */
export const GAME_EMBED_LAUNCH_STORAGE_KEY = 'og2GameEmbedLaunchUrl';

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const GameLaunchEmbed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [launchUrl, setLaunchUrl] = useState('');
  const [showFallback, setShowFallback] = useState(false);
  const fallbackTimerRef = useRef(null);

  useEffect(() => {
    let resolved = '';
    const fromState = location.state?.launchUrl;
    if (isHttpUrl(fromState)) {
      resolved = fromState.trim();
    } else {
      try {
        const stored = sessionStorage.getItem(GAME_EMBED_LAUNCH_STORAGE_KEY);
        if (isHttpUrl(stored)) resolved = stored.trim();
      } catch (_) {}
    }

    if (!resolved) {
      navigate('/games', { replace: true });
      return;
    }

    setLaunchUrl(resolved);
    try {
      sessionStorage.setItem(GAME_EMBED_LAUNCH_STORAGE_KEY, resolved);
    } catch (_) {}

    fallbackTimerRef.current = window.setTimeout(() => setShowFallback(true), 12000);
    return () => {
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [location.state, navigate]);

  const clearStoredLaunch = () => {
    try {
      sessionStorage.removeItem(GAME_EMBED_LAUNCH_STORAGE_KEY);
    } catch (_) {}
  };

  const handleBack = () => {
    clearStoredLaunch();
    navigate('/games', { replace: true });
  };

  /** Partner may block framing (X-Frame-Options / CSP); full navigation is the only option then. */
  const handleOpenFullWindow = () => {
    if (!launchUrl) return;
    clearStoredLaunch();
    window.location.assign(launchUrl);
  };

  if (!launchUrl) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-950 text-sm text-white/80">
        Loading…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-slate-900 px-2">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          ← Back
        </button>
        {showFallback ? (
          <button
            type="button"
            onClick={handleOpenFullWindow}
            className="ml-auto rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/25"
          >
            Open in full window
          </button>
        ) : null}
      </div>
      <iframe
        title="Game"
        src={launchUrl}
        className="min-h-0 w-full flex-1 border-0"
        allow="fullscreen; autoplay; camera; microphone; payment; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};

export default GameLaunchEmbed;
