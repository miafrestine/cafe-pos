import { useState } from 'react';
import { DENOMINATIONS } from '../data/staff.js';
import { PESO } from '../utils/money.js';

// Cash amount field with an optional bill-and-coin quick count underneath.
// `amount` is the text in the field; `denoms` maps a denomination to how many were counted.
export default function CashEntry({ amount, onAmountChange, denoms, onDenomsChange, autoFocus = false }) {
  const [counting, setCounting] = useState(Object.keys(denoms).length > 0);

  const setCount = (value, qty) => {
    const next = { ...denoms, [value]: Math.max(0, qty) };
    if (next[value] === 0) delete next[value];
    onDenomsChange(next);
    const total = Object.entries(next).reduce((acc, [k, v]) => acc + Number(k) * v, 0);
    onAmountChange(total === 0 ? '' : String(total));
  };

  const handleTotal = (e) => {
    const raw = e.target.value;
    if (!/^\d{0,9}(\.\d{0,2})?$/.test(raw)) return;
    onAmountChange(raw);
    if (Object.keys(denoms).length > 0) onDenomsChange({});
  };

  return (
    <div>
      <div className="flex items-center bg-white border border-[#EBE3D9] rounded-2xl px-4 focus-within:border-[#F2A65A]">
        <span className="text-lg font-bold text-gray-400">{PESO}</span>
        <input
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={amount}
          onChange={handleTotal}
          placeholder="0.00"
          aria-label="Cash total"
          className="w-full bg-transparent py-3 pl-2 text-xl font-extrabold text-[#1C1917] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => setCounting((c) => !c)}
        className="mt-2 text-[11px] font-semibold text-gray-500 hover:text-[#1C1917] transition"
      >
        {counting ? 'Hide bill & coin count' : 'Count bills & coins (optional)'}
      </button>

      {counting && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {DENOMINATIONS.map((value) => {
            const qty = denoms[value] ?? 0;
            return (
              <div key={value} className="bg-white border border-[#EBE3D9] rounded-xl p-2 flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-bold text-[#1C1917]">
                  {PESO}
                  {value.toLocaleString('en-US')}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCount(value, qty - 1)}
                    aria-label={`Remove one ${value} peso`}
                    className="w-6 h-6 rounded-full border border-[#F2A65A] text-[#F2A65A] text-xs font-bold hover:bg-[#F2A65A] hover:text-white transition"
                  >
                    -
                  </button>
                  <span className="text-xs font-bold text-[#1C1917] w-5 text-center">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setCount(value, qty + 1)}
                    aria-label={`Add one ${value} peso`}
                    className="w-6 h-6 rounded-full border border-[#F2A65A] text-[#F2A65A] text-xs font-bold hover:bg-[#F2A65A] hover:text-white transition"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
