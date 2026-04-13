const ADMIN_SETTINGS_KEY = 'mds_admin_settings';
const DEFAULT_PAYMENT_AUTO_CANCEL_MINUTES = 20;

const toPositiveInteger = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const normalized = Math.floor(n);
  return normalized > 0 ? normalized : null;
};

export const getAdminSettings = () => {
  try {
    const raw = localStorage.getItem(ADMIN_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const getPaymentAutoCancelMinutes = () => {
  // Payment auto-cancel is intentionally fixed to 20 minutes.
  return DEFAULT_PAYMENT_AUTO_CANCEL_MINUTES;
};

export { ADMIN_SETTINGS_KEY, DEFAULT_PAYMENT_AUTO_CANCEL_MINUTES };
