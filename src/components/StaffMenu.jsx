import { useEffect, useRef, useState } from 'react';
import { formatDuration, formatTime } from '../utils/slips.js';

const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// Header pill for the signed-in employee, with lock / end-shift / close-store actions.
export default function StaffMenu({ session, onLock, onEndShift, onClockOut, onCloseStore }) {
  const { currentStaff, currentCard, registerShift } = session;
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      clearInterval(tick);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  if (!currentStaff) return null;

  const holdsDrawer = registerShift && registerShift.cashierId === currentStaff.id;
  const run = (action) => {
    setOpen(false);
    action();
  };

  const itemClass =
    'w-full text-left px-4 py-2.5 text-xs font-semibold text-[#1C1917] hover:bg-[#FAF7F2] transition flex flex-col';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => {
          setNow(Date.now());
          setOpen((o) => !o);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white border border-[#EAE3D9] rounded-full shadow-sm hover:border-[#F2A65A] transition"
      >
        <span className="w-7 h-7 rounded-full bg-[#F2A65A] text-[#1C1917] text-[10px] font-extrabold flex items-center justify-center">
          {initials(currentStaff.name)}
        </span>
        <span className="text-xs font-semibold text-[#1C1917]">{currentStaff.name}</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 z-40 bg-white rounded-2xl border border-[#EAE3D9] shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-[#1C1917]">{currentStaff.name}</p>
            <p className="text-[11px] text-gray-500">{currentCard?.role ?? currentStaff.defaultRole}</p>
            {currentCard && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                Clocked in {formatTime(currentCard.clockIn)} · {formatDuration(now - new Date(currentCard.clockIn).getTime())}
              </p>
            )}
          </div>

          <button type="button" role="menuitem" onClick={() => run(onLock)} className={itemClass}>
            Lock screen
            <span className="text-[10px] font-medium text-gray-400">Shift and drawer stay open</span>
          </button>

          {holdsDrawer ? (
            <button type="button" role="menuitem" onClick={() => run(onEndShift)} className={itemClass}>
              End my shift / switch cashier
              <span className="text-[10px] font-medium text-gray-400">Count the drawer, print the X-Report, clock out</span>
            </button>
          ) : (
            <button type="button" role="menuitem" onClick={() => run(onClockOut)} className={itemClass}>
              Clock out
              <span className="text-[10px] font-medium text-gray-400">Stops your time card</span>
            </button>
          )}

          {currentStaff.isManager && registerShift && (
            <button type="button" role="menuitem" onClick={() => run(onCloseStore)} className={`${itemClass} border-t border-gray-100 text-red-700`}>
              Close store (Z-Report)
              <span className="text-[10px] font-medium text-gray-400">Final count, clock out everyone, night mode</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
