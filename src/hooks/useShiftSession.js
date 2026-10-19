import { useCallback, useMemo, useRef, useState } from 'react';
import { STAFF, VARIANCE_THRESHOLD } from '../data/staff.js';

const round2 = (n) => Math.round(n * 100) / 100;
const nowIso = () => new Date().toISOString();

// Employee sign-in, time cards and register (drawer) shifts, following the
// "Employee Shift Transition Specification". State is held in memory for now;
// the matching database tables are in supabase/migrations.
//
// `ordersHistory` is the POS ledger. Orders tagged with the open shift's id are
// totalled into cash / card sales for the X- and Z-reports.
export function useShiftSession(ordersHistory) {
  const staff = STAFF;
  const idRef = useRef(0);
  const zRef = useRef(1);
  const nextId = (prefix) => {
    idRef.current += 1;
    return `${prefix}-${idRef.current}`;
  };

  const [currentStaffId, setCurrentStaffId] = useState(null); // null = terminal locked
  const [timeCards, setTimeCards] = useState([]);
  const [registerShift, setRegisterShift] = useState(null);
  const [handoffFloat, setHandoffFloat] = useState(null); // cash counted by the previous cashier
  const [reports, setReports] = useState([]);
  const [isNight, setIsNight] = useState(false);

  const getStaff = (id) => staff.find((s) => s.id === id) ?? null;
  const getOpenCard = (id) => timeCards.find((c) => c.staffId === id && !c.clockOut) ?? null;
  const currentStaff = getStaff(currentStaffId);
  const currentCard = currentStaffId ? getOpenCard(currentStaffId) : null;
  const activeCards = timeCards.filter((c) => !c.clockOut);

  const sales = useMemo(() => {
    const mine = registerShift ? ordersHistory.filter((o) => o.shiftId === registerShift.id) : [];
    const sum = (payment) => round2(mine.filter((o) => o.payment === payment).reduce((acc, o) => acc + o.total, 0));
    return { orderCount: mine.length, cashSales: sum('Cash'), cardTotal: sum('Card'), giftTotal: 0, refunds: 0, discounts: 0 };
  }, [ordersHistory, registerShift]);

  // Expected = Starting Float + Cash Sales - Cash Refunds
  const expectedCash = registerShift ? round2(registerShift.openingFloat + sales.cashSales - sales.refunds) : 0;
  const varianceFor = (counted) => round2(counted - expectedCash);
  const needsApproval = (variance) => Math.abs(variance) > VARIANCE_THRESHOLD;

  const verifyPin = (staffId, pin) => getStaff(staffId)?.pin === pin;
  const verifyManagerPin = (pin) => staff.find((s) => s.isManager && s.pin === pin) ?? null;
  const findByBadge = (code) => staff.find((s) => s.badge === code.trim()) ?? null;
  const findByNfc = (code) => staff.find((s) => s.nfc === code.trim()) ?? null;

  // Whoever is at the terminal is responsible for the drawer: when a different
  // employee unlocks it (spec section 3), the open shift moves to them.
  const takeDrawer = (staffId) => {
    setCurrentStaffId(staffId);
    setRegisterShift((shift) => (shift && shift.cashierId !== staffId ? { ...shift, cashierId: staffId } : shift));
  };

  const wakeFromNight = () => setIsNight(false);
  const unlock = (staffId) => takeDrawer(staffId);
  const lock = useCallback(() => setCurrentStaffId(null), []);

  const clockIn = (staffId, role, method = 'pin') => {
    setTimeCards((prev) =>
      prev.some((c) => c.staffId === staffId && !c.clockOut)
        ? prev
        : [...prev, { id: nextId('tc'), staffId, role, method, clockIn: nowIso(), clockOut: null }]
    );
    takeDrawer(staffId);
  };

  const clockOut = (staffId) => {
    const at = nowIso();
    setTimeCards((prev) => prev.map((c) => (c.staffId === staffId && !c.clockOut ? { ...c, clockOut: at } : c)));
    setCurrentStaffId((id) => (id === staffId ? null : id));
  };

  const openRegisterShift = ({ floatCash, denominations }) => {
    const shift = {
      id: nextId('shift'),
      cashierId: currentStaffId,
      openedAt: nowIso(),
      openingFloat: round2(floatCash),
      denominations: denominations ?? {},
      previousFloat: handoffFloat,
    };
    setRegisterShift(shift);
    setHandoffFloat(null);
    return shift;
  };

  const buildReport = (type, { counted, approvedBy, cardBatchReference }) => ({
    id: nextId(type === 'Z' ? 'z' : 'x'),
    type,
    zNumber: type === 'Z' ? zRef.current : null,
    shiftId: registerShift.id,
    cashierName: getStaff(registerShift.cashierId)?.name ?? 'Unknown',
    openedAt: registerShift.openedAt,
    generatedAt: nowIso(),
    ...sales,
    openingFloat: registerShift.openingFloat,
    expectedCash,
    countedCash: round2(counted),
    variance: varianceFor(counted),
    approvedByName: approvedBy?.name ?? null,
    cardBatchReference: cardBatchReference ?? null,
    staffHours: [],
  });

  // Mid-day handoff: X-Report, clock out the cashier, leave the counted cash as
  // the float the next cashier verifies.
  const handoffShift = ({ counted, approvedBy }) => {
    if (!registerShift) return null;
    const report = buildReport('X', { counted, approvedBy });
    const cashierId = registerShift.cashierId;
    setReports((prev) => [...prev, report]);
    setTimeCards((prev) => prev.map((c) => (c.staffId === cashierId && !c.clockOut ? { ...c, clockOut: report.generatedAt } : c)));
    setRegisterShift(null);
    setHandoffFloat(report.countedCash);
    setCurrentStaffId(null);
    return report;
  };

  // End of day: Z-Report, clock out everyone, settle the card batch, reset
  // counters and put the terminal into night mode.
  const closeStore = ({ counted, approvedBy }) => {
    if (!registerShift) return null;
    const batch = `BATCH-${String(zRef.current).padStart(4, '0')}`;
    const report = buildReport('Z', { counted, approvedBy, cardBatchReference: batch });
    report.staffHours = timeCards.map((c) => ({
      name: getStaff(c.staffId)?.name ?? 'Unknown',
      role: c.role,
      clockIn: c.clockIn,
      clockOut: c.clockOut ?? report.generatedAt,
      ms: new Date(c.clockOut ?? report.generatedAt) - new Date(c.clockIn),
    }));
    zRef.current += 1;
    setReports((prev) => [...prev, report]);
    setTimeCards([]);
    setRegisterShift(null);
    setHandoffFloat(null);
    setCurrentStaffId(null);
    setIsNight(true);
    return report;
  };

  return {
    staff,
    currentStaff,
    currentCard,
    activeCards,
    registerShift,
    handoffFloat,
    reports,
    isNight,
    sales,
    expectedCash,
    getStaff,
    getOpenCard,
    varianceFor,
    needsApproval,
    verifyPin,
    verifyManagerPin,
    findByBadge,
    findByNfc,
    wakeFromNight,
    unlock,
    lock,
    clockIn,
    clockOut,
    openRegisterShift,
    handoffShift,
    closeStore,
  };
}
