// bookings.js — bookings list page, detail timeline, and the refund flow.
import { requireAdmin, rx, bookingOut } from './helpers.js';
import { writeAudit } from '../services/audit.js';
import { refundAmount } from '../services/money.js';
import { fmtINR } from '../services/money.js';
import { dateLabel, hhmm, monthYear, DAY } from '../services/format.js';

async function findBooking(db, bookingId) {
  const b = await db.collection('bookings').findOne({ bookingId });
  if (!b) throw new Error(`Booking ${bookingId} not found`);
  return b;
}

export const bookingsResolvers = {
  Query: {
    getAdminBookingPage: async (_p, { tab, q, limit = 200, offset = 0 }, ctx) => {
      requireAdmin(ctx);
      const { db } = ctx;
      const now = Date.now();
      const since30 = now - 30 * DAY;

      const search = q
        ? { $or: [{ bookingId: rx(q) }, { customerName: rx(q) }, { venueName: rx(q) }, { txnRef: rx(q) }] }
        : {};
      const tabFilter =
        tab === 'cancelled' ? { status: { $in: ['cancelled', 'no-show'] } }
        : tab && tab !== 'all' ? { status: tab }
        : {};

      const [facet] = await db.collection('bookings').aggregate([
        { $match: search },
        {
          $facet: {
            counts: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
            rows: [
              { $match: tabFilter },
              { $sort: { createdAt: -1 } },
              { $skip: offset },
              { $limit: limit },
            ],
            total: [{ $match: tabFilter }, { $count: 'n' }],
            gross30: [
              { $match: { createdAt: { $gte: since30 } } },
              { $group: { _id: null, n: { $sum: 1 }, gmv: { $sum: { $cond: ['$paid', '$amount', 0] } } } },
            ],
            prev30: [
              { $match: { createdAt: { $gte: since30 - 30 * DAY, $lt: since30 } } },
              { $count: 'n' },
            ],
            upcoming7: [
              { $match: { status: 'confirmed', slotAt: { $gte: now, $lte: now + 7 * DAY } } },
              { $count: 'n' },
            ],
            cancelled30: [
              { $match: { createdAt: { $gte: since30 }, status: { $in: ['cancelled', 'no-show'] } } },
              { $count: 'n' },
            ],
            refunds30: [
              { $match: { status: 'refunded', 'refund.at': { $gte: since30 } } },
              { $group: { _id: null, n: { $sum: 1 }, total: { $sum: '$refund.amount' } } },
            ],
          },
        },
      ]).toArray();

      const byStatus = Object.fromEntries(facet.counts.map((c) => [c._id, c.n]));
      const counts = {
        all: Object.values(byStatus).reduce((s, n) => s + n, 0),
        confirmed: byStatus.confirmed || 0,
        completed: byStatus.completed || 0,
        cancelled: (byStatus.cancelled || 0) + (byStatus['no-show'] || 0),
        refunded: byStatus.refunded || 0,
      };
      const g30 = facet.gross30[0] || { n: 0, gmv: 0 };
      const prev = facet.prev30[0]?.n || 0;
      const cxl = facet.cancelled30[0]?.n || 0;
      const cxlRate = g30.n ? Math.round((cxl / g30.n) * 1000) / 10 : 0;
      const refunds = facet.refunds30[0] || { n: 0, total: 0 };

      return {
        counts,
        stats: {
          gross30: g30.n,
          gross30Delta: prev ? Math.round(((g30.n - prev) / prev) * 100) : null,
          gmv30: g30.gmv,
          upcoming7: facet.upcoming7[0]?.n || 0,
          cancellationRate: cxlRate,
          cxlMeta: cxlRate < 8 ? 'Below 8% target' : 'Above 8% target',
          refunds30: refunds.total,
          refundTxns: refunds.n,
        },
        total: facet.total[0]?.n || 0,
        monthLabel: monthYear(now),
        bookings: facet.rows.map((b) => bookingOut(b)),
      };
    },

    getAdminBookingDetail: async (_p, { bookingId }, ctx) => {
      requireAdmin(ctx);
      const b = await findBooking(ctx.db, bookingId);
      const feePct = b.feePct ?? 18;
      const fee = Math.round((b.amount * feePct) / 100);

      const timeline = [
        { title: 'Booking created', sub: `${dateLabel(b.createdAt)} · ${hhmm(b.createdAt)}`, state: 'done' },
        { title: 'Payment captured', sub: `${b.method} · ${fmtINR(b.amount, { full: true })}`, state: b.paid ? 'done' : 'skip' },
        { title: 'Confirmation sent', sub: `SMS + email to ${b.customerName}`, state: b.paid ? 'done' : 'skip' },
        b.status === 'completed'
          ? { title: 'Slot completed', sub: 'Marked by venue', state: 'done' }
          : b.status === 'cancelled'
          ? { title: 'Cancelled', sub: 'By customer · 4h before', state: 'cancel' }
          : b.status === 'no-show'
          ? { title: 'No-show', sub: 'Customer did not arrive', state: 'cancel' }
          : b.status === 'refunded'
          ? { title: 'Refunded', sub: `${fmtINR(b.refund?.amount ?? b.amount, { full: true })} → source`, state: 'refund' }
          : { title: 'Upcoming slot', sub: `${dateLabel(b.slotAt)} · ${b.time}`, state: 'curr' },
      ];

      return {
        booking: bookingOut(b),
        txnRef: b.txnRef || null,
        method: b.method || null,
        paid: !!b.paid,
        timeline,
        breakdown: {
          amount: b.amount,
          feePct,
          fee,
          ownerEarns: b.amount - fee,
        },
        refund: b.refund || null,
      };
    },
  },

  Mutation: {
    adminIssueRefund: async (_p, { bookingId, percent, reason, note }, ctx) => {
      const admin = requireAdmin(ctx);
      const { db } = ctx;
      const b = await findBooking(db, bookingId);
      if (b.status === 'refunded') return { success: false, message: 'Already refunded', refId: bookingId };
      const pct = Math.max(0, Math.min(100, percent));
      const amount = refundAmount(b.amount, pct);
      await db.collection('bookings').updateOne(
        { bookingId },
        {
          $set: {
            status: 'refunded',
            refund: { pct, amount, reason, note: note || null, at: Date.now(), byAdminId: admin.adminId },
          },
        }
      );
      await writeAudit({
        db, actorAdmin: admin, action: 'issued refund',
        target: `${fmtINR(amount, { full: true })} (${pct}%) → ${b.customerName} — ${reason}`,
        type: 'payout', ref: `#${bookingId}`, ip: ctx.ip,
      });
      return {
        success: true,
        message: `Refund of ${fmtINR(amount, { full: true })} (${pct}%) issued · ${reason}`,
        refId: bookingId,
      };
    },
  },
};
