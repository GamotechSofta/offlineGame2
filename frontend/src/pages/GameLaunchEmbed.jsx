import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

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

/** Partner sites that send X-Frame-Options: DENY — load via backend proxy instead. */
const EMBED_PROXY_HOSTS = new Set(['roulettegame.craftdigital.in']);

const resolveIframeSrc = (launchUrl) => {
  try {
    const host = new URL(launchUrl).hostname;
    if (EMBED_PROXY_HOSTS.has(host)) {
      return `${API_BASE_URL}/games/embed/frame?url=${encodeURIComponent(launchUrl)}`;
    }
  } catch (_) {}
  return launchUrl;
};

const GameLaunchEmbed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameCode: rawGameCode } = useParams();
  const gameCode = String(rawGameCode || '').trim().toUpperCase();

  const [launchUrl, setLaunchUrl] = useState('');
  const [gameName, setGameName] = useState('Game');

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

    // Make sure router state never leaks into a shareable URL (replace history entry with a clean one).
    if (location.state) {
      try {
        window.history.replaceState({}, '', `/games/play/${encodeURIComponent(gameCode)}`);
      } catch (_) {}
    }
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

  const iframeSrc = useMemo(() => (launchUrl ? resolveIframeSrc(launchUrl) : ''), [launchUrl]);

  const iframeProps = useMemo(
    () => ({
      title: gameName || 'Game',
      src: iframeSrc,
      className: 'min-h-0 w-full flex-1 border-0 bg-black',
      // Keep this minimal so partner login + payment flows still work.
      allow: 'fullscreen; autoplay; camera; microphone; payment; clipboard-write',
      // Avoid leaking the in-app route to the partner via Referer.
      referrerPolicy: 'no-referrer',
    }),
    [iframeSrc, gameName],
  );

  if (!launchUrl || !iframeSrc) {
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
      </div>
      <iframe {...iframeProps} />
    </div>
  );
};

export default GameLaunchEmbed;
