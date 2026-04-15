import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from '../config/api';

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
        window.location.href = launchUrl;
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
    <div className="min-h-screen bg-gray-200 px-3 sm:px-4 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="w-full">
        {loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                className="animate-pulse rounded-2xl border-2 border-gray-300 bg-white p-3"
              >
                <div className="h-36 rounded-xl bg-gray-200" />
                <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
                <div className="mt-3 h-7 w-full rounded-lg bg-gray-200" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-6 text-center text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="rounded-2xl border-2 border-gray-300 bg-white px-4 py-6 text-center text-sm font-medium text-gray-600">
            No games found. Add games from Postman and refresh.
          </div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game, index) => {
              const theme = CARD_THEMES[index % CARD_THEMES.length];
              const title = game?.name || 'Unnamed Game';
              return (
                <div
                  key={game?._id || game?.gameCode || `game-${index}`}
                  className="group overflow-hidden rounded-2xl  transition hover:-translate-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => launchGame(game)}
                    disabled={launchingCode === String(game?.gameCode || '').trim().toUpperCase()}
                    className={`relative block w-full overflow-hidden rounded-xl bg-gradient-to-r ${theme.accent} text-left ${
                      launchingCode === String(game?.gameCode || '').trim().toUpperCase()
                        ? 'cursor-not-allowed opacity-70'
                        : 'cursor-pointer'
                    }`}
                  >
                    {game?.image ? (
                      <img
                        src={game.image}
                        alt={title}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-44 items-center justify-center text-3xl font-bold text-white/95">
                        {getInitials(title)}
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 py-3">
                      <div className="text-base font-semibold leading-tight text-white">
                        {launchingCode === String(game?.gameCode || '').trim().toUpperCase()
                          ? 'Launching...'
                          : title}
                      </div>
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
