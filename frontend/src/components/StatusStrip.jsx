import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3010/api/v1' : 'https://api.singlepana.in/api/v1');

const DEFAULT_NEWS_MESSAGE = 'Welcome Diamond';

const StatusStrip = () => {
  const [message, setMessage] = useState(DEFAULT_NEWS_MESSAGE);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/banner-settings/lottery-news`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) return;
        const text = String(json?.data?.message || '').trim();
        if (!cancelled && text) setMessage(text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => Array.from({ length: 18 }, () => message || DEFAULT_NEWS_MESSAGE), [message]);

  return (
    <div className="h-7 bg-[#2eb34f] text-black text-[12px] leading-[28px] font-semibold border-y border-[#6f6f6f] overflow-hidden">
      <div className="status-marquee-track whitespace-nowrap">
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
