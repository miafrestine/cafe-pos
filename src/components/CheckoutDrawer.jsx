import './CheckoutDrawer.css';
import { peso, PESO } from '../utils/money.js';

export default function CheckoutDrawer({
  isOpen,
  orderNumber,
  onClose,
  paymentMode,
  setPaymentMode,
  total,
  changeDue,
  cashAmount,
  smartCashShortcuts,
  onShortcutClick,
  onNumpadPress,
  onBackspace,
  onClear,
  isCashValid,
  parsedCashReceived,
  onComplete,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end checkout-overlay">
      <div className="w-full max-w-md h-full bg-[#FAF7F2] shadow-2xl border-l border-[#EBE3D8] flex flex-col justify-between p-6 overflow-y-auto checkout-panel">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-[#EBE3D9] mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1C1917]">Express Checkout</h2>
              <p className="text-xs text-gray-500">Order #{orderNumber} • Over-the-Counter Terminal</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white border border-[#EBE3D9] flex items-center justify-center text-gray-500 hover:text-[#1C1917] hover:bg-gray-50 transition"
              aria-label="Close checkout"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-[#EBE3D9]/50 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setPaymentMode('cash')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${paymentMode === 'cash' ? 'bg-[#1C1917] text-white shadow-md' : 'bg-transparent text-gray-600 hover:text-[#1C1917]'}`}
            >
              💵 Cash Payment
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('card')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all ${paymentMode === 'card' ? 'bg-[#1C1917] text-white shadow-md' : 'bg-transparent text-gray-600 hover:text-[#1C1917]'}`}
            >
              💳 Card / NFC
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white p-3.5 rounded-2xl border border-[#EBE3D9] shadow-sm">
              <span className="text-[11px] text-gray-400 font-medium">Total Bill</span>
              <div className="text-lg font-extrabold text-[#1C1917] mt-0.5">{peso(total)}</div>
            </div>
            <div className={`p-3.5 rounded-2xl border shadow-sm transition-colors ${changeDue > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-[#EBE3D9]'}`}>
              <span className={`text-[11px] font-medium ${changeDue > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                Change Due
              </span>
              <div className={`text-lg font-extrabold mt-0.5 ${changeDue > 0 ? 'text-emerald-700' : 'text-[#1C1917]'}`}>
                {peso(changeDue)}
              </div>
            </div>
          </div>

          {paymentMode === 'cash' ? (
            <div className="space-y-4">
              <div className="bg-white px-4 py-3 rounded-2xl border border-[#EBE3D9] flex items-center justify-between shadow-sm">
                <span className="text-xs text-gray-500 font-medium">Cash Tendered</span>
                <span className="text-xl font-black text-[#1C1917]">
                  {PESO}{cashAmount === '' ? '0.00' : cashAmount}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Quick Cash Shortcuts</span>
                <div className="grid grid-cols-4 gap-2">
                  {smartCashShortcuts.map((shortcut) => (
                    <button
                      type="button"
                      key={shortcut}
                      onClick={() => onShortcutClick(shortcut)}
                      className="py-2 bg-white border border-[#EBE3D9] rounded-xl text-xs font-bold text-[#1C1917] hover:bg-[#F2A65A]/10 hover:border-[#F2A65A] active:scale-95 transition shadow-sm"
                    >
                      {PESO}{Number.isInteger(shortcut) ? shortcut : shortcut.toFixed(2)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-3 rounded-2xl border border-[#EBE3D9] shadow-sm">
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'].map((key) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => onNumpadPress(key)}
                      className="py-3 bg-[#FAF7F2] hover:bg-[#F2A65A]/20 active:scale-95 rounded-xl border border-[#EBE3D9] text-sm font-bold text-[#1C1917] transition shadow-sm"
                    >
                      {key}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button type="button" onClick={onBackspace} className="py-2.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 rounded-xl text-xs font-bold transition active:scale-95">
                    ⌫ Backspace
                  </button>
                  <button type="button" onClick={onClear} className="py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition active:scale-95">
                    C Clear
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-[#EBE3D9] p-8 flex flex-col items-center justify-center text-center space-y-4 my-6 shadow-sm">
              <div className="w-16 h-16 rounded-full bg-[#F2A65A]/20 text-[#F2A65A] flex items-center justify-center text-2xl animate-pulse">
                💳
              </div>
              <div>
                <h3 className="font-bold text-base text-[#1C1917]">Ready for Terminal Reader</h3>
                <p className="text-xs text-gray-500 max-w-xs mt-1">
                  Please tap, insert, or swipe card on the connected POS card reader. Awaiting authorization...
                </p>
              </div>
              <div className="w-full bg-[#FAF7F2] py-2.5 px-4 rounded-xl border border-[#EBE3D9] text-xs font-semibold text-gray-600 animate-pulse">
                Waiting for customer response...
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#EBE3D9] mt-4">
          <button
            type="button"
            onClick={onComplete}
            disabled={!isCashValid}
            className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md ${isCashValid ? 'bg-[#1C1917] hover:bg-black text-white cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            {paymentMode === 'cash' && !isCashValid
              ? `Insufficient Cash (${peso(total - parsedCashReceived)} remaining)`
              : `Complete Payment (${peso(total)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
