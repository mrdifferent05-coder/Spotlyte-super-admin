// money.js — all marketplace money math. Amounts are integer rupees.

export const GST_RATE = 0.18;
export const TDS_RATE = 0.01;
export const DEFAULT_FEE_PCT = 18;

// Commission tiers by subscription plan.
export const TIERS = {
  Starter: { name: 'Starter', pct: 20, priceMo: 0 },
  Standard: { name: 'Standard', pct: 18, priceMo: 2499 },
  Growth: { name: 'Growth', pct: 16, priceMo: 4999 },
  Strategic: { name: 'Strategic', pct: 14, priceMo: 9999 },
};

export function platformFee(gross, tierPct = DEFAULT_FEE_PCT) {
  return Math.round(gross * (tierPct / 100));
}

// TDS is 1% statutory, withheld on the net-after-fee amount.
export function tds(netAfterFee) {
  return Math.round(netAfterFee * TDS_RATE);
}

export function gst(amount) {
  return Math.round(amount * GST_RATE);
}

export function refundAmount(amount, pct) {
  return Math.round((amount * pct) / 100);
}

// Payout math per Section 8.11:
// fee = round(gross × tier%) · tds = round((gross − fee) × 1%) · net = gross − fee − tds
export function payoutMath(gross, tierPct = DEFAULT_FEE_PCT) {
  const fee = platformFee(gross, tierPct);
  const t = tds(gross - fee);
  return { gross, fee, tds: t, net: gross - fee - t };
}

// fmtINR — identical rules to the web util (Cr ≥ 1,00,00,000 · L ≥ 1,00,000 · k ≥ 1,000).
export function fmtINR(n, opts = {}) {
  if (n == null) return '—';
  const neg = n < 0 ? '−' : '';
  const v = Math.abs(n);
  if (opts.full) return neg + '₹' + v.toLocaleString('en-IN');
  if (v >= 10000000) return neg + '₹' + (v / 10000000).toFixed(v % 10000000 ? 1 : 0) + ' Cr';
  if (v >= 100000) return neg + '₹' + (v / 100000).toFixed(v % 100000 ? 1 : 0) + ' L';
  if (v >= 1000) return neg + '₹' + (v / 1000).toFixed(0) + 'k';
  return neg + '₹' + v;
}
