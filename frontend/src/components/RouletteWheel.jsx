import React, { useMemo } from 'react';

// European roulette order (0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26)
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const RouletteWheel = ({ winningNumber = null, isSpinning = false, size = 300 }) => {
  const segments = useMemo(() => {
    return WHEEL_ORDER.map((num, index) => {
      const isRed = num > 0 && RED_NUMBERS.includes(num);
      const isGreen = num === 0;
      const angle = (index / WHEEL_ORDER.length) * 360;
      return { num, angle, isRed, isGreen };
    });
  }, []);

  const winningIndex = useMemo(() => {
    if (winningNumber == null) return 0;
    const i = WHEEL_ORDER.indexOf(Number(winningNumber));
    return i >= 0 ? i : 0;
  }, [winningNumber]);

  const rotation = useMemo(() => {
    const baseAngle = 360 / WHEEL_ORDER.length;
    const segmentCenter = winningIndex * baseAngle + baseAngle / 2;
    return 360 - segmentCenter + 90;
  }, [winningIndex]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="rounded-full border-4 border-amber-500/80 shadow-[0_0_20px_rgba(0,0,0,0.6),inset_0_0_15px_rgba(0,0,0,0.4)]"
        style={{
          width: size,
          height: size,
          transform: isSpinning ? `rotate(${rotation + 360 * 5}deg)` : `rotate(${rotation}deg)`,
          transition: isSpinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'transform 0.1s ease-out',
          background: 'radial-gradient(circle at 30% 30%, #2d3748, #1a202c)',
        }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {segments.map((seg, i) => {
            const startAngle = (i / segments.length) * 360 - 90;
            const endAngle = ((i + 1) / segments.length) * 360 - 90;
            const r = size / 2 - 4;
            const cx = size / 2;
            const cy = size / 2;
            const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
            const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
            const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
            const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
            const large = 1;
            const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
            const fill = seg.isGreen ? '#166534' : seg.isRed ? '#b91c1c' : '#111827';
            return (
              <path
                key={i}
                d={path}
                fill={fill}
                stroke="rgba(251,191,36,0.4)"
                strokeWidth="0.5"
              />
            );
          })}
          {segments.map((seg, i) => {
            const midAngle = ((i + 0.5) / segments.length) * 360 - 90;
            const r = size / 2 - 20;
            const cx = size / 2;
            const cy = size / 2;
            const x = cx + r * Math.cos((midAngle * Math.PI) / 180);
            const y = cy + r * Math.sin((midAngle * Math.PI) / 180);
            const isLight = seg.isRed || seg.isGreen;
            return (
              <text
                key={`t-${i}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isLight ? '#fef3c7' : '#e5e7eb'}
                fontSize={size / 24}
                fontWeight="bold"
                className="pointer-events-none select-none"
              >
                {seg.num}
              </text>
            );
          })}
        </svg>
      </div>
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-400 drop-shadow-lg"
        aria-hidden
      />
    </div>
  );
};

export default RouletteWheel;
