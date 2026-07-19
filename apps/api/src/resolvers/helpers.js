// resolvers/helpers.js — auth guard + shared row mappers used across resolvers.
import { GraphQLError } from 'graphql';
import { fmtINR } from '../services/money.js';
import { avColor, initials, timeAgo, dateLabel, hhmm } from '../services/format.js';

export function requireAdmin(ctx) {
  if (!ctx.admin) {
    throw new GraphQLError('UNAUTHENTICATED', {
      extensions: { code: 'UNAUTHENTICATED', http: { status: 401 } },
    });
  }
  return ctx.admin;
}

export const esc = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const rx = (q) => new RegExp(esc(q.trim()), 'i');

// ── owner → AdminOwnerListItem ──
export function ownerOut(o, now = Date.now()) {
  return {
    ownerId: o.ownerId,
    name: o.name,
    biz: o.biz,
    city: o.city || null,
    kyc: o.kyc,
    venues: o.venueCount ?? null,
    revenue: o.revenue ?? 0,
    payout: o.pendingPayout ?? 0,
    rating: o.rating ?? null,
    disputes: o.disputeCount ?? 0,
    email: o.email || null,
    phone: o.phone || null,
    joined: o.joinedAt ? dateLabel(o.joinedAt) : null,
    submittedAgo: o.submittedAt ? timeAgo(o.submittedAt, now) : null,
    spark: o.spark || [],
    color: avColor(o.name),
    initials: initials(o.name),
  };
}

// ── venue → AdminVenueItem (with console extensions) ──
export function venueOut(v, now = Date.now()) {
  return {
    venueId: v.venueId,
    venueName: v.name,
    address: v.addr || null,
    city: v.city || null,
    courtCount: (v.courts || []).length || null,
    image: (v.photos || [])[0] || null,
    venueStatus: v.status,
    revenue30d: v.revenue30d ?? 0,
    revenueChange: v.revenueChange ?? null,
    bookings30d: v.bookings30d ?? 0,
    occupancy: v.occupancy ?? 0,
    avgRating: v.rating ?? null,
    reviewCount: v.reviewsCount ?? 0,
    pendingPayoutAmount: v.pendingPayoutAmount ?? 0,
    refundCount: v.refundCount ?? 0,
    disputeCount: v.disputeCount ?? 0,
    refundAmount: v.refundAmount ?? 0,
    // console extensions
    ownerId: v.ownerId || null,
    ownerName: v.ownerName || null,
    featured: !!v.featured,
    featuredSlot: v.featuredSlot || null,
    sport: v.sport || null,
    spark: v.spark || [],
    submittedAgo: ['pending', 'review'].includes(v.status) && v.submittedAt ? timeAgo(v.submittedAt, now) : null,
    color: avColor(v.name),
  };
}

// ── booking → AdminBookingItem (with console extensions) ──
export function bookingOut(b, tierPct = 18) {
  const feePct = b.feePct ?? tierPct;
  const fee = Math.round((b.amount * feePct) / 100);
  return {
    bookingId: b.bookingId,
    customerName: b.customerName,
    customerPhone: b.customerPhone || null,
    date: dateLabel(b.slotAt),
    timeRange: b.time || hhmm(b.slotAt),
    sport: b.sport,
    courtName: b.courtName,
    venueName: b.venueName,
    amount: b.amount,
    status: b.status,
    duration: `${b.durationMin || 60} min`,
    // console extensions
    customerId: b.customerId || null,
    venueId: b.venueId || null,
    city: b.city || null,
    method: b.method || null,
    txnRef: b.txnRef || null,
    paid: !!b.paid,
    color: avColor(b.customerName),
    initials: initials(b.customerName),
    createdAt: b.createdAt,
    fee,
    net: b.amount - fee,
  };
}

// ── dispute → DisputeListItem (with console extensions) ──
export function disputeOut(d, now = Date.now()) {
  return {
    disputeId: d.disputeId,
    disputeRef: `#${d.disputeId}`,
    urgency: d.urgency,
    avatarInitials: initials(d.customerName),
    openedLabel: timeAgo(d.openedAt, now),
    venueName: d.venueName,
    title: d.reason,
    status: d.status,
    customerName: d.customerName,
    slotLabel: d.slotLabel,
    sport: d.sport || null,
    courtName: d.courtName || null,
    amount: d.amount,
    timeAgo: timeAgo(d.openedAt, now),
    reason: d.reason,
    // console extensions
    color: avColor(d.customerName),
    ownerName: d.ownerName || null,
    venueId: d.venueId || null,
    bookingId: d.bookingId || null,
  };
}

// ── payout → AdminPayoutRow ──
export function payoutOut(p) {
  return {
    payoutId: p.payoutId,
    ownerId: p.ownerId,
    owner: p.ownerName,
    biz: p.biz,
    venue: p.venueName || null,
    period: p.periodLabel,
    gross: p.gross,
    fee: p.fee,
    tds: p.tds,
    amount: p.amount,
    status: p.status,
    bank: p.bankMasked || null,
    ifsc: p.ifsc || null,
    settles: p.settlesLabel || null,
    txns: p.txns ?? (p.bookingIds || []).length,
    utr: p.utr || null,
    color: avColor(p.ownerName || '?'),
    initials: initials(p.ownerName || '?'),
  };
}

// ── invoice → AdminInvoiceRow ──
export function invoiceOut(i) {
  const who = i.partyName || '?';
  return {
    invoiceId: i.invoiceId,
    audience: i.audience,
    party: who,
    sub: i.subLabel || null,
    type: i.type,
    period: i.period,
    issued: i.issuedAt ? dateLabel(i.issuedAt) : null,
    due: i.status === 'paid' ? 'Paid' : i.dueAt ? dateLabel(i.dueAt) : null,
    amount: i.amount,
    tax: i.tax,
    total: i.total,
    status: i.status,
    pdfUrl: i.pdf || null,
    color: avColor(who),
    initials: initials(who),
  };
}

export { fmtINR };
