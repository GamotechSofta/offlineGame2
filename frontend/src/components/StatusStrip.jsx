import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3010/api/v1' : 'https://api.singlepana.in/api/v1');

const DEFAULT_NEWS_MESSAGE = 'Welcome Diamond';
const DEFAULT_SPEED_SECONDS = 24;

const StatusStrip = () => {
  const [message, setMessage] = useState(DEFAULT_NEWS_MESSAGE);
  const [speedSec, setSpeedSec] = useState(DEFAULT_SPEED_SECONDS);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/banner-settings/lottery-news`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) return;
        const text = String(json?.data?.message || '').trim();
        const speed = Number(json?.data?.speedSec);
        if (!cancelled && text) setMessage(text);
        if (!cancelled && Number.isFinite(speed) && speed >= 5 && speed <= 120) setSpeedSec(Math.round(speed));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => Array.from({ length: 18 }, () => message || DEFAULT_NEWS_MESSAGE), [message]);

  return (
    <div className="h-7 bg-[#2eb34f] text-black text-[12px] leading-[28px] font-semibold border-y border-[#6f6f6f] overflow-hidden">
      <div className="status-marquee-track whitespace-nowrap" style={{ animationDuration: `${speedSec}s` }}>
        {items.map((text, idx) => (
          <span key={`${text}-${idx}`} className="inline-block pr-10" aria-hidden={idx > 0}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
};

export default StatusStrip;
