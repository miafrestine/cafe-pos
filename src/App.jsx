import { useState, useMemo, useRef, useEffect } from 'react';
import './App.css';
import ProductCard from './components/ProductCard.jsx';
import CheckoutDrawer from './components/CheckoutDrawer.jsx';
import ShiftAnalytics from './components/ShiftAnalytics.jsx';
import LockScreen from './components/LockScreen.jsx';
import ShiftHandoffModal from './components/ShiftHandoffModal.jsx';
import StaffMenu from './components/StaffMenu.jsx';
import { useShiftSession } from './hooks/useShiftSession.js';
import { AUTO_LOCK_MS } from './data/staff.js';
import {
  MAIN_CATEGORIES,
  PRODUCTS,
  SUB_CATEGORIES_MAP,
  SIZE_UPCHARGES,
  getModifier,
} from './data/catalog.js';
import { peso } from './utils/money.js';

const NAV_ITEMS = [
  {
    page: 'register',
    title: 'Register Sales Terminal',
    toast: 'Register Terminal Active',
    paths: ['M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'],
  },
  {
    page: 'orders',
    title: 'Orders History',
    toast: 'Orders History Ledger',
    paths: ['M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'],
  },
  {
    page: 'analytics',
    title: 'Shift Analytics',
    toast: 'Shift Analytics Dashboard',
    paths: ['M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'],
  },
  {
    page: 'settings',
    title: 'Register Settings',
    toast: 'Register Settings',
    paths: [
      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    ],
  },
];

const SETTING_TOGGLES = [
  { key: 'autoPrint', title: 'Thermal Printer Auto-Print', description: 'Print a receipt automatically when an order is completed' },
  { key: 'drawerConnected', title: 'Cash Drawer Connected', description: 'Marks the cash drawer as attached to this terminal' },
  { key: 'soundAlerts', title: 'Sound Alerts', description: 'Play a sound for new orders and errors' },
  { key: 'offlineMode', title: 'Offline Mode', description: 'Keep taking orders when the network is unavailable' },
];

const ORDER_TYPES = ['Dine In', 'Takeaway'];

const roundCents = (n) => Math.round(n * 100) / 100;

