import React, { useEffect, useMemo, useState } from 'react';
import { getRatesCurrent } from '../api/bets';

const DEFAULT_RATES = {
  single: 10,
  oddEven: 10,
  jodi: 100,
  singlePatti: 150,
  doublePatti: 300,
  triplePatti: 1000,
  halfSangam: 5000,
  fullSangam: 10000,
};

const toRate = (val, fallback) => {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? String(n) : String(fallback);
};

const GameRate = () => {
  const [ratesMap, setRatesMap] = useState(DEFAULT_RATES);

  useEffect(() => {
    let active = true;
    const loadRates = async () => {
      try {
        const res = await getRatesCurrent();
        if (!active) return;
        const data = res?.data && typeof res.data === 'object' ? res.data : null;
        if (res?.success && data) {
          setRatesMap({
            single: Number(data.single ?? DEFAULT_RATES.single),
            oddEven: Number(data.oddEven ?? data.odd_even ?? data.oddEvenRate ?? data.odd_even_rate ?? DEFAULT_RATES.oddEven),
            jodi: Number(data.jodi ?? DEFAULT_RATES.jodi),
            singlePatti: Number(data.singlePatti ?? DEFAULT_RATES.singlePatti),
            doublePatti: Number(data.doublePatti ?? DEFAULT_RATES.doublePatti),
            triplePatti: Number(data.triplePatti ?? DEFAULT_RATES.triplePatti),
            halfSangam: Number(data.halfSangam ?? DEFAULT_RATES.halfSangam),
            fullSangam: Number(data.fullSangam ?? DEFAULT_RATES.fullSangam),
          });
        }
      } catch (_) {
        // keep defaults silently
      }
    };
    loadRates();
    return () => {
      active = false;
    };
  }, []);

  const GAME_RATE_ROWS = useMemo(
    () => [
      { game: 'Single Digit', rate: toRate(ratesMap.single, DEFAULT_RATES.single) },
      { game: 'Odd Even', rate: toRate(ratesMap.oddEven, DEFAULT_RATES.oddEven) },
      { game: 'Jodi', rate: toRate(ratesMap.jodi, DEFAULT_RATES.jodi) },
      { game: 'Single Patti', rate: toRate(ratesMap.singlePatti, DEFAULT_RATES.singlePatti) },
      { game: 'Double Patti', rate: toRate(ratesMap.doublePatti, DEFAULT_RATES.doublePatti) },
      { game: 'Triple Patti', rate: toRate(ratesMap.triplePatti, DEFAULT_RATES.triplePatti) },
      { game: 'Half Sangam', rate: toRate(ratesMap.halfSangam, DEFAULT_RATES.halfSangam) },
      { game: 'Full Sangam', rate: toRate(ratesMap.fullSangam, DEFAULT_RATES.fullSangam) },
    ],
    [ratesMap]
  );

  return (
    <div className="min-h-screen bg-[#E8ECEF] px-3 sm:px-4 md:px-6 py-4 sm:py-6">
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white border-2 border-gray-300 rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_120px] sm:grid-cols-[110px_1fr_140px] border-b border-gray-300 bg-gray-100">
            <div className="px-4 py-3 text-[12px] sm:text-sm font-bold text-[#1B3150]">SR NO</div>
            <div className="px-4 py-3 text-[12px] sm:text-sm font-bold text-[#1B3150]">GAME</div>
            <div className="px-4 py-3 text-[12px] sm:text-sm font-bold text-[#1B3150] text-right">RATE (1 =)</div>
          </div>

          {GAME_RATE_ROWS.map((row, idx) => (
            <div
              key={row.game}
              className="grid grid-cols-[80px_1fr_120px] sm:grid-cols-[110px_1fr_140px] border-b border-gray-200 last:border-b-0"
            >
              <div className="px-4 py-3 text-base sm:text-xl leading-none font-medium text-gray-700">{idx + 1}</div>
              <div className="px-4 py-3 text-lg sm:text-2xl leading-none font-semibold text-gray-900">{row.game}</div>
              <div className="px-4 py-3 text-lg sm:text-2xl leading-none font-bold text-[#1B3150] text-right">{row.rate}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameRate;
