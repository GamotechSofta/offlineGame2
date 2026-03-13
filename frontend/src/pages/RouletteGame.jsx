import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, getAuthHeaders, fetchWithAuth } from '../config/api';
import { getBalance, updateUserBalance } from '../api/bets';
import RouletteWheel from '../components/RouletteWheel';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const BLACK_NUMBERS_SVG_BG = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
const BLACK_SVG_URL = 'https://res.cloudinary.com/dnyp5jknp/image/upload/v1772176968/Untitled_design_5_kjhs74.svg';
const GREEN_SVG_URL = 'https://res.cloudinary.com/dnyp5jknp/image/upload/v1772177726/Untitled_design_6_absjgr.svg';
const RED_SVG_URL = 'https://res.cloudinary.com/dnyp5jknp/image/upload/v1772177812/Untitled_design_7_twzi9m.svg';
const SPIN_BTN_SVG_URL = 'https://res.cloudinary.com/dnyp5jknp/image/upload/v1772178197/Untitled_1080_x_547_px_ihj0pr.svg';

const getUserId = () => {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    return u?.id || u?._id || null;
  } catch {
    return null;
  }
};

const RouletteGame = () => {
  const navigate = useNavigate();
  const userId = getUserId();

  const [balance, setBalance] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [bets, setBets] = useState([]);
  const [amount, setAmount] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const wheelSpinTimeoutRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMobileResult, setShowMobileResult] = useState(false);
  const [lastBets, setLastBets] = useState([]);
  const [targetWinRatePercent, setTargetWinRatePercent] = useState(40);

  useEffect(() => {
    if (!userId) {
      navigate('/login', { replace: true });
      return;
    }

    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const [balRes, statsRes, histRes, configRes] = await Promise.all([
          getBalance(),
          fetchWithAuth(`${API_BASE_URL}/roulette/stats?userId=${encodeURIComponent(userId)}`).then((r) => r.json()),
          fetchWithAuth(`${API_BASE_URL}/roulette/history?userId=${encodeURIComponent(userId)}&limit=10`).then((r) => r.json()),
          fetch(`${API_BASE_URL}/roulette/config`).then((r) => r.json()),
        ]);

        if (balRes.success && balRes.data?.balance != null) {
          setBalance(Number(balRes.data.balance));
          updateUserBalance(balRes.data.balance);
        } else {
          setBalance(0);
        }
        if (statsRes.success && statsRes.data) setStats(statsRes.data);
        if (histRes.success && Array.isArray(histRes.data)) setHistory(histRes.data);
        if (configRes.success && configRes.data && typeof configRes.data.targetWinRatePercent === 'number') {
          setTargetWinRatePercent(configRes.data.targetWinRatePercent);
        }
      } catch (err) {
        setError('Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [userId, navigate]);

  useEffect(() => {
    return () => {
      if (wheelSpinTimeoutRef.current) clearTimeout(wheelSpinTimeoutRef.current);
    };
  }, []);

  const addBet = (type, value) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setError('');
    setBets((prev) => [...prev, { type, value, amount: amt }]);
  };

  const removeBet = (index) => {
    setBets((prev) => prev.filter((_, i) => i !== index));
  };

  const totalBet = bets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  const handleSpin = async () => {
    if (!userId) {
      setError('Session expired. Please log in again.');
      return;
    }
    if (bets.length === 0) {
      setError('Place at least one bet');
      return;
    }
    if (totalBet <= 0) {
      setError('Invalid total bet');
      return;
    }
    if (balance !== null && balance < totalBet) {
      setError('Insufficient balance');
      return;
    }

    setLastBets(bets);
    setSpinning(true);
    setShowMobileResult(false);
    setError('');
    setResult(null);

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `spin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Payload: backend expects { type, amount } for even-money; { type, value, amount } for number (0-36)
    const spinPayload = bets.map((b) =>
      b.type === 'number' ? { type: b.type, value: Number(b.value), amount: Number(b.amount) } : { type: b.type, amount: Number(b.amount) }
    );

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/roulette/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userId: userId != null ? String(userId) : undefined, bets: spinPayload, idempotencyKey }),
      });
      const data = await res.json().catch(() => ({ success: false, message: 'Invalid response from server' }));

      if (!data.success) {
        setError(data.message || 'Spin failed');
        if (res.status === 403) setError(data.message || 'Account is blocked');
        if (res.status === 429) setError(data.message || 'Please wait before spinning again');
        return;
      }

      setResult({ ...data.data, idempotent: data.data?.idempotent === true });
      setWheelSpinning(true);
      if (wheelSpinTimeoutRef.current) clearTimeout(wheelSpinTimeoutRef.current);
      wheelSpinTimeoutRef.current = setTimeout(() => setWheelSpinning(false), 5000);
      setBalance(data.data.balance);
      updateUserBalance(data.data.balance);
      setBets([]);

      setHistory((prev) => [
        {
          winningNumber: data.data.winningNumber,
          totalBet: totalBet,
          payout: data.data.payout,
          profit: data.data.profit,
          createdAt: new Date().toISOString(),
        },
        ...prev.slice(0, 9),
      ]);

      if (stats) {
        setStats({
          ...stats,
          gamesPlayed: stats.gamesPlayed + 1,
          gamesWon: stats.gamesWon + (data.data.payout > 0 ? 1 : 0),
          totalWagered: stats.totalWagered + totalBet,
          totalWon: stats.totalWon + data.data.payout,
          biggestWin: Math.max(stats.biggestWin || 0, data.data.payout),
        });
      }
      setShowMobileResult(true);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSpinning(false);
    }
  };

  const isRed = (n) => n >= 1 && n <= 36 && RED_NUMBERS.includes(n);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center bg-[#186213]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  const winRateDisplay = stats
    ? (stats.winRate != null ? Number(stats.winRate) : (stats.gamesPlayed > 0 ? ((stats.gamesWon || 0) / stats.gamesPlayed * 100) : 0))
    : 0;

  return (
    <div className="min-h-screen bg-[#186213] bg-gradient-to-br from-[#0f3d12] via-[#186213] to-[#10410f] text-white p-2 md:p-4 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-gray-200/80 hover:text-white flex items-center gap-1 text-sm shrink-0"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-extrabold tracking-wide drop-shadow-[0_0_12px_rgba(0,0,0,0.7)]">
            Roulette
          </h1>
          <p className="hidden md:block shrink-0 text-right text-emerald-300 font-bold text-lg drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
            ₹{Number(balance ?? 0).toLocaleString('en-IN')}
          </p>
          <div className="w-14 md:hidden" />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/70 border border-red-500/70 text-red-100 text-sm shadow-[0_0_15px_rgba(0,0,0,0.7)]">
            {error}
          </div>
        )}

        <div className="mb-3 md:mb-6 grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-3 md:gap-6">
          <div className="p-2 md:p-4 rounded-2xl bg-transparent md:bg-[#186213]/30 border-0 md:border md:border-yellow-500/60 flex items-center justify-center">
            <div className="w-full flex flex-col items-center">
              <RouletteWheel
                winningNumber={result?.winningNumber ?? null}
                isSpinning={wheelSpinning}
                size={300}
              />
              <button
                type="button"
                onClick={handleSpin}
                disabled={spinning || wheelSpinning || bets.length === 0 || totalBet <= 0 || (balance !== null && balance < totalBet)}
                className="hidden md:block w-full max-w-[340px] mt-5 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg text-white relative overflow-hidden"
                style={{
                  backgroundImage: `url(${SPIN_BTN_SVG_URL})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                <span className="relative z-10">
                  {spinning ? 'Spinning…' : wheelSpinning ? 'Wheel spinning…' : `Spin (₹${totalBet.toLocaleString('en-IN')})`}
                </span>
              </button>
              {result !== null && !wheelSpinning && (
                <div className="hidden md:block text-center mt-4 pt-3 border-t border-[#333D4D] w-full">
                  <p className="text-gray-300 text-sm">
                    Winning number:{' '}
                    <span className={result.winningNumber === 0 ? 'text-green-400 font-semibold' : isRed(result.winningNumber) ? 'text-red-400 font-semibold' : 'text-white font-semibold'}>
                      {result.winningNumber}
                    </span>
                  </p>
                  <p className="text-gray-300 text-sm mt-1">
                    Payout:{' '}
                    <span className="font-semibold">
                      ₹{Number(result.payout).toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>
              )}
              <div className="hidden md:block mt-4 w-full rounded-lg bg-[#186213]/40 border border-yellow-500/60 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Balance</p>
                  <p className="text-xs text-gray-400">Live</p>
                </div>
                <p className="text-2xl font-extrabold text-emerald-300 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                  ₹{Number(balance ?? 0).toLocaleString('en-IN')}
                </p>
                {stats && (
                  <div className="mt-3 pt-2 border-t border-[#333D4D] grid grid-cols-4 gap-2 text-[10px] md:text-xs">
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide">Played</p>
                      <p className="font-medium">{stats.gamesPlayed}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide">Win rate</p>
                      <p className="font-medium">{typeof winRateDisplay === 'number' ? winRateDisplay.toFixed(1) : winRateDisplay}%</p>
                      <p className="text-[9px] text-amber-300/90 mt-0.5">Target: {targetWinRatePercent}%</p>
                    </div>
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide">Wagered</p>
                      <p className="font-medium truncate" title={String(stats.totalWagered ?? 0)}>₹{(stats.totalWagered ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 uppercase tracking-wide">Biggest</p>
                      <p className="font-medium text-green-400 truncate" title={String(stats.biggestWin ?? 0)}>₹{(stats.biggestWin ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[10px] text-gray-400 text-center">
                  Many players see ~{targetWinRatePercent}% win rate with mixed bets (numbers + red/black, etc.).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-transparent md:bg-[#186213]/40 border-0 md:border md:border-yellow-500/60 p-2 md:p-4 flex flex-col max-h-[640px] overflow-y-auto min-w-0">
            <div className="flex-shrink-0">
              <p className="text-gray-300 text-xs mb-2 uppercase tracking-wide">
                Number bets (3 per column, 12 per row)
              </p>
              <div className="mb-1">
                <button
                  type="button"
                  onClick={() => addBet('number', 0)}
                  disabled={spinning}
                  className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg text-green-300 hover:opacity-90 disabled:opacity-50 text-xs md:text-sm font-semibold shadow-[0_0_10px_rgba(0,0,0,0.8)]"
                  style={{
                    backgroundImage: `url(${GREEN_SVG_URL})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  0
                </button>
              </div>
              <div className="grid grid-cols-12 gap-1 w-full max-w-[100%]">
                {Array.from({ length: 3 }, (_, row) =>
                  Array.from({ length: 12 }, (_, col) => row * 12 + col + 1),
                )
                  .flat()
                  .map((n) => {
                    const useRedSvgBg = isRed(n);
                    const useBlackSvgBg = BLACK_NUMBERS_SVG_BG.includes(n);
                    const svgStyle = useRedSvgBg
                      ? {
                          backgroundImage: `url(${RED_SVG_URL})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        }
                      : useBlackSvgBg
                        ? {
                            backgroundImage: `url(${BLACK_SVG_URL})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                          }
                        : undefined;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => addBet('number', n)}
                        disabled={spinning}
                        className={`w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg text-xs md:text-sm font-semibold disabled:opacity-50 shadow-[0_0_8px_rgba(0,0,0,0.8)] ${
                          useRedSvgBg
                            ? 'text-red-50 hover:brightness-110'
                            : useBlackSvgBg
                              ? 'text-gray-50 hover:brightness-110'
                              : 'bg-[#252D3A] text-gray-200 hover:bg-primary-500/30'
                        }`}
                        style={svgStyle}
                      >
                        {n}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-yellow-500/40 flex-shrink-0 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs uppercase tracking-wide text-gray-300">Bet amount (₹)</p>
                <span className="text-[11px] text-gray-400">Enter amount then tap a bet</span>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-32 px-3 py-2 rounded-lg bg-[#186213]/40 border border-yellow-500/60 text-white text-sm placeholder-gray-100/70 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="flex gap-1">
                  {[10, 50, 100].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAmount(String(chip))}
                      className="px-3 py-1.5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black text-xs font-semibold shadow-[0_0_10px_rgba(0,0,0,0.6)] hover:brightness-110"
                    >
                      ₹{chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-gray-300 text-xs mb-2 uppercase tracking-wide">Quick bets</p>
                <div className="flex flex-wrap gap-2">
                  {['red', 'black', 'odd', 'even', 'low', 'high'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addBet(type)}
                      disabled={spinning}
                      className={`min-w-[64px] px-3 py-2 rounded-full text-xs font-semibold capitalize disabled:opacity-50 shadow-[0_0_8px_rgba(0,0,0,0.7)] border border-yellow-500/70 ${
                        type === 'red'
                          ? 'bg-gradient-to-br from-red-500 to-red-700 text-white'
                          : type === 'black'
                            ? 'bg-gradient-to-br from-gray-700 to-black text-white'
                            : 'bg-[#186213]/80 text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-[#186213]/40 border border-yellow-500/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-300 uppercase tracking-wide">Current bets</p>
                  <span className="text-xs text-emerald-300">Total: ₹{totalBet.toLocaleString('en-IN')}</span>
                </div>
                {bets.length === 0 ? (
                  <p className="text-[11px] text-gray-100">Choose a bet type or number to start placing chips.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {bets.map((b, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#186213]/80 text-xs"
                      >
                        {b.type === 'number' ? `#${b.value}` : b.type} ₹{b.amount}
                        <button type="button" onClick={() => removeBet(i)} className="text-red-300 hover:text-red-200 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden px-3 sm:px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || wheelSpinning || bets.length === 0 || totalBet <= 0 || (balance !== null && balance < totalBet)}
            className="flex-1 min-w-0 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg text-white relative overflow-hidden"
            style={{
              backgroundImage: `url(${SPIN_BTN_SVG_URL})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <span className="relative z-10">
              {spinning ? 'Spinning…' : wheelSpinning ? 'Wheel spinning…' : `Spin (₹${totalBet.toLocaleString('en-IN')})`}
            </span>
          </button>
          <div className="shrink-0 text-right py-2 px-3 rounded-lg bg-[#186213]/80 border border-yellow-500/50">
            <p className="text-[10px] uppercase tracking-wide text-gray-300">Balance</p>
            <p className="text-emerald-300 font-bold text-sm whitespace-nowrap">₹{Number(balance ?? 0).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {result !== null && !wheelSpinning && showMobileResult && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="mx-4 sm:mx-6 max-w-sm w-full rounded-xl bg-[#186213] border border-yellow-500/80 px-5 py-4 text-center shadow-2xl">
              <p className="text-xs text-gray-200 uppercase tracking-wide mb-1">Result</p>
              <p className="text-sm text-gray-200">
                Winning number:{' '}
                <span className={result.winningNumber === 0 ? 'text-green-400 font-semibold' : isRed(result.winningNumber) ? 'text-red-400 font-semibold' : 'text-white font-semibold'}>
                  {result.winningNumber}
                </span>
              </p>
              <p className="text-sm text-gray-200 mt-1">
                Payout:{' '}
                <span className="font-semibold">
                  ₹{Number(result.payout).toLocaleString('en-IN')}
                </span>
              </p>
              <p className={result.profit >= 0 ? 'text-green-400 font-semibold mt-1' : 'text-red-400 font-semibold mt-1'}>
                {result.profit >= 0 ? '+' : ''}₹{result.profit.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-gray-400 mt-1.5">Many players see ~{targetWinRatePercent}% win rate with mixed bets.</p>
              {lastBets.length > 0 && (
                <div className="mt-3 text-left text-xs text-gray-100 max-h-32 overflow-y-auto">
                  <p className="font-semibold mb-1 text-gray-200">Bets placed</p>
                  <ul className="space-y-0.5">
                    {lastBets.map((b, idx) => (
                      <li key={idx} className="flex justify-between gap-2">
                        <span className="capitalize truncate">
                          {b.type === 'number' ? `#${b.value}` : b.type}
                        </span>
                        <span className="font-mono">
                          ₹{Number(b.amount || 0).toLocaleString('en-IN')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 flex justify-between text-[11px] text-gray-200">
                    <span>Total bet</span>
                    <span className="font-mono">
                      ₹{lastBets.reduce((s, b) => s + (Number(b.amount) || 0), 0).toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowMobileResult(false)}
                className="mt-3 px-4 py-1.5 rounded-full bg-emerald-600 text-white text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">Recent games</h2>
            <ul className="space-y-2">
              {history.slice(0, 10).map((g, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center py-2 border-b border-[#333D4D] text-sm"
                >
                  <span className={g.winningNumber === 0 ? 'text-green-400' : isRed(g.winningNumber) ? 'text-red-400' : 'text-white'}>
                    #{g.winningNumber}
                  </span>
                  <span className="text-gray-400">Bet ₹{(g.totalBet || 0).toLocaleString('en-IN')}</span>
                  <span className={Number(g.profit) >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {Number(g.profit) >= 0 ? '+' : ''}₹{(g.profit || 0).toLocaleString('en-IN')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default RouletteGame;
