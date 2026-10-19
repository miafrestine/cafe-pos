import { useState } from 'react';
import CashEntry from './CashEntry.jsx';
import { VARIANCE_THRESHOLD } from '../data/staff.js';
import { peso } from '../utils/money.js';
import { formatTime, printReportSlip, signedPeso } from '../utils/slips.js';

function Row({ label, value, strong = false }) {
  return (
    <div className={`flex items-center justify-between text-xs ${strong ? 'font-bold text-[#1C1917]' : 'font-medium text-gray-500'}`}>
      <span>{label}</span>
      <span className={strong ? '' : 'font-bold text-[#1C1917]'}>{value}</span>
    </div>
  );
}

// mode "handoff": Cashier A ends their shift (blind count, X-Report, clock-out).
// mode "close":   a manager closes the store (final count, Z-Report, everyone clocked out).
export default function ShiftHandoffModal({ session, mode, onClose, onToast }) {
  const isClose = mode === 'close';
  const [step, setStep] = useState('count'); // count -> review -> done
  const [amount, setAmount] = useState('');
  const [denoms, setDenoms] = useState({});
  const [approver, setApprover] = useState(null);
  const [approvalPin, setApprovalPin] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [report, setReport] = useState(null);
  const [printed, setPrinted] = useState(true);

  const counted = amount === '' ? null : parseFloat(amount);
  const validCount = counted !== null && !Number.isNaN(counted) && counted >= 0;
  const variance = validCount ? session.varianceFor(counted) : 0;
  const approvalRequired = validCount && session.needsApproval(variance);
  const canConfirm = validCount && (!approvalRequired || approver !== null);

  const recount = () => {
    setApprover(null);
    setApprovalPin('');
    setApprovalError('');
    setStep('count');
  };

  const approve = () => {
    const manager = session.verifyManagerPin(approvalPin);
    if (!manager) {
      setApprovalError('Manager PIN not recognised');
      setApprovalPin('');
      return;
    }
    setApprover(manager);
    setApprovalError('');
  };

  const confirm = () => {
    if (!canConfirm) return;
    const payload = { counted, denominations: denoms, approvedBy: approver };
    const result = isClose ? session.closeStore(payload) : session.handoffShift(payload);
    if (!result) return;
    const ok = printReportSlip(result);
    setReport(result);
    setPrinted(ok);
    setStep('done');
    onToast?.(
      isClose
        ? ok ? `Z-Report #${result.zNumber} sent to printer` : `Z-Report #${result.zNumber} created · allow pop-ups to print`
        : ok ? 'X-Report sent to printer' : 'X-Report created · allow pop-ups to print'
    );
  };

  const title = isClose ? 'Close Store · Z-Report' : 'End My Shift · Handoff';

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-md max-h-full overflow-y-auto bg-[#FAF7F2] rounded-3xl border border-[#EBE3D8] shadow-2xl p-6 text-[#1C1917]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="handoff-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="handoff-title" className="text-base font-bold">
              {title}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {step === 'count' && (isClose ? 'Enter the final cash count for the day.' : 'Blind count: count the drawer before the system shows the expected total.')}
              {step === 'review' && 'Check the count against the system.'}
              {step === 'done' && (isClose ? 'The day is closed.' : 'Handoff complete.')}
            </p>
          </div>
          {step !== 'done' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel"
              className="w-8 h-8 shrink-0 rounded-full bg-white border border-[#EBE3D9] flex items-center justify-center text-gray-500 hover:text-[#1C1917] transition"
            >
              ✕
            </button>
          )}
        </div>

        {/* ---------- count (expected total stays hidden) ---------- */}
        {step === 'count' && (
          <div className="mt-5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Cash in drawer</p>
            <CashEntry amount={amount} onAmountChange={setAmount} denoms={denoms} onDenomsChange={setDenoms} autoFocus />

            {isClose && (
              <div className="mt-4 bg-white rounded-2xl border border-[#EBE3D9] p-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Closing the store will</p>
                <p className="text-xs text-gray-600">
                  Clock out {session.activeCards.length} {session.activeCards.length === 1 ? 'employee' : 'employees'}
                  {session.activeCards.length > 0 && `: ${session.activeCards.map((c) => session.getStaff(c.staffId)?.name).join(', ')}`}.
                </p>
                <p className="text-xs text-gray-600">Settle the card batch, print the Z-Report and lock the terminal for the night.</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('review')}
              disabled={!validCount}
              className="w-full mt-5 py-3.5 rounded-2xl bg-[#1C1917] hover:bg-black text-white text-xs font-semibold transition shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Submit count
            </button>
          </div>
        )}

        {/* ---------- review ---------- */}
        {step === 'review' && validCount && (
          <div className="mt-5">
            <div className="bg-white rounded-2xl border border-[#EBE3D9] p-4 space-y-2">
              <Row label="Opening float" value={peso(session.registerShift.openingFloat)} />
              <Row label="+ Cash sales" value={peso(session.sales.cashSales)} />
              <Row label="− Cash refunds" value={peso(session.sales.refunds)} />
              <Row label="Expected cash" value={peso(session.expectedCash)} strong />
              <Row label="Counted cash" value={peso(counted)} strong />
              <div className="border-b border-dashed border-gray-300" />
              <div
                className={`flex items-center justify-between text-sm font-extrabold ${
                  variance === 0 ? 'text-emerald-700' : approvalRequired ? 'text-red-700' : 'text-amber-700'
                }`}
              >
                <span>{variance === 0 ? 'Drawer balances' : variance > 0 ? 'Over' : 'Short'}</span>
                <span>{signedPeso(variance)}</span>
              </div>
            </div>

            <div className="mt-3 bg-white rounded-2xl border border-[#EBE3D9] p-4 space-y-2">
              <Row label="Orders this shift" value={String(session.sales.orderCount)} />
              <Row label="Card / NFC batch" value={peso(session.sales.cardTotal)} />
            </div>

            {approvalRequired && (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-semibold text-red-700">
                  Over or short by more than {peso(VARIANCE_THRESHOLD)}. A manager PIN is required to continue.
                </p>
                {approver ? (
                  <p className="mt-2 text-xs font-bold text-emerald-700">Approved by {approver.name}</p>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={approvalPin}
                      onChange={(e) => {
                        setApprovalPin(e.target.value.replace(/\D/g, ''));
                        setApprovalError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && approvalPin.length === 4) approve();
                      }}
                      placeholder="Manager PIN"
                      aria-label="Manager PIN"
                      className="w-32 bg-white border border-red-200 rounded-xl px-3 py-2 text-sm font-bold tracking-widest focus:outline-none focus:border-red-400"
                    />
                    <button
                      type="button"
                      onClick={approve}
                      disabled={approvalPin.length !== 4}
                      className="px-4 py-2 rounded-xl bg-[#1C1917] text-white text-xs font-semibold disabled:bg-gray-300"
                    >
                      Approve
                    </button>
                  </div>
                )}
                {approvalError && <p className="mt-2 text-xs font-semibold text-red-700">{approvalError}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-5">
              <button type="button" onClick={recount} className="py-3 rounded-2xl bg-white border border-[#EBE3D9] text-xs font-semibold hover:bg-gray-50 transition">
                Recount
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!canConfirm}
                className="py-3 rounded-2xl bg-[#1C1917] hover:bg-black text-white text-xs font-semibold transition shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isClose ? 'Settle & Print Z-Report' : 'Confirm & Print X-Report'}
              </button>
            </div>
          </div>
        )}

        {/* ---------- done ---------- */}
        {step === 'done' && report && (
          <div className="mt-5">
            <div className="bg-white rounded-2xl border border-[#EBE3D9] p-4 space-y-2">
              <Row label={report.type === 'Z' ? `Z-Report #${report.zNumber}` : 'X-Report'} value={formatTime(report.generatedAt)} strong />
              <Row label="Cashier" value={report.cashierName} />
              <Row label="Expected cash" value={peso(report.expectedCash)} />
              <Row label="Counted cash" value={peso(report.countedCash)} />
              <Row label="Over / short" value={signedPeso(report.variance)} strong />
              {report.approvedByName && <Row label="Approved by" value={report.approvedByName} />}
              {report.type === 'Z' && <Row label="Card batch" value={`${report.cardBatchReference} · settled`} />}
            </div>
            <p className="mt-3 text-xs text-gray-600">
              {isClose
                ? 'Everyone is clocked out and the terminal is in night mode. A manager can open it again from the lock screen.'
                : `${report.cashierName} is clocked out. The next cashier can sign in from the lock screen and verify the float.`}
            </p>
            {!printed && <p className="mt-2 text-xs font-semibold text-red-700">The slip did not print. Allow pop-ups for this site, then press Reprint.</p>}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                onClick={() => setPrinted(printReportSlip(report))}
                className="py-3 rounded-2xl bg-white border border-[#EBE3D9] text-xs font-semibold hover:bg-gray-50 transition"
              >
                Reprint
              </button>
              <button type="button" onClick={onClose} className="py-3 rounded-2xl bg-[#1C1917] hover:bg-black text-white text-xs font-semibold transition shadow-md">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
