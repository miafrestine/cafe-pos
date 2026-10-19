import { useEffect, useState } from 'react';
import CashEntry from './CashEntry.jsx';
import { ROLES, DEFAULT_FLOAT, MAX_PIN_ATTEMPTS, PIN_LOCK_MS } from '../data/staff.js';
import { peso } from '../utils/money.js';
import { formatTime, printOpenSlip } from '../utils/slips.js';

const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
const initials = (name) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function Avatar({ name, className = 'w-12 h-12 text-sm' }) {
  return (
    <span className={`${className} rounded-full bg-[#F2A65A] text-[#1C1917] font-extrabold flex items-center justify-center shrink-0`}>
      {initials(name)}
    </span>
  );
}

// Full-screen gate: shown whenever nobody is signed in or no drawer shift is open.
//   select  -> pick a profile (or scan a badge / tap an NFC card)
//   pin     -> 4-digit PIN
//   role    -> choose the role for this shift (clock-in)
//   float   -> open the register shift and count the starting cash
export default function LockScreen({ session, onToast, onRequestHandoff }) {
  const { staff, currentStaff, currentCard, registerShift, isNight, handoffFloat } = session;

  const [step, setStep] = useState('select');
  const [mode, setMode] = useState('unlock'); // unlock | clock
  const [selectedId, setSelectedId] = useState(null);
  const [clockMethod, setClockMethod] = useState('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [role, setRole] = useState(ROLES[0]);
  const [badgeText, setBadgeText] = useState('');
  const [attempts, setAttempts] = useState({}); // staffId -> { count, lockedUntil }
  const [now, setNow] = useState(() => Date.now());
  const [floatAmount, setFloatAmount] = useState('');
  const [floatTouched, setFloatTouched] = useState(false);
  const [denoms, setDenoms] = useState({});

  const effectiveStep = currentStaff && !registerShift ? 'float' : step;
  const selected = staff.find((s) => s.id === selectedId) ?? null;

  const lockedUntil = selected ? attempts[selected.id]?.lockedUntil ?? 0 : 0;
  const lockedFor = lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;
  const isPinLocked = lockedFor > 0;

  useEffect(() => {
    if (!isPinLocked) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isPinLocked]);

  const reset = () => {
    setStep('select');
    setMode('unlock');
    setSelectedId(null);
    setPin('');
    setError('');
    setBadgeText('');
  };

  const handleClockOut = (member) => {
    if (registerShift && registerShift.cashierId === member.id) {
      // The person holding the drawer has to count it before they can clock out.
      session.unlock(member.id);
      onToast?.('Count the drawer to end your shift');
      onRequestHandoff?.();
    } else {
      session.clockOut(member.id);
      onToast?.(`${member.name} clocked out`);
    }
    reset();
  };

  const authenticated = (id, method) => {
    const member = staff.find((s) => s.id === id);
    if (!member) return;
    if (isNight && !member.isManager) {
      setError('The store is closed. A manager has to open it for the day.');
      setStep('select');
      return;
    }
    if (isNight) session.wakeFromNight();

    const card = session.getOpenCard(id);
    if (mode === 'clock' && card) {
      handleClockOut(member);
      return;
    }
    if (!card) {
      setSelectedId(id);
      setRole(member.defaultRole);
      setClockMethod(method);
      setPin('');
      setError('');
      setStep('role');
      return;
    }
    session.unlock(id);
    reset();
  };

  const submitPin = (value) => {
    if (!selected) return;
    if (session.verifyPin(selected.id, value)) {
      setAttempts((a) => ({ ...a, [selected.id]: { count: 0, lockedUntil: 0 } }));
      setPin('');
      authenticated(selected.id, 'pin');
      return;
    }
    const count = (attempts[selected.id]?.count ?? 0) + 1;
    if (count >= MAX_PIN_ATTEMPTS) {
      setAttempts((a) => ({ ...a, [selected.id]: { count: 0, lockedUntil: Date.now() + PIN_LOCK_MS } }));
      setNow(Date.now());
      setError('Too many wrong PINs. Try again in 5 minutes.');
    } else {
      setAttempts((a) => ({ ...a, [selected.id]: { count, lockedUntil: 0 } }));
      setError(`Wrong PIN · ${MAX_PIN_ATTEMPTS - count} ${MAX_PIN_ATTEMPTS - count === 1 ? 'attempt' : 'attempts'} left`);
    }
    setPin('');
  };

  const pressKey = (key) => {
    if (isPinLocked) return;
    setError('');
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === 'clear') {
      setPin('');
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) submitPin(next);
  };

  // Physical keyboard support on the PIN screen.
  useEffect(() => {
    if (effectiveStep !== 'pin') return undefined;
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) pressKey(e.key);
      else if (e.key === 'Backspace') pressKey('back');
      else if (e.key === 'Escape') {
        setStep('select');
        setPin('');
        setError('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const chooseProfile = (member) => {
    if (isNight && !member.isManager) {
      setError('The store is closed. A manager has to open it for the day.');
      return;
    }
    setSelectedId(member.id);
    setPin('');
    setError('');
    setStep('pin');
  };

  const handleBadgeKey = (e) => {
    if (e.key !== 'Enter') return;
    const code = badgeText.trim();
    setBadgeText('');
    if (!code) return;
    const byNfc = session.findByNfc(code);
    if (byNfc) {
      // An NFC / RFID tap is a single-step sign-in.
      setSelectedId(byNfc.id);
      authenticated(byNfc.id, 'nfc');
      return;
    }
    const byBadge = session.findByBadge(code);
    if (byBadge) {
      chooseProfile(byBadge);
      setClockMethod('badge_qr');
      return;
    }
    setError('Badge not recognised');
  };

  const confirmRole = () => {
    session.clockIn(selected.id, role, clockMethod);
    onToast?.(`${selected.name} clocked in as ${role}`);
    reset();
  };

  const floatText = floatTouched ? floatAmount : String(handoffFloat ?? DEFAULT_FLOAT);
  const floatValue = parseFloat(floatText);
  const floatValid = !Number.isNaN(floatValue) && floatValue >= 0;
  const handoffGap = handoffFloat != null && floatValid ? Math.round((floatValue - handoffFloat) * 100) / 100 : 0;

  const openShift = () => {
    if (!floatValid) {
      setError('Enter the starting cash float');
      return;
    }
    const shift = session.openRegisterShift({ floatCash: floatValue, denominations: denoms });
    const printed = printOpenSlip({ shift, cashierName: currentStaff.name, role: currentCard?.role });
    onToast?.(printed ? 'Register shift opened · slip sent to printer' : 'Register shift opened · allow pop-ups to print the slip');
    setFloatAmount('');
    setFloatTouched(false);
    setDenoms({});
    setError('');
  };

  const headline = isNight
    ? 'Closed for the night'
    : registerShift
      ? `Terminal locked · shift open since ${formatTime(registerShift.openedAt)}`
      : 'No register shift open';

  return (
    <div className="fixed inset-0 z-[60] bg-[#1C1917] flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-3xl max-h-full overflow-y-auto bg-[#FAF7F2] rounded-[32px] border border-[#EBE3D8] shadow-2xl p-8 text-[#1C1917]">
        {/* ---------- 1. Choose a profile ---------- */}
        {effectiveStep === 'select' && (
          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-[#1C1917] text-[#F2A65A] flex items-center justify-center text-lg">☕</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight">{mode === 'clock' ? 'Clock In / Out' : 'Unlock register'}</h1>
                <p className="text-xs text-gray-500">{headline}</p>
              </div>
            </div>

            {error && <p className="mt-4 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

            <p className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {mode === 'clock' ? 'Who is clocking in or out?' : 'Choose your profile'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {staff.map((member) => {
                const card = session.getOpenCard(member.id);
                const blocked = isNight && !member.isManager;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => chooseProfile(member)}
                    className={`text-left p-4 bg-white rounded-2xl border border-[#EBE3D9] shadow-sm transition ${
                      blocked ? 'opacity-40' : 'hover:border-[#F2A65A] hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    <Avatar name={member.name} />
                    <h2 className="mt-3 text-sm font-bold">{member.name}</h2>
                    <p className="text-[11px] text-gray-500">{member.defaultRole}</p>
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        card ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {card ? `Clocked in · ${formatTime(card.clockIn)}` : 'Clocked out'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                onKeyDown={handleBadgeKey}
                placeholder="Scan staff badge or tap NFC card…"
                aria-label="Scan staff badge or tap NFC card"
                className="flex-1 bg-white border border-[#EBE3D9] rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#F2A65A]"
              />
              <button
                type="button"
                onClick={() => {
                  setMode((m) => (m === 'clock' ? 'unlock' : 'clock'));
                  setError('');
                }}
                className={`px-5 py-3 rounded-xl text-xs font-bold border transition ${
                  mode === 'clock' ? 'bg-[#1C1917] text-white border-[#1C1917]' : 'bg-white text-[#1C1917] border-[#EBE3D9] hover:border-[#1C1917]/40'
                }`}
                aria-pressed={mode === 'clock'}
              >
                {mode === 'clock' ? '← Back to unlock' : 'Clock In / Out'}
              </button>
            </div>
          </div>
        )}

        {/* ---------- 2. PIN ---------- */}
        {effectiveStep === 'pin' && selected && (
          <div className="max-w-xs mx-auto text-center">
            <div className="flex flex-col items-center">
              <Avatar name={selected.name} className="w-16 h-16 text-lg" />
              <h1 className="mt-3 text-lg font-bold">{selected.name}</h1>
              <p className="text-xs text-gray-500">{mode === 'clock' ? 'Enter your PIN to clock in or out' : 'Enter your 4-digit PIN'}</p>
            </div>

            <div className="flex justify-center gap-3 mt-5" aria-label={`${pin.length} of 4 digits entered`}>
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`w-3.5 h-3.5 rounded-full border-2 transition ${i < pin.length ? 'bg-[#1C1917] border-[#1C1917]' : 'border-[#C9C2B8]'}`}
                />
              ))}
            </div>

            <p className="h-5 mt-3 text-xs font-semibold text-red-700" role="alert">
              {isPinLocked ? `PIN locked · try again in ${Math.floor(lockedFor / 60)}:${String(lockedFor % 60).padStart(2, '0')}` : error}
            </p>

            <div className="grid grid-cols-3 gap-2 mt-2">
              {PAD.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={isPinLocked}
                  onClick={() => pressKey(key)}
                  aria-label={key === 'back' ? 'Backspace' : key === 'clear' ? 'Clear' : key}
                  className="py-4 bg-white hover:bg-[#F2A65A]/20 active:scale-95 rounded-2xl border border-[#EBE3D9] text-lg font-bold transition shadow-sm disabled:opacity-40"
                >
                  {key === 'back' ? '⌫' : key === 'clear' ? 'C' : key}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep('select');
                setPin('');
                setError('');
              }}
              className="mt-4 text-xs font-semibold text-gray-500 hover:text-[#1C1917] transition"
            >
              ← Choose a different profile
            </button>
          </div>
        )}

        {/* ---------- 3. Role for this shift (clock-in) ---------- */}
        {effectiveStep === 'role' && selected && (
          <div className="max-w-sm mx-auto">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} />
              <div>
                <h1 className="text-lg font-bold">Clock in, {selected.name.split(' ')[0]}</h1>
                <p className="text-xs text-gray-500">Select your role for this shift</p>
              </div>
            </div>
            <div className="mt-5 space-y-2" role="radiogroup" aria-label="Role for shift">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  onClick={() => setRole(r)}
                  className={`w-full text-left px-4 py-3 rounded-2xl border text-sm font-semibold transition ${
                    role === r ? 'bg-[#1C1917] text-white border-[#1C1917] shadow-md' : 'bg-white border-[#EBE3D9] hover:border-[#1C1917]/40'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-6">
              <button type="button" onClick={reset} className="py-3 rounded-2xl bg-white border border-[#EBE3D9] text-xs font-semibold hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="button" onClick={confirmRole} className="py-3 rounded-2xl bg-[#1C1917] hover:bg-black text-white text-xs font-semibold transition shadow-md">
                Clock In
              </button>
            </div>
          </div>
        )}

        {/* ---------- 4. Open register shift & count the float ---------- */}
        {effectiveStep === 'float' && currentStaff && (
          <div className="max-w-sm mx-auto">
            <div className="flex items-center gap-3">
              <Avatar name={currentStaff.name} />
              <div>
                <h1 className="text-lg font-bold">Open Register Shift</h1>
                <p className="text-xs text-gray-500">
                  {currentStaff.name} · {currentCard?.role ?? currentStaff.defaultRole}
                </p>
              </div>
            </div>

            {handoffFloat != null && (
              <p className="mt-4 text-xs text-[#8A4B0F] bg-[#F2A65A]/15 border border-[#F2A65A]/40 rounded-xl px-3 py-2">
                Cashier handoff: the previous drawer count was <strong>{peso(handoffFloat)}</strong>. Count the drawer and confirm the float below.
              </p>
            )}

            <p className="mt-5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Starting cash float</p>
            <CashEntry
              amount={floatText}
              onAmountChange={(value) => {
                setFloatTouched(true);
                setFloatAmount(value);
                setError('');
              }}
              denoms={denoms}
              onDenomsChange={setDenoms}
              autoFocus
            />

            {handoffGap !== 0 && (
              <p className="mt-2 text-xs font-semibold text-red-700">
                {peso(Math.abs(handoffGap))} {handoffGap > 0 ? 'more' : 'less'} than the previous cashier counted.
              </p>
            )}
            {error && <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>}

            <button
              type="button"
              onClick={openShift}
              disabled={!floatValid}
              className="w-full mt-5 py-3.5 rounded-2xl bg-[#1C1917] hover:bg-black text-white text-xs font-semibold transition shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Open Register &amp; Print Slip
            </button>
            <button
              type="button"
              onClick={() => session.lock()}
              className="w-full mt-2 py-2.5 text-xs font-semibold text-gray-500 hover:text-[#1C1917] transition"
            >
              Lock screen (stay clocked in)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
