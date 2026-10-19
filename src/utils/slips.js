import { peso } from './money.js';

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export const signedPeso = (n) => `${n > 0 ? '+' : ''}${peso(n)}`;

// Opens a receipt-style window and prints it. Returns false if the browser blocked the pop-up.
function printLines(title, lines) {
  const win = window.open('', '_blank', 'width=420,height=760');
  if (!win) return false;

  const body = lines
    .map((line) => {
      if (line.rule) return '<hr />';
      if (line.center !== undefined) return `<div class="c${line.strong ? ' strong' : ''}">${esc(line.center)}</div>`;
      return `<div class="row${line.strong ? ' strong' : ''}"><span>${esc(line.label)}</span><span>${esc(line.value)}</span></div>`;
    })
    .join('\n');

  win.document.open();
  win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; width: 300px; margin: 16px auto; }
  .c { text-align: center; margin: 2px 0; }
  .row { display: flex; justify-content: space-between; gap: 12px; margin: 3px 0; }
  .strong { font-weight: bold; }
  hr { border: 0; border-top: 1px dashed #000; margin: 10px 0; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
${body}
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
  return true;
}

export function printOpenSlip({ shift, cashierName, role }) {
  const denominationRows = Object.entries(shift.denominations ?? {})
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([value, qty]) => ({ label: `  ${peso(Number(value))} x ${qty}`, value: peso(Number(value) * qty) }));

  return printLines('Shift Open Slip', [
    { center: 'CAFE POS', strong: true },
    { center: 'SHIFT OPEN SLIP', strong: true },
    { center: formatDateTime(shift.openedAt) },
    { rule: true },
    { label: 'Cashier', value: cashierName },
    { label: 'Role', value: role ?? '-' },
    { label: 'Shift ID', value: shift.id },
    { rule: true },
    { label: 'Opening float', value: peso(shift.openingFloat), strong: true },
    ...(shift.previousFloat != null ? [{ label: 'Handoff count', value: peso(shift.previousFloat) }] : []),
    ...denominationRows,
    { rule: true },
    { center: 'Drawer opened' },
  ]);
}

// Prints an X-Report (mid-day handoff) or a Z-Report (end of day).
export function printReportSlip(report) {
  const isZ = report.type === 'Z';
  const totalSales = report.cashSales + report.cardTotal + report.giftTotal;

  const lines = [
    { center: 'CAFE POS', strong: true },
    { center: isZ ? `Z-REPORT #${report.zNumber} · END OF DAY` : 'X-REPORT · SHIFT HANDOFF', strong: true },
    { center: formatDateTime(report.generatedAt) },
    { rule: true },
    { label: 'Cashier', value: report.cashierName },
    { label: 'Shift opened', value: formatDateTime(report.openedAt) },
    { rule: true },
    { label: 'Orders', value: String(report.orderCount) },
    { label: 'Total sales', value: peso(totalSales), strong: true },
    { label: 'Cash sales', value: peso(report.cashSales) },
    { label: 'Card / NFC batch', value: peso(report.cardTotal) },
    { label: 'Gift cards', value: peso(report.giftTotal) },
    { label: 'Cash refunds', value: peso(report.refunds) },
    { label: 'Discounts issued', value: peso(report.discounts) },
    { rule: true },
    { label: 'Opening float', value: peso(report.openingFloat) },
    { label: 'Expected cash', value: peso(report.expectedCash) },
    { label: 'Counted cash', value: peso(report.countedCash) },
    { label: 'Over / short', value: signedPeso(report.variance), strong: true },
  ];

  if (report.approvedByName) lines.push({ label: 'Approved by', value: report.approvedByName });

  if (isZ) {
    lines.push({ rule: true });
    lines.push({ label: 'Card batch', value: report.cardBatchReference ?? '-' });
    lines.push({ center: 'Card batch settled' });
    if (report.staffHours.length > 0) {
      lines.push({ rule: true });
      lines.push({ center: 'STAFF HOURS', strong: true });
      report.staffHours.forEach((entry) => {
        lines.push({ label: `${entry.name} (${entry.role})`, value: formatDuration(entry.ms) });
      });
    }
  }

  lines.push({ rule: true });
  lines.push({ center: '— End of report —' });
  return printLines(isZ ? 'Z-Report' : 'X-Report', lines);
}
