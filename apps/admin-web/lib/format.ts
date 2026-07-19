// format.ts — shared display utilities (identical rules to the API layer).

// Indian-style currency: ₹1.42 Cr · ₹8.4 L · ₹54.7k · ₹1,400 (full)
// Cr ≥ 1,00,00,000 · L ≥ 1,00,000 · k ≥ 1,000
export function fmtINR(n?: number | null, opts: { full?: boolean } = {}): string {
  if (n == null) return '—';
  const neg = n < 0 ? '−' : '';
  const v = Math.abs(n);
  if (opts.full) return neg + '₹' + v.toLocaleString('en-IN');
  if (v >= 10000000) return neg + '₹' + (v / 10000000).toFixed(v % 10000000 ? 1 : 0) + ' Cr';
  if (v >= 100000) return neg + '₹' + (v / 100000).toFixed(v % 100000 ? 1 : 0) + ' L';
  if (v >= 1000) return neg + '₹' + (v / 1000).toFixed(0) + 'k';
  return neg + '₹' + v;
}

export const AV_COLORS = ['#2AA255', '#1F6B3A', '#C77B26', '#0075FF', '#7A5AE0', '#E11D48', '#0E8E54', '#3B5BDB', '#B45309', '#0F766E'];

export function avColor(s = '?'): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export function initials(n = '?'): string {
  return n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
