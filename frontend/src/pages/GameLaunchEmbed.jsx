import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';

/**
 * Per-game session backup so refresh of /games/play/:gameCode can recover the partner URL
 * without leaking it back into the address bar. We deliberately key by gameCode and never
 * write the launch URL into the route path, query string, or page DOM (other than the iframe src).
 */
const STORAGE_PREFIX = 'og2GameEmbedLaunchUrl::';
const storageKeyForCode = (code) => `${STORAGE_PREFIX}${String(code || '').trim().toUpperCase()}`;
const NAME_STORAGE_PREFIX = 'og2GameEmbedName::';
const nameKeyForCode = (code) => `${NAME_STORAGE_PREFIX}${String(code || '').trim().toUpperCase()}`;

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const GameLaunchEmbed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameCode: rawGameCode } = useParams();
  const gameCode = String(rawGameCode || '').trim().toUpperCase();

  const [launchUrl, setLaunchUrl] = useState('');
  const [gameName, setGameName] = useState('Game');
  const [showFallback, setShowFallback] = useState(false);
  const fallbackTimerRef = useRef(null);

  // Resolve launch URL once, from router state (preferred) or sessionStorage (refresh-safe).
  useEffect(() => {
    let resolvedUrl = '';
    let resolvedName = '';

    const stateUrl = location.state?.launchUrl;
    const stateName = location.state?.gameName;
    if (isHttpUrl(stateUrl)) resolvedUrl = stateUrl.trim();
    if (typeof stateName === 'string' && stateName.trim()) resolvedName = stateName.trim();

    try {
      if (!resolvedUrl) {
        const stored = sessionStorage.getItem(storageKeyForCode(gameCode));
        if (isHttpUrl(stored)) resolvedUrl = stored.trim();
      }
      if (!resolvedName) {
        const storedName = sessionStorage.getItem(nameKeyForCode(gameCode));
        if (typeof storedName === 'string' && storedName.trim()) resolvedName = storedName.trim();
      }
    } catch (_) {}

    if (!resolvedUrl || !gameCode) {
      navigate('/games', { replace: true });
      return;
    }

    setLaunchUrl(resolvedUrl);
    if (resolvedName) setGameName(resolvedName);

    // Persist (per-game) so a hard refresh on this route resumes the same session.
    try {
      sessionStorage.setItem(storageKeyForCode(gameCode), resolvedUrl);
      if (resolvedName) sessionStorage.setItem(nameKeyForCode(gameCode), resolvedName);
    } catch (_) {}

    // If the iframe is still empty after ~12s, surface a "Open in full window" fallback.
    fallbackTimerRef.current = window.setTimeout(() => setShowFallback(true), 12000);

    // Make sure router state never leaks into a shareable URL (replace history entry with a clean one).
    if (location.state) {
      try {
        window.history.replaceState({}, '', `/games/play/${encodeURIComponent(gameCode)}`);
      } catch (_) {}
    }

    return () => {
      if (fallbackTimerRef.current) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [gameCode, location.state, navigate]);

  const clearStoredLaunch = () => {
    try {
      sessionStorage.removeItem(storageKeyForCode(gameCode));
      sessionStorage.removeItem(nameKeyForCode(gameCode));
    } catch (_) {}
  };

  const handleBack = () => {
    clearStoredLaunch();
    navigate('/games', { replace: true });
  };

  /** Partner may block framing entirely (X-Frame-Options / CSP). Only then offer top-level nav. */
  const handleOpenFullWindow = () => {
    if (!launchUrl) return;
    clearStoredLaunch();
    window.location.assign(launchUrl);
  };

  const iframeProps = useMemo(
    () => ({
      title: gameName || 'Game',
      src: launchUrl,
      className: 'min-h-0 w-full flex-1 border-0 bg-black',
      // Keep this minimal so partner login + payment flows still work.
      allow: 'fullscreen; autoplay; camera; microphone; payment; clipboard-write',
      // Avoid leaking the in-app route to the partner via Referer.
      referrerPolicy: 'no-referrer',
    }),
    [launchUrl, gameName],
  );

  if (!launchUrl) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-950 text-sm text-white/80">
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
        <div className="ml-2 truncate text-sm font-semibold text-white">{gameName}</div>
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
      <iframe {...iframeProps} />
    </div>
  );
};

export default GameLaunchEmbed;
