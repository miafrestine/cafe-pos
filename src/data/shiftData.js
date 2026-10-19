// Sample data for the Shift Analytics dashboard.
// Hourly sales are the source of truth: every shift view (totals, category split,
// payment split, top items) is derived from the hourly slots that fall inside the shift.

export const hourLabel = (hour) => `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`;

const round2 = (n) => Math.round(n * 100) / 100;

export const HOURLY = [
  { hour: 7, revenue: 98.5, orders: 8 },
  { hour: 8, revenue: 212, orders: 17 },
  { hour: 9, revenue: 276.5, orders: 23 },
  { hour: 10, revenue: 198, orders: 16 },
  { hour: 11, revenue: 301.5, orders: 26 },
  { hour: 12, revenue: 236, orders: 22 },
  { hour: 13, revenue: 160, orders: 16 },
  { hour: 14, revenue: 142, orders: 13 },
  { hour: 15, revenue: 118, orders: 11 },
  { hour: 16, revenue: 164, orders: 15 },
  { hour: 17, revenue: 204, orders: 19 },
  { hour: 18, revenue: 96, orders: 9 },
];

export const SHIFTS = [
  {
    id: 'current',
    label: 'Current Active Shift',
    window: 'Since 7 AM',
    live: true,
    fromHour: 7,
    toHour: 13,
    floatCash: 200,
    vsPrevious: 12.4,
    vsLabel: 'vs previous shift',
  },
  {
    id: 'morning',
    label: 'Morning Rush',
    window: '6 AM – 12 PM',
    live: false,
    fromHour: 7,
    toHour: 11,
    floatCash: 200,
    vsPrevious: 8.1,
    vsLabel: 'vs previous shift',
  },
  {
    id: 'afternoon',
    label: 'Afternoon Shift',
    window: '12 PM – 6 PM',
    live: false,
    fromHour: 12,
    toHour: 18,
    floatCash: 150,
    vsPrevious: -3.2,
    vsLabel: 'vs previous shift',
  },
  {
    id: 'full',
    label: 'Full Day Summary',
    window: 'All shifts',
    live: false,
    fromHour: 7,
    toHour: 18,
    floatCash: 200,
    vsPrevious: 5.7,
    vsLabel: 'vs yesterday',
  },
];

// Category / payment colors are the first slots of the validated categorical palette.
export const CATEGORY_META = [
  { id: 'coffee', label: 'Coffee', color: '#eb6834' },
  { id: 'tea', label: 'Tea', color: '#2a78d6' },
  { id: 'meals', label: 'Meals', color: '#1baf7a' },
  { id: 'snacks', label: 'Snacks', color: '#eda100' },
  { id: 'desserts', label: 'Desserts', color: '#e87ba4' },
];

export const PAYMENT_META = [
  { id: 'cash', label: 'Cash', color: '#1baf7a' },
  { id: 'card', label: 'Card / NFC', color: '#2a78d6' },
  { id: 'gift', label: 'Gift Cards', color: '#eb6834' },
];

// How sales are mixed in each part of the day (shares of revenue, items per order).
const MIX = {
  morning: {
    categories: { coffee: 0.46, tea: 0.18, meals: 0.16, snacks: 0.1, desserts: 0.1 },
    payments: { cash: 0.38, card: 0.55, gift: 0.07 },
    items: [
      ['Cinnamon Latte', 3.7, 0.3],
      ['Cold Brew', 2.9, 0.26],
      ['Cappuccino', 2.7, 0.22],
      ['Almond Croissant', 3.8, 0.2],
      ['Brown Sugar Boba Milk', 4.8, 0.14],
      ['Hazelnut Latte', 5.3, 0.12],
      ['Avocado Sourdough Toast', 7.5, 0.08],
      ['Matcha Green Latte', 4.5, 0.08],
    ],
  },
  afternoon: {
    categories: { coffee: 0.34, tea: 0.26, meals: 0.12, snacks: 0.12, desserts: 0.16 },
    payments: { cash: 0.3, card: 0.62, gift: 0.08 },
    items: [
      ['Brown Sugar Boba Milk', 4.8, 0.32],
      ['Matcha Green Latte', 4.5, 0.2],
      ['Cinnamon Latte', 3.7, 0.2],
      ['Tiramisu Slice', 6.5, 0.14],
      ['Iced Jasmine Green', 3.5, 0.13],
      ['Cold Brew', 2.9, 0.1],
      ['Warm Lava Cake', 6.9, 0.08],
      ['Mediterranean Grain Bowl', 9.5, 0.06],
    ],
  },
};

