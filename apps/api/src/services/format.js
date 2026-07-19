// format.js — server-side display formatting shared by resolvers.
// The API returns exactly the strings the UI renders (Section 9.3).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function timeAgo(ms, now = Date.now()) {
  if (!ms) return '—';
  const d = now - ms;
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${Math.round(d / MIN)} min ago`;
  if (d < DAY) {
    const h = Math.round(d / HOUR);
    return `${h} h ago`;
  }
  const days = Math.floor(d / DAY);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} d ago`;
  const w = Math.floor(days / 7);
  if (w < 5) return `${w} wk ago`;
  return dateLabel(ms);
}

export function relDayLabel(ms, now = Date.now()) {
  const d = new Date(ms);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (new Date(now - DAY).toDateString() === d.toDateString()) return 'Yesterday';
  return timeAgo(ms, now);
}

// "May 2, 2026"
export function dateLabel(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// "2 Apr" / "8 Apr"
export function shortDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "2 Apr → 8 Apr"
export function periodLabel(from, to) {
  return `${shortDate(from)} → ${shortDate(to)}`;
}

// "May 2026"
export function monthYear(ms) {
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "Mon 12 May"
export function dayShort(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "TUE, 05 MAY 2026"
export function dateEyebrow(ms) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  return `${DAYS[d.getDay()].toUpperCase()}, ${dd} ${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

// "TODAY, TUE 05 MAY"
export function todayEyebrow(ms = Date.now()) {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  return `TODAY, ${DAYS[d.getDay()].toUpperCase()} ${dd} ${MONTHS[d.getMonth()].toUpperCase()}`;
}

// "May 7, 2026 · 11:32 AM" — audit timestamps
export function auditTime(ms) {
  const d = new Date(ms);
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${dateLabel(ms)} · ${h}:${m} ${ampm}`;
}

// "18:00"
export function hhmm(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Next Monday (payout run day) from `now`.
export function nextMonday(now = Date.now()) {
  const d = new Date(now);
  const delta = (8 - d.getDay()) % 7 || 7;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return m.getTime();
}

// Deterministic avatar color — the exact hash + palette from the design system.
export const AV_COLORS = ['#2AA255', '#1F6B3A', '#C77B26', '#0075FF', '#7A5AE0', '#E11D48', '#0E8E54', '#3B5BDB', '#B45309', '#0F766E'];
export function avColor(s = '?') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function initials(n = '?') {
  return n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// Stable pseudo-random sparkline (same generator the approved design used).
export function spark(seed, n = 14, trend = 0) {
  const a = [];
  let v = 50 + (seed % 30);
  for (let i = 0; i < n; i++) {
    const r = ((seed * 9301 + i * 49297) % 233280) / 233280;
    v = Math.max(8, Math.min(96, v + (r - 0.5 + trend * 0.12) * 22));
    a.push(Math.round(v));
  }
  return a;
}

// Data-derived delta: 2nd-half average vs 1st-half average of a series, in %.
export function sparkDelta(arr) {
  if (!arr || arr.length < 4) return null;
  const half = Math.floor(arr.length / 2);
  const a = arr.slice(0, half).reduce((s, x) => s + x, 0) / half;
  const b = arr.slice(half).reduce((s, x) => s + x, 0) / (arr.length - half);
  if (!a) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

// "HDFC ••7723" from a bank name + masked account tail.
export function maskBank(bankName, accountNoMasked) {
  const tail = (accountNoMasked || '').replace(/[^0-9]/g, '').slice(-4);
  return `${(bankName || 'HDFC Bank').split(' ')[0].toUpperCase()} ••${tail || '0000'}`;
}
