import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const safeParse = (raw, fallback) => {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const formatTxnTime = (iso) => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return '-';
  }
};

const renderBetNumber = (val) => {
  const s = (val ?? '').toString().trim();
  if (/^\d{2}$/.test(s)) {
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <span>{s[0]}</span>
        <span>{s[1]}</span>
      </span>
    );
  }
  return s || '-';
};

const Bids = () => {
  const navigate = useNavigate();

  // Remove scrolling on this page only
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const items = useMemo(() => ([
    {
      title: 'Bet History',
      subtitle: 'You can view your market bet history',
      color: '#f3b61b'
    },
    {
      title: 'Game Results',
      subtitle: 'You can view your market result history',
      color: '#25d366',
      iconUrl: 'https://res.cloudinary.com/dzd47mpdo/image/upload/v1769799295/result_ekwn16.png'
    },
    {
      title: 'Sara Starline Bet History',
      subtitle: 'You can view starline history',
      color: '#ef4444'
    },
    {
      title: 'Sara Starline Result History',
      subtitle: 'You can view starline result',
      color: '#3b82f6'
    },
    
  ]), []);

  const [activeTitle, setActiveTitle] = useState(items[0]?.title || '');
  const activeItem = items.find((i) => i.title === activeTitle) || items[0];

  const handleMobileItemClick = (item) => {
    if (item?.title === 'Bet History') {
      navigate('/bet-history');
      return;
    }
    // keep current behavior for other items
    setActiveTitle(item.title);
  };

  const handleDesktopItemClick = (item) => {
    // Desktop: show content on right panel (no navigation)
    setActiveTitle(item.title);
  };

  const desktopBetHistory = useMemo(() => {
    const u = safeParse(localStorage.getItem('user') || 'null', null);
    const uid = u?._id || u?.id || u?.userId || u?.userid || u?.user_id || u?.uid || null;
    const all = safeParse(localStorage.getItem('betHistory') || '[]', []);
    const list = Array.isArray(all) ? all : [];
    const onlyMine = uid ? list.filter((x) => x?.userId === uid) : [];
    return { uid, items: onlyMine };
  }, []);

  const desktopBetHistoryFlat = useMemo(() => {
    const out = [];
    for (const x of desktopBetHistory.items || []) {
      const rows = Array.isArray(x?.rows) ? x.rows : [];
      if (!rows.length) {
        out.push({ x, r: null, idx: 0 });
        continue;
      }
      rows.forEach((r, idx) => out.push({ x, r, idx }));
    }
    return out;
  }, [desktopBetHistory.items]);

  return (
    <div className="min-h-screen bg-black text-white px-3 sm:px-4 pt-0 pb-24">
      <div className="w-full max-w-lg md:max-w-6xl mx-auto md:mx-0">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold">My Bets</h1>
        </div>

        {/* Mobile: same list layout */}
        <div className="space-y-4 md:hidden">
          {items.map((item) => (
            <div
              key={item.title}
              onClick={() => handleMobileItemClick(item)}
              className="bg-[#202124] border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_12px_24px_rgba(0,0,0,0.35)]"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                  style={{ backgroundColor: item.color }}
                >
                  {item.iconUrl ? (
                    <img src={item.iconUrl} alt={item.title} className="w-7 h-7 object-contain" />
                  ) : (
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="8" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-base sm:text-lg font-semibold">{item.title}</p>
                  <p className="text-xs sm:text-sm text-gray-400">{item.subtitle}</p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-white/70">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: sidebar-style list */}
        <div className="hidden md:grid md:grid-cols-[360px_1fr] md:gap-6 md:items-start">
          <aside className="md:sticky md:top-[96px] space-y-3">
            {items.map((item) => {
              const active = item.title === activeTitle;
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => handleDesktopItemClick(item)}
                  className={`w-full text-left bg-[#202124] border rounded-2xl p-4 flex items-center justify-between shadow-[0_12px_24px_rgba(0,0,0,0.35)] transition-colors ${
                    active ? 'border-[#d4af37]/40 bg-[#202124]' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt={item.title} className="w-6 h-6 object-contain" />
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                          <circle cx="12" cy="12" r="8" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-400 truncate">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${
                    active ? 'bg-[#d4af37]/15 border-[#d4af37]/35 text-[#d4af37]' : 'bg-black/30 border-white/10 text-white/70'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </aside>

          <main className="rounded-2xl bg-[#202124] border border-white/10 shadow-[0_12px_24px_rgba(0,0,0,0.35)] p-6">
            <div className="flex items-center justify-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-black shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: activeItem?.color || '#f3b61b' }}
              >
                {activeItem?.iconUrl ? (
                  <img src={activeItem.iconUrl} alt={activeItem.title} className="w-7 h-7 object-contain" />
                ) : (
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 text-center">
                <div className="text-xl font-bold text-white truncate">{activeItem?.title}</div>
                <div className="text-sm text-gray-400">{activeItem?.subtitle}</div>
              </div>
            </div>

            {activeTitle === 'Bet History' ? (
              <div className="mt-6">
                <div className="text-sm text-gray-400 mb-3">Your placed bets</div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto pr-2">
                  {desktopBetHistory.uid && desktopBetHistoryFlat.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-300 text-sm">
                      No bets found.
                    </div>
                  ) : !desktopBetHistory.uid ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-gray-300 text-sm">
                      Please login to see your bet history.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {desktopBetHistoryFlat.map(({ x, r, idx }) => {
                        const betValue = r?.number != null ? renderBetNumber(r.number) : '-';
                        const gameType = (x?.labelKey || 'Bet').toString();
                        const points = Number(r?.points || 0) || 0;
                        const session = (r?.type || x?.session || '').toString();
                        const market = (x?.marketTitle || '').toString().trim() || 'MARKET';

                        return (
                          <div
                            key={`${x.id}-${r?.id ?? idx}`}
                            className="rounded-2xl overflow-hidden border border-white/10 bg-black/25"
                          >
                            <div className="bg-[#0b2b55] px-4 py-3 flex items-center justify-between">
                              <div className="text-white font-extrabold tracking-wide truncate">
                                {market.toUpperCase()}
                              </div>
                              {session ? (
                                <div className="text-xs font-bold text-[#d4af37] border border-[#d4af37]/30 rounded-full px-3 py-1">
                                  {session}
                                </div>
                              ) : null}
                            </div>

                            <div className="px-4 py-4">
                              <div className="grid grid-cols-3 text-center text-[#d4af37] font-bold text-sm">
                                <div>Game Type</div>
                                <div>{(x?.labelKey || 'Bet').toString()}</div>
                                <div>Points</div>
                              </div>
                              <div className="mt-3 grid grid-cols-3 text-center text-white/90 text-sm">
                                <div className="font-semibold">{gameType}</div>
                                <div className="font-extrabold">{betValue}</div>
                                <div className="font-extrabold">{points}</div>
                              </div>
                            </div>

                            <div className="h-px bg-white/10" />
                            <div className="px-4 py-3 text-center text-white/70 text-sm">
                              Transaction: <span className="font-semibold">{formatTxnTime(x?.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 text-gray-300 text-sm">
                Select an item from the left menu. We will add the actual pages/content here next.
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Bids;
