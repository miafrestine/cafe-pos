import { useEffect, useId, useMemo, useState } from 'react';
import './ShiftAnalytics.css';
import { HOURLY, SHIFTS, getShiftData } from '../data/shiftData.js';
import { peso } from '../utils/money.js';

/* ------------------------------------------------------------------ */
/* Icons (inline SVG, Lucide-style strokes)                            */
/* ------------------------------------------------------------------ */

const ICONS = {
  trendUp: (
    <>
      <path d="M22 7l-8.5 8.5-5-5L2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  trendDown: (
    <>
      <path d="M22 17l-8.5-8.5-5 5L2 7" />
      <path d="M16 17h6v-6" />
    </>
  ),
  receipt: (
    <>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  tag: (
    <>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 002.5 2.5z" />
  ),
  printer: (
    <>
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
  close: <path d="M18 6L6 18M6 6l12 12" />,
};

function Icon({ name, className = 'w-4 h-4' }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const percent = (share) => `${(share * 100).toFixed(1)}%`;

function Panel({ title, subtitle, action, className = '', children }) {
  return (
    <section className={`bg-white rounded-3xl border border-[#EAE3D9] p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-[#1C1917]">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Hourly sales velocity (area + line)                                 */
/* ------------------------------------------------------------------ */

const VB_W = 640;
const VB_H = 240;
const M = { l: 54, r: 16, t: 24, b: 30 };
const INNER_W = VB_W - M.l - M.r;
const INNER_H = VB_H - M.t - M.b;
const Y_STEP = 100;
const Y_MAX = Math.ceil((Math.max(...HOURLY.map((h) => h.revenue)) * 1.1) / Y_STEP) * Y_STEP;
const Y_TICKS = Array.from({ length: Y_MAX / Y_STEP + 1 }, (_, i) => i * Y_STEP);

function SalesVelocityChart({ slots, peakHours }) {
  const gradientId = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);

  const n = slots.length;
  const colW = INNER_W / (n - 1);
  const baseY = M.t + INNER_H;
  const xAt = (i) => M.l + (i / (n - 1)) * INNER_W;
  const yAt = (v) => baseY - (v / Y_MAX) * INNER_H;

  const points = slots
    .map((slot, i) => ({ slot, i, x: xAt(i), y: slot.revenue == null ? null : yAt(slot.revenue) }))
    .filter((p) => p.y !== null);

  const linePath = points
    .map((p, k) => {
      if (k === 0) return `M ${p.x} ${p.y}`;
      const prev = points[k - 1];
      const mid = (prev.x + p.x) / 2;
      return `C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z`;
  const hovered = hover === null ? null : points.find((p) => p.i === hover) ?? null;

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-auto" role="img" aria-label="Hourly sales velocity chart">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F2A65A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#F2A65A" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {Y_TICKS.map((tick) => (
          <g key={tick}>
            <line
              x1={M.l}
              x2={VB_W - M.r}
              y1={yAt(tick)}
              y2={yAt(tick)}
              stroke={tick === 0 ? '#C9C2B8' : '#EAE3D9'}
              strokeDasharray={tick === 0 ? undefined : '3 4'}
            />
            <text x={M.l - 8} y={yAt(tick) + 3} textAnchor="end" fontSize="10" fill="#9CA3AF">
              {`₱${tick}`}
            </text>
          </g>
        ))}

        {points
          .filter((p) => peakHours.includes(p.slot.hour))
          .map((p) => {
            const x0 = Math.max(p.x - colW / 2, M.l);
            const x1 = Math.min(p.x + colW / 2, VB_W - M.r);
            return <rect key={p.slot.hour} x={x0} y={M.t} width={x1 - x0} height={INNER_H} fill="#F2A65A" opacity="0.14" rx="6" />;
          })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke="#1C1917" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hovered && (
          <line x1={hovered.x} x2={hovered.x} y1={M.t} y2={baseY} stroke="#1C1917" strokeOpacity="0.25" strokeDasharray="3 3" />
        )}

        {points.map((p) => {
          const isPeak = peakHours.includes(p.slot.hour);
          const isHover = hovered && hovered.i === p.i;
          return (
            <g key={p.slot.hour}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isHover ? 6.5 : isPeak ? 6 : 4}
                fill={isPeak ? '#F2A65A' : '#1C1917'}
                stroke="#FFFFFF"
                strokeWidth="2"
                style={{ transition: 'r 140ms ease' }}
              />
              {isPeak && (
                <text x={p.x} y={p.y - 13} textAnchor="middle" fontSize="9" fontWeight="700" fill="#8A4B0F">
                  PEAK
                </text>
              )}
            </g>
          );
        })}

        {slots.map((slot, i) => (
          <text
            key={slot.hour}
            x={xAt(i)}
            y={VB_H - 9}
            textAnchor="middle"
            fontSize="10"
            fill={slot.state === 'active' ? '#6B7280' : '#CFC8BD'}
          >
            {slot.label}
          </text>
        ))}

        {points.map((p) => (
          <rect
            key={`hit-${p.slot.hour}`}
            x={Math.max(p.x - colW / 2, M.l - 8)}
            y={M.t}
            width={colW}
            height={INNER_H + 6}
            fill="transparent"
            tabIndex={0}
            aria-label={`${p.slot.label}: ${peso(p.slot.revenue)} from ${p.slot.orders} orders`}
            onMouseEnter={() => setHover(p.i)}
            onFocus={() => setHover(p.i)}
            onBlur={() => setHover(null)}
            style={{ outline: 'none' }}
          />
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${Math.min(Math.max((hovered.x / VB_W) * 100, 14), 86)}%`,
            top: `${(hovered.y / VB_H) * 100}%`,
            transform: 'translate(-50%, -125%)',
          }}
        >
          <div className="sa-tooltip sa-tooltip-pop">
            <strong>
              {hovered.slot.label}
              {peakHours.includes(hovered.slot.hour) ? ' · Peak rush' : ''}
            </strong>
            <span>Sales {peso(hovered.slot.revenue)}</span>
            <span>{hovered.slot.orders} orders</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top 5 items (horizontal bars)                                       */
/* ------------------------------------------------------------------ */

function TopItemsChart({ items }) {
  const maxQty = Math.max(...items.map((item) => item.qty), 1);

  return (
    <ol className="space-y-4">
      {items.map((item, idx) => {
        const width = (item.qty / maxQty) * 100;
        return (
          <li key={item.name} className="group relative outline-none" tabIndex={0}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-5 h-5 shrink-0 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    idx === 0 ? 'bg-[#F2A65A] text-[#1C1917]' : 'bg-[#FAF7F2] text-gray-500 border border-[#EAE3D9]'
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="font-semibold text-[#1C1917] truncate">{item.name}</span>
              </div>
              <div className="flex items-baseline gap-3 shrink-0">
                <span className="text-gray-500">{item.qty} sold</span>
                <span className="font-bold text-[#1C1917] w-20 text-right">{peso(item.revenue)}</span>
              </div>
            </div>
            <div className="mt-1.5 h-2.5 rounded-full bg-[#F3ECE3] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out group-hover:brightness-125"
                style={{ width: `${width}%`, background: idx === 0 ? '#F2A65A' : '#1C1917' }}
              />
            </div>
            <div
              className="absolute -top-11 pointer-events-none z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
              style={{ left: `min(${width}%, 70%)` }}
            >
              <div className="sa-tooltip">
                <strong>{item.name}</strong>
                <span>
                  {item.qty} sold · {peso(item.revenue)}
                </span>
                <span>{percent(item.share)} of shift sales</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Category revenue share (donut)                                      */
/* ------------------------------------------------------------------ */

function CategoryDonut({ categories, total }) {
  const [active, setActive] = useState(null);
  const R = 68;
  const STROKE = 26;
  const GAP = 3;
  const C = 2 * Math.PI * R;

  const segments = categories.reduce((acc, category) => {
    const prev = acc[acc.length - 1];
    const len = category.share * C;
    acc.push({ ...category, len, offset: prev ? prev.offset + prev.len : 0 });
    return acc;
  }, []);
  const current = segments.find((s) => s.id === active) ?? null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6" onMouseLeave={() => setActive(null)}>
      <div className="relative w-44 h-44 shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90" role="img" aria-label="Category revenue share donut chart">
          {segments.map((seg) => {
            const dash = Math.max(seg.len - GAP, 0.01);
            return (
              <circle
                key={seg.id}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={active === seg.id ? STROKE + 6 : STROKE}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-seg.offset}
                opacity={active && active !== seg.id ? 0.4 : 1}
                style={{ transition: 'stroke-width 160ms ease, opacity 160ms ease', cursor: 'pointer' }}
                onMouseEnter={() => setActive(seg.id)}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {current ? (
            <>
              <span className="text-[11px] font-semibold text-gray-500">{current.label}</span>
              <span className="text-xl font-extrabold text-[#1C1917]">{percent(current.share)}</span>
              <span className="text-[11px] font-semibold text-gray-600">{peso(current.amount)}</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold text-gray-500">Total sales</span>
              <span className="text-sm font-extrabold text-[#1C1917]">{peso(total)}</span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full space-y-1">
        {segments.map((seg) => (
          <li key={seg.id}>
            <button
              type="button"
              onMouseEnter={() => setActive(seg.id)}
              onFocus={() => setActive(seg.id)}
              onBlur={() => setActive(null)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs transition ${
                active === seg.id ? 'bg-[#FAF7F2]' : 'hover:bg-[#FAF7F2]'
              }`}
            >
              <span className="flex items-center gap-2 font-semibold text-[#1C1917]">
                <span className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
                {seg.label}
              </span>
              <span className="flex items-baseline gap-3">
                <span className="text-gray-500">{percent(seg.share)}</span>
                <span className="font-bold text-[#1C1917] w-20 text-right">{peso(seg.amount)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payment method split (segmented bar)                                */
/* ------------------------------------------------------------------ */

function PaymentSplit({ payments }) {
  const [active, setActive] = useState(null);

  const segments = payments.reduce((acc, payment) => {
    const prev = acc[acc.length - 1];
    acc.push({ ...payment, start: prev ? prev.start + prev.share : 0 });
    return acc;
  }, []);
  const current = segments.find((s) => s.id === active) ?? null;

  return (
    <div onMouseLeave={() => setActive(null)}>
      <div className="relative pt-12">
        {current && (
          <div
            className="absolute top-0 pointer-events-none z-10"
            style={{
              left: `${Math.min(Math.max((current.start + current.share / 2) * 100, 14), 86)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="sa-tooltip sa-tooltip-pop">
              <strong>{current.label}</strong>
              <span>
                {peso(current.amount)} · {percent(current.share)}
              </span>
            </div>
          </div>
        )}
        <div className="flex h-6 gap-[2px]" role="img" aria-label="Payment method split">
          {segments.map((seg) => (
            <div
              key={seg.id}
              tabIndex={0}
              onMouseEnter={() => setActive(seg.id)}
              onFocus={() => setActive(seg.id)}
              onBlur={() => setActive(null)}
              className="first:rounded-l-full last:rounded-r-full cursor-pointer outline-none transition-opacity duration-150"
              style={{
                width: `${seg.share * 100}%`,
                background: seg.color,
                opacity: active && active !== seg.id ? 0.4 : 1,
              }}
            />
          ))}
        </div>
      </div>

      <ul className="mt-4 space-y-1">
        {segments.map((seg) => (
          <li
            key={seg.id}
            onMouseEnter={() => setActive(seg.id)}
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs transition ${
              active === seg.id ? 'bg-[#FAF7F2]' : ''
            }`}
          >
            <span className="flex items-center gap-2 font-semibold text-[#1C1917]">
              <span className="w-3 h-3 rounded-full" style={{ background: seg.color }} />
              {seg.label}
            </span>
            <span className="flex items-baseline gap-3">
              <span className="text-gray-500">{percent(seg.share)}</span>
              <span className="font-bold text-[#1C1917] w-20 text-right">{peso(seg.amount)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Z-Report printing                                                   */
/* ------------------------------------------------------------------ */

const signedPeso = (n) => `${n > 0 ? '+' : ''}${peso(n)}`;

function printZReport(data, { zNumber, counted, variance, closedAt } = {}) {
  const win = window.open('', '_blank', 'width=420,height=720');
  if (!win) return false;

  const row = (label, value, strong = false) =>
    `<div class="row${strong ? ' strong' : ''}"><span>${label}</span><span>${value}</span></div>`;
  const dateText = new Date().toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Z-Report</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; width: 300px; margin: 16px auto; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 4px; letter-spacing: 1px; }
  .c { text-align: center; margin: 2px 0; }
  .row { display: flex; justify-content: space-between; margin: 3px 0; }
  .strong { font-weight: bold; }
  hr { border: 0; border-top: 1px dashed #000; margin: 10px 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>CAFE POS</h1>
  <div class="c strong">Z-REPORT${zNumber ? ` · ${zNumber}` : ''}</div>
  <div class="c">${data.shift.label} (${data.shift.window})</div>
  <div class="c">${dateText}${closedAt ? ` · closed ${closedAt}` : ''}</div>
  <hr />
  ${row('Total sales', peso(data.revenue), true)}
  ${row('Orders', String(data.orders))}
  ${row('Average order', peso(data.average))}
  <hr />
  ${row('Cash sales', peso(data.cashSales))}
  ${row('Card / NFC batch', peso(data.cardTotal))}
  ${row('Gift card redemptions', peso(data.giftTotal))}
  <hr />
  ${row('Opening float', peso(data.floatCash))}
  ${row('Expected ending cash', peso(data.expectedCash), true)}
  ${counted != null ? row('Counted cash', peso(counted)) : ''}
  ${variance != null ? row('Over / short', signedPeso(variance), true) : ''}
  <hr />
  <div class="c">— End of report —</div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
  return true;
}

function ReconcileRow({ label, value, strong = false }) {
  return (
    <div className={`flex items-center justify-between text-xs ${strong ? 'font-bold text-[#1C1917]' : 'font-medium text-gray-500'}`}>
      <span>{label}</span>
      <span className={strong ? '' : 'font-bold text-[#1C1917]'}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function ShiftAnalytics({ onToast }) {
  const [shiftId, setShiftId] = useState('current');
  const [closedShift, setClosedShift] = useState(null); // { zNumber, closedAt }
  const [zCounter, setZCounter] = useState(1043);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');

  const data = useMemo(() => getShiftData(shiftId), [shiftId]);
  const { shift } = data;
  const isOpenShift = shift.live && !closedShift;
  const delta = shift.vsPrevious;
  const peakSlot = data.slots.find((s) => s.hour === data.peakHours[0]);

  const drawerTotal = data.expectedCash + data.cardTotal;
  const cashShare = drawerTotal > 0 ? (data.expectedCash / drawerTotal) * 100 : 0;

  const parsedCounted = countedCash === '' ? null : parseFloat(countedCash);
  const counted = parsedCounted === null || Number.isNaN(parsedCounted) ? null : parsedCounted;
  const variance = counted === null ? null : Math.round((counted - data.expectedCash) * 100) / 100;

  const notify = (message) => onToast?.(message);

  useEffect(() => {
    if (!confirmOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setConfirmOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen]);

  const handlePrint = () => {
    const ok = printZReport(data, shift.live ? closedShift ?? {} : {});
    notify(ok ? 'Z-Report sent to printer' : 'Allow pop-ups to print the Z-Report');
  };

  const handleCloseShift = () => {
    const zNumber = `Z-${zCounter}`;
    const closedAt = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const ok = printZReport(data, { zNumber, counted, variance, closedAt });
    setClosedShift({ zNumber, closedAt });
    setZCounter((n) => n + 1);
    setConfirmOpen(false);
    setCountedCash('');
    notify(ok ? `Shift closed · ${zNumber} sent to printer` : `Shift closed · ${zNumber} (allow pop-ups to print)`);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-4 mt-3 space-y-4">
      {/* Shift selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Select shift">
          {SHIFTS.map((item) => {
            const isActive = item.id === shiftId;
            const liveOpen = item.live && !closedShift;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setShiftId(item.id)}
                aria-pressed={isActive}
                className={`px-4 py-2 rounded-2xl text-left border transition ${
                  isActive
                    ? 'bg-[#1C1917] text-white border-[#1C1917] shadow-md'
                    : 'bg-white text-gray-600 border-[#EAE3D9] hover:border-[#1C1917]/40 hover:text-[#1C1917]'
                }`}
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  {item.live && (
                    <span className={`w-2 h-2 rounded-full ${liveOpen ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                  )}
                  {item.label}
                </span>
                <span className="block text-[10px] opacity-70 mt-0.5">{item.window}</span>
              </button>
            );
          })}
        </div>
        <span className="px-3 py-1 rounded-full bg-white border border-[#EAE3D9] text-[10px] font-semibold text-gray-500">
          Sample data
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#EAE3D9]">
          <span className="text-xs text-gray-500 font-medium">Total Revenue</span>
          <h3 className="text-2xl font-extrabold text-[#1C1917] mt-1">{peso(data.revenue)}</h3>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                delta >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              <Icon name={delta >= 0 ? 'trendUp' : 'trendDown'} className="w-3 h-3" />
              {delta >= 0 ? '+' : ''}
              {delta.toFixed(1)}%
            </span>
            <span className="text-[11px] text-gray-400">{shift.vsLabel}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EAE3D9]">
          <span className="text-xs text-gray-500 font-medium">Total Orders / Covers</span>
          <h3 className="text-2xl font-extrabold text-[#1C1917] mt-1">{data.orders}</h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-400">
            <Icon name="receipt" className="w-3.5 h-3.5" />
            {(data.orders / data.activeHours).toFixed(1)} orders per hour
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EAE3D9]">
          <span className="text-xs text-gray-500 font-medium">Average Order Value</span>
          <h3 className="text-2xl font-extrabold text-[#1C1917] mt-1">{peso(data.average)}</h3>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-400">
            <Icon name="tag" className="w-3.5 h-3.5" />
            Revenue per order
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EAE3D9]">
          <span className="text-xs text-gray-500 font-medium">Cash in Drawer vs Card</span>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Icon name="banknote" className="w-3.5 h-3.5" />
                Cash
              </span>
              <span className="font-bold text-[#1C1917]">{peso(data.expectedCash)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Icon name="card" className="w-3.5 h-3.5" />
                Card
              </span>
              <span className="font-bold text-[#1C1917]">{peso(data.cardTotal)}</span>
            </div>
          </div>
          <div className="flex h-2 gap-[2px] mt-3" role="img" aria-label="Cash in drawer versus card processing split">
            <div className="rounded-l-full" style={{ width: `${cashShare}%`, background: '#1baf7a' }} />
            <div className="rounded-r-full" style={{ width: `${100 - cashShare}%`, background: '#2a78d6' }} />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel
          title="Hourly Sales Velocity"
          subtitle="Sales per hour (₱) · peak rush hours highlighted"
          className="xl:col-span-2"
          action={
            peakSlot && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F2A65A]/15 text-[11px] font-semibold text-[#8A4B0F]">
                <Icon name="flame" className="w-3.5 h-3.5" />
                Peak {peakSlot.label} · {peso(peakSlot.revenue)}
              </span>
            )
          }
        >
          <SalesVelocityChart slots={data.slots} peakHours={data.peakHours} />
          <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F2A65A]" />
              Peak rush hour
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1C1917]" />
              Regular hour
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#CFC8BD]" />
              {shift.live ? 'Upcoming / outside shift' : 'Outside this shift'}
            </span>
          </div>
        </Panel>

        <Panel title="Top 5 Selling Items" subtitle="Ranked by quantity sold">
          <TopItemsChart items={data.topItems} />
        </Panel>

        <Panel title="Category Revenue Share" subtitle="Share of shift sales by category">
          <CategoryDonut categories={data.categories} total={data.revenue} />
        </Panel>

        <Panel title="Payment Method Split" subtitle="Cash vs card / NFC vs gift cards">
          <PaymentSplit payments={data.payments} />
        </Panel>

        <Panel
          title="Shift Reconcile & Drawer Close"
          subtitle={`${shift.label} · ${shift.window}`}
          action={
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                isOpenShift ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {isOpenShift ? 'Open' : 'Closed'}
            </span>
          }
        >
          <div className="space-y-2.5">
            <ReconcileRow label="Initial float cash" value={peso(data.floatCash)} />
            <ReconcileRow label="+ Cash sales" value={peso(data.cashSales)} />
            <ReconcileRow label="Expected ending cash" value={peso(data.expectedCash)} strong />
            <div className="border-b border-dashed border-gray-300 my-1" />
            <ReconcileRow label="Card / NFC batch total" value={peso(data.cardTotal)} />
            <ReconcileRow label="Gift card redemptions" value={peso(data.giftTotal)} />
            <ReconcileRow label="Total sales" value={peso(data.revenue)} strong />
          </div>

          {shift.live && closedShift && (
            <p className="mt-3 text-[11px] text-gray-500">
              Closed at {closedShift.closedAt} · {closedShift.zNumber}
            </p>
          )}

          <button
            type="button"
            onClick={isOpenShift ? () => setConfirmOpen(true) : handlePrint}
            className="w-full mt-4 py-3.5 rounded-2xl bg-[#1C1917] hover:bg-black text-white font-semibold text-xs transition shadow-md flex items-center justify-center gap-2"
          >
            <Icon name="printer" className="w-4 h-4" />
            {isOpenShift ? 'End Shift & Print Z-Report' : shift.live ? 'Reprint Z-Report' : 'Print Z-Report'}
          </button>
        </Panel>
      </div>

      {/* End-shift confirmation */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#FAF7F2] rounded-3xl border border-[#EBE3D8] shadow-2xl p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-shift-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="end-shift-title" className="text-base font-bold text-[#1C1917]">
                  End shift & print Z-Report?
                </h2>
                <p className="text-xs text-gray-500 mt-1">This closes the current shift on this terminal.</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="w-8 h-8 shrink-0 rounded-full bg-white border border-[#EBE3D9] flex items-center justify-center text-gray-500 hover:text-[#1C1917] transition"
                aria-label="Cancel"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 bg-white rounded-2xl border border-[#EBE3D9] p-4 space-y-2">
              <ReconcileRow label="Expected ending cash" value={peso(data.expectedCash)} strong />
              <ReconcileRow label="Card / NFC batch" value={peso(data.cardTotal)} />
            </div>

            <label className="block mt-4">
              <span className="text-xs font-semibold text-[#1C1917]">Counted cash in drawer (optional)</span>
              <div className="mt-1.5 flex items-center bg-white border border-[#EBE3D9] rounded-xl px-3 focus-within:border-[#F2A65A]">
                <span className="text-sm font-bold text-gray-400">₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder={data.expectedCash.toFixed(2)}
                  className="w-full bg-transparent py-2.5 pl-2 text-sm font-bold text-[#1C1917] focus:outline-none"
                  autoFocus
                />
              </div>
            </label>

            {variance !== null && (
              <p
                className={`mt-2 text-xs font-semibold ${
                  variance === 0 ? 'text-emerald-700' : variance > 0 ? 'text-blue-700' : 'text-red-700'
                }`}
              >
                {variance === 0
                  ? 'Drawer balances'
                  : variance > 0
                    ? `Over by ${peso(variance)}`
                    : `Short by ${peso(Math.abs(variance))}`}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="py-3 rounded-2xl bg-white border border-[#EBE3D9] text-xs font-semibold text-[#1C1917] hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseShift}
                className="py-3 rounded-2xl bg-[#1C1917] hover:bg-black text-white text-xs font-semibold transition shadow-md"
              >
                Close Shift & Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