// Rounds each amount to cents and puts any rounding leftover on the largest one,
// so the parts always add up exactly to the total.
function allocate(raw, total) {
  const keys = Object.keys(raw);
  const rounded = Object.fromEntries(keys.map((k) => [k, round2(raw[k])]));
  const diff = round2(total - keys.reduce((acc, k) => acc + rounded[k], 0));
  if (diff !== 0) {
    const largest = keys.reduce((a, b) => (rounded[a] >= rounded[b] ? a : b));
    rounded[largest] = round2(rounded[largest] + diff);
  }
  return rounded;
}

export function getShiftData(shiftId) {
  const shift = SHIFTS.find((s) => s.id === shiftId) ?? SHIFTS[0];

  const slots = HOURLY.map((slot) => {
    const base = { hour: slot.hour, label: hourLabel(slot.hour), revenue: null, orders: null };
    if (slot.hour < shift.fromHour) return { ...base, state: 'outside' };
    if (slot.hour > shift.toHour) return { ...base, state: shift.live ? 'upcoming' : 'outside' };
    return { ...base, state: 'active', revenue: slot.revenue, orders: slot.orders };
  });
  const active = slots.filter((s) => s.state === 'active');

  const revenue = round2(active.reduce((acc, s) => acc + s.revenue, 0));
  const orders = active.reduce((acc, s) => acc + s.orders, 0);

  const categoryRaw = Object.fromEntries(CATEGORY_META.map((c) => [c.id, 0]));
  const paymentRaw = Object.fromEntries(PAYMENT_META.map((p) => [p.id, 0]));
  const itemTotals = {};

  active.forEach((slot) => {
    const mix = MIX[slot.hour < 12 ? 'morning' : 'afternoon'];
    CATEGORY_META.forEach((c) => {
      categoryRaw[c.id] += slot.revenue * mix.categories[c.id];
    });
    PAYMENT_META.forEach((p) => {
      paymentRaw[p.id] += slot.revenue * mix.payments[p.id];
    });
    mix.items.forEach(([name, price, perOrder]) => {
      const entry = itemTotals[name] ?? { name, price, qty: 0 };
      entry.qty += slot.orders * perOrder;
      itemTotals[name] = entry;
    });
  });

  const categoryAmounts = allocate(categoryRaw, revenue);
  const paymentAmounts = allocate(paymentRaw, revenue);

  const categories = CATEGORY_META.map((c) => ({
    ...c,
    amount: categoryAmounts[c.id],
    share: revenue > 0 ? categoryAmounts[c.id] / revenue : 0,
  }));
  const payments = PAYMENT_META.map((p) => ({
    ...p,
    amount: paymentAmounts[p.id],
    share: revenue > 0 ? paymentAmounts[p.id] / revenue : 0,
  }));

  const topItems = Object.values(itemTotals)
    .map((item) => {
      const qty = Math.round(item.qty);
      const itemRevenue = round2(qty * item.price);
      return { name: item.name, qty, revenue: itemRevenue, share: revenue > 0 ? itemRevenue / revenue : 0 };
    })
    .filter((item) => item.qty > 0)
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 5);

  const peakCount = active.length >= 4 ? 2 : 1;
  const peakHours = [...active]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, peakCount)
    .map((s) => s.hour);

  const cashSales = paymentAmounts.cash;
  const cardTotal = paymentAmounts.card;
  const giftTotal = paymentAmounts.gift;

  return {
    shift,
    slots,
    peakHours,
    revenue,
    orders,
    average: orders > 0 ? revenue / orders : 0,
    activeHours: active.length,
    categories,
    payments,
    topItems,
    cashSales,
    cardTotal,
    giftTotal,
    floatCash: shift.floatCash,
    expectedCash: round2(shift.floatCash + cashSales),
  };
}
