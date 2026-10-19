// Demo staff and shift settings for the lock screen and shift handoff.
// Until the app is connected to the database (see supabase/migrations), staff
// live here. The PINs below are demo values only. In the database PINs are
// stored as bcrypt hashes and checked by verify_staff_pin().

export const ROLES = ['Head Barista', 'Cashier', 'Store Manager'];

export const STAFF = [
  { id: 's1', name: 'Ana Reyes', pin: '1234', badge: 'BADGE-1001', nfc: 'NFC-A1', defaultRole: 'Head Barista', isManager: false },
  { id: 's2', name: 'Marco Dela Cruz', pin: '2580', badge: 'BADGE-1002', nfc: 'NFC-B2', defaultRole: 'Cashier', isManager: false },
  { id: 's3', name: 'Liza Santos', pin: '9999', badge: 'BADGE-1003', nfc: 'NFC-C3', defaultRole: 'Store Manager', isManager: true },
];

// Starting cash in a new drawer when nobody has handed one over (matches registers.default_float).
export const DEFAULT_FLOAT = 150;
// Over / short amount (either direction) above which a manager PIN is required.
export const VARIANCE_THRESHOLD = 5;
// Lock the terminal after this much inactivity.
export const AUTO_LOCK_MS = 3 * 60 * 1000;
// Wrong PINs allowed before the profile is locked, and for how long.
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;

// Peso bills and coins offered in the quick-count.
export const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