export default function App() {
  const [currentPage, setCurrentPage] = useState('register'); // 'register' | 'orders' | 'analytics' | 'settings'
  const [activeMainCat, setActiveMainCat] = useState('coffee');
  const [activeSubCat, setActiveSubCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected size per product (defaults to Tall)
  const [productSizes, setProductSizes] = useState({});

  // Active Cart / Ticket state.
  // `key` identifies what an item is (product + size, or product add-on) so identical items stack.
  const [cart, setCart] = useState([
    { id: 101, key: '1-Tall', productId: 1, name: 'Espresso', price: 2.6, quantity: 1, image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=200&auto=format&fit=crop&q=80' },
    { id: 102, key: 'mod-1', productId: 1, name: 'Plant Milk · Espresso', price: 1.0, quantity: 2, image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=200&auto=format&fit=crop&q=80' },
    { id: 103, key: '2-Tall', productId: 2, name: 'Cold Brew', price: 2.9, quantity: 1, image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=200&auto=format&fit=crop&q=80' },
  ]);
  const cartIdRef = useRef(200);
  const nextCartId = () => {
    cartIdRef.current += 1;
    return cartIdRef.current;
  };

  // Order numbering and type
  const [orderNumber, setOrderNumber] = useState(2156);
  const [orderType, setOrderType] = useState('Dine In');

  // Historical orders state
  const [ordersHistory, setOrdersHistory] = useState([
    { id: 'ORD-2155', time: '10:42 AM', items: 3, total: 14.20, type: 'Dine In', payment: 'Card' },
    { id: 'ORD-2154', time: '10:28 AM', items: 2, total: 8.50, type: 'Takeaway', payment: 'Cash' },
    { id: 'ORD-2153', time: '10:15 AM', items: 4, total: 19.80, type: 'Dine In', payment: 'Card' },
    { id: 'ORD-2152', time: '09:50 AM', items: 1, total: 3.80, type: 'Takeaway', payment: 'Card' },
  ]);

  // Employee sign-in, time cards and the open drawer shift (see the shift transition spec)
  const session = useShiftSession(ordersHistory);
  const [handoffMode, setHandoffMode] = useState(null); // null | 'handoff' | 'close'

  // Settings states
  const [settings, setSettings] = useState({
    autoPrint: true,
    drawerConnected: true,
    soundAlerts: true,
    offlineMode: false,
    taxRate: 8.0,
  });

  const [notification, setNotification] = useState(null);
  const toastTimerRef = useRef(null);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'card'
  const [cashAmount, setCashAmount] = useState('');

  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current);
    setNotification(msg);
    toastTimerRef.current = setTimeout(() => setNotification(null), 2500);
  };

  // Lock the terminal after a few minutes of inactivity; the shift and drawer stay open.
  const isUnlocked = Boolean(session.currentStaff && session.registerShift);
  const lockTerminal = session.lock;
  useEffect(() => {
    if (!isUnlocked || handoffMode) return undefined;
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lockTerminal();
        showToast('Terminal locked after 3 minutes of inactivity');
      }, AUTO_LOCK_MS);
    };
    const events = ['pointerdown', 'keydown'];
    events.forEach((name) => window.addEventListener(name, arm));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, arm));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, handoffMode, lockTerminal]);

  // Totals are rounded to whole cents so what is shown, charged and compared with cash always agree.
  const { subtotal, tax, total } = useMemo(() => {
    const sub = roundCents(cart.reduce((acc, item) => acc + item.price * item.quantity, 0));
    const taxAmount = cart.length > 0 ? roundCents(sub * (settings.taxRate / 100)) : 0;
    return { subtotal: sub, tax: taxAmount, total: roundCents(sub + taxAmount) };
  }, [cart, settings.taxRate]);

  // Dynamic Cash & Change Calculations
  const parsedCashReceived = parseFloat(cashAmount) || 0;
  const changeDue = roundCents(Math.max(0, parsedCashReceived - total));

  // Smart Cash Shortcuts Calculation (Exact, next 5, next 10, next 20 above running total)
  const smartCashShortcuts = useMemo(() => {
    if (total <= 0) return [5, 10, 20, 50];
    const exact = Number(total.toFixed(2));
    const m5 = Math.ceil(total / 5) * 5;
    const m10 = Math.ceil(total / 10) * 10;
    const m20 = Math.ceil(total / 20) * 20;
    const m50 = Math.ceil(total / 50) * 50;
    const raw = [exact, m5, m10, m20, m50].filter(val => val >= total);
    const unique = Array.from(new Set(raw)).sort((a, b) => a - b);
    while (unique.length < 4) {
      unique.push(unique[unique.length - 1] + 10);
    }
    return unique.slice(0, 4);
  }, [total]);

  // Numeric Keypad Handlers
  const handleNumpadPress = (val) => {
    setCashAmount((prev) => {
      if (val === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : prev + '.';
      }
      // At most two decimal places and a sensible overall length
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      if (prev.length >= 8) return prev;
      if (val === '00') {
        return prev === '' || prev === '0' ? prev : prev + '00';
      }
      return prev === '0' ? val : prev + val;
    });
  };

  const handleBackspace = () => {
    setCashAmount(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setCashAmount('');
  };

  const handleShortcutClick = (val) => {
    setCashAmount(val.toFixed(2));
  };

  const handleSizeSelect = (productId, size) => {
    setProductSizes((prev) => ({ ...prev, [productId]: size }));
  };

  const addToCart = (product) => {
    const size = product.category === 'coffee' ? (productSizes[product.id] || 'Tall') : null;
    const unitPrice = product.price + (size ? SIZE_UPCHARGES[size] ?? 0 : 0);
    const itemName = size && size !== 'Tall' ? `${product.name} (${size})` : product.name;
    const key = size ? `${product.id}-${size}` : `${product.id}`;
    const newId = nextCartId();

    setCart((prev) => {
      if (prev.some((i) => i.key === key)) {
        return prev.map((i) => (i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: newId,
          key,
          productId: product.id,
          name: itemName,
          price: unitPrice,
          quantity: 1,
          image: product.image,
        },
      ];
    });
    showToast(`Added ${itemName}`);
  };

  // The add-on toggle on a product card reflects what is actually in the cart,
  // so removing the line from the bill also switches the toggle off.
  const handleModifierToggle = (product) => {
    const { label, price } = getModifier(product);
    const key = `mod-${product.id}`;
    const newId = nextCartId();

    if (cart.some((i) => i.key === key)) {
      setCart((prev) => prev.filter((i) => i.key !== key));
      showToast(`${label} removed from order`);
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        id: newId,
        key,
        productId: product.id,
        name: `${label} · ${product.name}`,
        price,
        quantity: 1,
        image: product.image,
      },
    ]);
    showToast(`${label} added to order`);
  };

  const updateCartQty = (cartItemId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleClearAll = () => {
    setCart([]);
    showToast('Order cleared');
  };

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const isGlobal = query.length > 0;

    if (!isGlobal) {
      const items = PRODUCTS.filter((item) => {
        const matchCat = item.category === activeMainCat;
        const matchSub = activeSubCat === 'All' || item.subCat === activeSubCat;
        return matchCat && matchSub;
      });
      return { isGlobalSearch: false, items, grouped: null };
    } else {
      const matched = PRODUCTS.filter((item) => {
        return (
          item.name.toLowerCase().includes(query) ||
          item.subCat.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          (item.tags && item.tags.some(t => t.toLowerCase().includes(query)))
        );
      });

      const grouped = MAIN_CATEGORIES.map((cat) => ({
        category: cat,
        items: matched.filter(item => item.category === cat.id)
      })).filter(group => group.items.length > 0);

      return { isGlobalSearch: true, items: matched, grouped };
    }
  }, [activeMainCat, activeSubCat, searchQuery]);

  const isCashValid = paymentMode === 'card' || parsedCashReceived >= total;

  const handleCompletePayment = () => {
    if (!isCashValid || cart.length === 0) return;
    setOrdersHistory((prev) => [
      {
        id: `ORD-${orderNumber}`,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        items: cart.reduce((count, item) => count + item.quantity, 0),
        total,
        type: orderType,
        payment: paymentMode === 'cash' ? 'Cash' : 'Card',
        shiftId: session.registerShift?.id ?? null,
        cashier: session.currentStaff?.name ?? null,
      },
      ...prev,
    ]);
    setOrderNumber((n) => n + 1);
    setIsCheckoutOpen(false);
    setCart([]);
    showToast(settings.autoPrint ? 'Payment successful! Receipt printed.' : 'Payment successful!');
  };

  const handleExportCsv = () => {
    const header = ['Order ID', 'Time', 'Items', 'Total (PHP)', 'Type', 'Payment'];
    const rows = ordersHistory.map((o) => [o.id, o.time, o.items, o.total.toFixed(2), o.type, o.payment]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Ledger exported as CSV');
  };

  const commitTaxRate = (e) => {
    const value = parseFloat(e.target.value);
    const next = Number.isNaN(value) ? settings.taxRate : Math.min(Math.max(value, 0), 30);
    setSettings((s) => ({ ...s, taxRate: next }));
    e.target.value = next;
    showToast('Tax rate updated');
  };

  const renderProductCard = (product) => (
    <ProductCard
      key={product.id}
      product={product}
      currentSize={productSizes[product.id] || 'Tall'}
      modifierOn={cart.some((i) => i.key === `mod-${product.id}`)}
      onAdd={addToCart}
      onModifierToggle={handleModifierToggle}
      onSizeSelect={handleSizeSelect}
    />
  );

  return (
    <div className="min-h-screen bg-[#F6EBE1] text-[#1C1917] flex items-center justify-center px-[3px] font-sans select-none antialiased">

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[80] bg-[#1C1917] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-[#F2A65A]"></span>
          <span>{notification}</span>
        </div>
      )}

      {/* Main Tablet Outer Container */}
      <div className="w-full max-w-[1380px] h-screen max-h-[880px] bg-[#FAF7F2] rounded-[32px] shadow-2xl border border-[#EBE3D8] flex overflow-hidden relative">

        {/* ========================================================
            1. LOCKED LEFT SIDEBAR (Navigation & Categories)
           ======================================================== */}
        <aside className="w-[70px] bg-[#1C1917] flex flex-col items-center justify-between py-5 z-20 shrink-0">

          <div className="flex flex-col items-center gap-4">
            {NAV_ITEMS.map((nav) => (
              <button
                key={nav.page}
                onClick={() => { setCurrentPage(nav.page); showToast(nav.toast); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                  currentPage === nav.page ? 'bg-[#F2A65A] text-[#1C1917]' : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
                title={nav.title}
                aria-label={nav.title}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {nav.paths.map((d) => (
                    <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
                  ))}
                </svg>
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-7 my-auto">
            {MAIN_CATEGORIES.map((cat) => {
              const isActive = currentPage === 'register' && activeMainCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setCurrentPage('register');
                    setActiveMainCat(cat.id);
                    setActiveSubCat('All');
                  }}
                  className={`sidebar-category-label relative text-[10px] font-semibold tracking-wider transition-all duration-200 cursor-pointer ${
                    isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {cat.label}
                  {isActive && (
                    <span className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#F2A65A]"></span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="w-2 h-2 rounded-full bg-[#F2A65A]/50"></div>
        </aside>

        {/* CENTER + RIGHT CONTENT AREA */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* ========================================================
              2. DYNAMIC CENTER VIEW CONSOLE
             ======================================================== */}
          <main className="flex-1 flex flex-col px-4 py-5 overflow-hidden">

            <header className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-[#1C1917] tracking-tight">
                  {currentPage === 'register' && MAIN_CATEGORIES.find(c => c.id === activeMainCat)?.label}
                  {currentPage === 'orders' && 'Orders Ledger'}
                  {currentPage === 'analytics' && 'Shift Analytics'}
                  {currentPage === 'settings' && 'Terminal Settings'}
                </h1>
                <div className="flex items-center gap-2 px-3 py-1 bg-white/80 border border-[#EAE3D9] rounded-full text-[11px] font-medium text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Shift Active</span>
                </div>
              </div>

              {currentPage === 'register' && (
                <div className="flex-1 max-w-sm relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search items, categories or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-[#EAE3D9] rounded-full py-2 pl-11 pr-4 text-xs text-[#1C1917] placeholder-gray-400 focus:outline-none focus:border-[#F2A65A] shadow-sm transition"
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <StaffMenu
                  session={session}
                  onLock={session.lock}
                  onEndShift={() => setHandoffMode('handoff')}
                  onClockOut={() => session.clockOut(session.currentStaff.id)}
                  onCloseStore={() => setHandoffMode('close')}
                />
              </div>
            </header>

            {/* VIEW 1: REGISTER VIEW */}
            {currentPage === 'register' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {!searchResults.isGlobalSearch && SUB_CATEGORIES_MAP[activeMainCat] && SUB_CATEGORIES_MAP[activeMainCat].length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
                    {SUB_CATEGORIES_MAP[activeMainCat].map((sub) => {
                      const isActive = activeSubCat === sub;
                      return (
                        <button
                          key={sub}
                          onClick={() => setActiveSubCat(sub)}
                          className={`px-5 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                            isActive
                              ? 'bg-[#1C1917] text-white shadow-md'
                              : 'bg-transparent text-gray-600 hover:text-[#1C1917] hover:bg-white/60'
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                )}

                {searchResults.isGlobalSearch ? (
                  <div className="flex-1 overflow-y-auto pr-1 space-y-6 pb-4">
                    <div className="text-xs font-semibold text-gray-500 px-1">
                      Global Search Results for "{searchQuery}" ({searchResults.items.length} items found):
                    </div>
                    {searchResults.grouped.length > 0 ? (
                      searchResults.grouped.map((group) => {
                        const catLabel = MAIN_CATEGORIES.find(c => c.id === group.category.id)?.label || group.category.label;
                        return (
                          <div key={group.category.id} className="space-y-3">
                            <div className="flex items-center gap-2 pb-1 border-b border-[#EAE3D9]">
                              <span className="px-3 py-1 bg-[#1C1917] text-white rounded-lg text-[11px] font-bold uppercase tracking-wider">
                                {catLabel}
                              </span>
                              <span className="text-xs text-gray-400 font-medium">({group.items.length} items)</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {group.items.map(renderProductCard)}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-white rounded-3xl border border-[#EAE3D9] p-8 flex flex-col items-center justify-center text-center">
                        <span className="text-2xl mb-3 text-[#F2A65A]">🔍</span>
                        <h3 className="text-base font-bold text-[#1C1917]">No matches found</h3>
                        <p className="text-xs text-gray-500 max-w-sm mt-1">We couldn't find any products matching "{searchQuery}".</p>
                      </div>
                    )}
                  </div>
                ) : searchResults.items.length > 0 ? (
                  <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-4 content-start">
                    {searchResults.items.map(renderProductCard)}
                  </div>
                ) : (
                  <div className="flex-1 bg-white rounded-3xl border border-[#EAE3D9] p-8 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl mb-3 text-[#F2A65A]">☕</span>
                    <h3 className="text-base font-bold text-[#1C1917]">Catalog Module</h3>
                    <p className="text-xs text-gray-500 max-w-sm mt-1">No active items match your current filter.</p>
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: ORDERS HISTORY VIEW */}
            {currentPage === 'orders' && (
              <div className="flex-1 bg-white rounded-3xl border border-[#EAE3D9] p-6 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
                  <div>
                    <h2 className="font-bold text-sm text-[#1C1917]">Completed Shift Transactions</h2>
                    <p className="text-[11px] text-gray-400">Real-time ledger synced with drawer #1</p>
                  </div>
                  <button onClick={handleExportCsv} className="px-4 py-2 bg-[#FAF7F2] hover:bg-[#F2A65A]/10 border border-[#EAE3D9] rounded-xl text-xs font-semibold text-[#1C1917] transition">
                    Export Report
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {ordersHistory.map((ord) => (
                    <div key={ord.id} className="flex items-center justify-between p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE3D9]/60">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#1C1917] text-white flex items-center justify-center font-bold text-xs">
                          {ord.id.slice(-2)}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#1C1917]">{ord.id} • {ord.type}</h4>
                          <span className="text-[11px] text-gray-500">{ord.time} • {ord.items} items</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${ord.payment === 'Card' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {ord.payment}
                        </span>
                        <span className="text-sm font-extrabold text-[#1C1917]">{peso(ord.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 3: SHIFT ANALYTICS DASHBOARD */}
            {currentPage === 'analytics' && <ShiftAnalytics onToast={showToast} />}

            {/* VIEW 4: SETTINGS VIEW */}
            {currentPage === 'settings' && (
              <div className="flex-1 bg-white rounded-3xl border border-[#EAE3D9] p-6 flex flex-col space-y-4 overflow-y-auto">
                <h3 className="text-sm font-bold text-[#1C1917] pb-2 border-b border-gray-100">Hardware & Terminal Preferences</h3>
                {SETTING_TOGGLES.map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE3D9]/60">
                    <div>
                      <h4 className="text-xs font-bold text-[#1C1917]">{item.title}</h4>
                      <p className="text-[11px] text-gray-500">{item.description}</p>
                    </div>
                    <button
                      onClick={() => { setSettings((s) => ({ ...s, [item.key]: !s[item.key] })); showToast('Preference updated'); }}
                      className={`w-12 h-6 rounded-full transition relative p-1 ${settings[item.key] ? 'bg-[#1C1917]' : 'bg-gray-300'}`}
                      role="switch"
                      aria-checked={settings[item.key]}
                      aria-label={item.title}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition transform ${settings[item.key] ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between p-4 bg-[#FAF7F2] rounded-2xl border border-[#EAE3D9]/60">
                  <div>
                    <h4 className="text-xs font-bold text-[#1C1917]">Sales Tax Rate (%)</h4>
                    <p className="text-[11px] text-gray-500">Applied to every order's subtotal</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.1"
                    defaultValue={settings.taxRate}
                    onBlur={commitTaxRate}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="w-20 bg-white border border-[#EAE3D9] rounded-xl py-1.5 px-3 text-xs font-bold text-[#1C1917] text-right focus:outline-none focus:border-[#F2A65A]"
                    aria-label="Sales tax rate percent"
                  />
                </div>
              </div>
            )}
          </main>

          {/* ========================================================
              3. PERSISTENT RIGHT ACTIVE BILL SIDEBAR
             ======================================================== */}
          <aside className="w-full md:w-[280px] bg-white border-l border-[#EAE3D9] flex flex-col justify-between p-5 shrink-0 shadow-sm">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h2 className="font-bold text-base text-[#1C1917]">Order #{orderNumber}</h2>
                <button onClick={handleClearAll} className="text-xs text-gray-400 hover:text-red-500 font-medium transition">
                  Clear All
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 mt-3 bg-[#FAF7F2] rounded-xl border border-[#EAE3D9]">
                {ORDER_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`py-1.5 rounded-lg text-[11px] font-semibold transition ${
                      orderType === type ? 'bg-[#1C1917] text-white shadow-sm' : 'text-gray-500 hover:text-[#1C1917]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="h-[270px] overflow-y-auto py-3 space-y-3 pr-1 scrollbar-none">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center py-10">
                    <p className="text-xs font-medium">No items in active bill</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={item.image} alt={item.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#1C1917] line-clamp-1">{item.name}</h4>
                          <span className="text-xs font-semibold text-gray-700">{peso(item.price * item.quantity)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => updateCartQty(item.id, -1)} className="w-6 h-6 rounded-full border border-[#F2A65A] text-[#F2A65A] flex items-center justify-center text-xs font-bold hover:bg-[#F2A65A] hover:text-white transition" aria-label={`Decrease ${item.name}`}>-</button>
                        <span className="text-xs font-bold text-[#1C1917] w-3 text-center">{item.quantity}</span>
                        <button onClick={() => updateCartQty(item.id, 1)} className="w-6 h-6 rounded-full border border-[#F2A65A] text-[#F2A65A] flex items-center justify-center text-xs font-bold hover:bg-[#F2A65A] hover:text-white transition" aria-label={`Increase ${item.name}`}>+</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div className="space-y-1.5 text-xs text-gray-500 font-medium">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-[#1C1917] font-bold">{peso(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax ({settings.taxRate}%)</span>
                  <span className="text-[#1C1917] font-bold">{peso(tax)}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-gray-300 my-2"></div>

              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-bold text-[#1C1917]">Total</span>
                <span className="text-xl font-extrabold text-[#1C1917]">{peso(total)}</span>
              </div>

              <button
                onClick={() => {
                  if (cart.length === 0) {
                    showToast('Cart is empty!');
                    return;
                  }
                  setIsCheckoutOpen(true);
                  setCashAmount('');
                  setPaymentMode('cash');
                }}
                disabled={cart.length === 0}
                className={`w-full py-3.5 rounded-2xl font-semibold text-xs text-white transition-all shadow-md ${
                  cart.length > 0 ? 'bg-[#1C1917] hover:bg-black cursor-pointer' : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Proceed to Checkout
              </button>
            </div>
          </aside>

        </div>

      </div>

      {/* ========================================================
          4. FULL CHECKOUT MODAL SIDEBAR OVERLAY DRAWER
         ======================================================== */}
      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        orderNumber={orderNumber}
        paymentMode={paymentMode}
        setPaymentMode={setPaymentMode}
        total={total}
        changeDue={changeDue}
        cashAmount={cashAmount}
        smartCashShortcuts={smartCashShortcuts}
        onShortcutClick={handleShortcutClick}
        onNumpadPress={handleNumpadPress}
        onBackspace={handleBackspace}
        onClear={handleClear}
        isCashValid={isCashValid}
        parsedCashReceived={parsedCashReceived}
        onComplete={handleCompletePayment}
      />

      {/* Lock screen: sign-in, clock-in and opening the register shift */}
      {(!session.currentStaff || !session.registerShift) && (
        <LockScreen session={session} onToast={showToast} onRequestHandoff={() => setHandoffMode('handoff')} />
      )}

      {/* End-my-shift handoff (X-Report) and close-store (Z-Report) */}
      {handoffMode && (
        <ShiftHandoffModal key={handoffMode} session={session} mode={handoffMode} onClose={() => setHandoffMode(null)} onToast={showToast} />
      )}

    </div>
  );
}
