import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, getAuthHeaders } from '../config/api';
import { GAME_EMBED_LAUNCH_STORAGE_KEY } from './GameLaunchEmbed';

const CARD_THEMES = [
  { accent: 'from-sky-600 to-indigo-700' },
  { accent: 'from-violet-600 to-purple-700' },
  { accent: 'from-rose-600 to-red-700' },
  { accent: 'from-emerald-600 to-teal-700' },
  { accent: 'from-amber-500 to-orange-600' },
];

const prettifyText = (value) =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getInitials = (value) => {
  const parts = prettifyText(value).split(' ').filter(Boolean);
  if (parts.length === 0) return 'GM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const GamesHub = () => {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [launchingCode, setLaunchingCode] = useState('');

  const getAllGames = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/games`, { withCredentials: true });
      return Array.isArray(response?.data?.data) ? response.data.data : [];
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load games';
      throw new Error(message);
    }
  };

  const loadGames = async () => {
    try {
      setLoading(true);
      setError('');
      const list = await getAllGames();
      setGames(list);
    } catch (err) {
      setGames([]);
      setError(err?.message || 'Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  const getPlayerId = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return String(user?._id || user?.id || '').trim();
    } catch {
      return '';
    }
  };

  const launchGame = async (game) => {
    const gameCode = String(game?.gameCode || '').trim().toUpperCase();
    const externalPlayerId = getPlayerId();

    if (!gameCode) {
      setError('Missing gameCode');
      return;
    }
    if (!externalPlayerId) {
      setError('Player not found. Please login again.');
      return;
    }

    try {
      setError('');
      setLaunchingCode(gameCode);

      const payload = {
        gameCode,
        externalPlayerId,
        currency: 'INR',
        locale: 'en',
        returnUrl: '',
      };

      const response = await axios.post(
        `${API_BASE_URL}/games/launch/${encodeURIComponent(gameCode)}`,
        payload,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
        }
      );

      const launchUrl =
        response?.data?.launchUrl ||
        response?.data?.data?.launchUrl ||
        response?.data?.data?.data?.launchUrl ||
        response?.data?.data?.url ||
        response?.data?.data?.gameUrl ||
        response?.data?.data?.sessionUrl ||
        response?.data?.data?.redirectUrl ||
        '';

      if (launchUrl) {
        try {
          sessionStorage.setItem(GAME_EMBED_LAUNCH_STORAGE_KEY, launchUrl);
        } catch (_) {}
        navigate('/games/play', { state: { launchUrl } });
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to launch game');
    } finally {
      setLaunchingCode('');
    }
  };

  useEffect(() => {
    loadGames();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-white px-2 sm:px-4 pt-2 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] text-slate-900">
      <div className="w-full">
        <div className="mb-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Games</h1>
          <p className="mt-0.5 text-[11px] text-slate-500">Choose a game and start playing.</p>
        </div>
        {loading && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {[...Array(6)].map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-slate-900"
              >
                <div className="h-24 bg-slate-800" />
                <div className="px-2 py-2">
                  <div className="h-3 w-2/5 rounded bg-slate-700" />
                  <div className="mt-1.5 h-2.5 w-1/4 rounded bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm font-medium text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-6 text-center text-sm font-medium text-slate-300">
            No games found. Add games from Postman and refresh.
          </div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
            {games.map((game, index) => {
              const theme = CARD_THEMES[index % CARD_THEMES.length];
              const title = game?.name || 'Unnamed Game';
              return (
                <div
                  key={game?._id || game?.gameCode || `game-${index}`}
                  className="group w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 transition duration-300 hover:border-white/20"
                >
                  <button
                    type="button"
                    onClick={() => launchGame(game)}
                    disabled={launchingCode === String(game?.gameCode || '').trim().toUpperCase()}
                    className={`relative block w-full overflow-hidden rounded-2xl text-left ${
                      launchingCode === String(game?.gameCode || '').trim().toUpperCase()
                        ? 'cursor-not-allowed opacity-70'
                        : 'cursor-pointer'
                    }`}
                  >
                    {game?.image ? (
                      <img
                        src={game.image}
                        alt={title}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className={`flex h-24 items-center justify-center bg-gradient-to-br ${theme.accent} text-2xl font-bold text-white/95`}>
                        {getInitials(title)}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black to-transparent px-2 py-2">
                      <div className="truncate text-sm font-semibold text-white">
                        {launchingCode === String(game?.gameCode || '').trim().toUpperCase()
                          ? 'Launching...'
                          : title}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-300">Tap to explore</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GamesHub;
